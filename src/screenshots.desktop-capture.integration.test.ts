/**
 * @file
 *
 * Produces the desktop screenshots the community-directory listing needs, driving a real Obsidian on a copy of the
 * demo vault and writing `images/screenshots/screenshot-desktop-N.png`.
 *
 * Five frames, one per headline feature a reader can see: the relations pane on Bob (Alice's `child` link, read
 * from Bob's end as `parent`), the pane on Alice, the `spouse` badge with its tooltip in Reading view and in Live
 * Preview, and the relation registry in the settings tab. The pane stays open in the right sidebar for the four
 * note frames, so each one shows the note and its relations side by side. Five is the directory's cap per form
 * factor.
 *
 * **The tooltip is raised with `displayTooltip`, not by a hover.** A trusted hover raises no Obsidian tooltip in
 * the test instance at all (see `link-badges.cross-platform.integration.test.ts`), and the text shown is the
 * badge's own `aria-label`, which is the text the badge's `setTooltip` shows on a real hover.
 *
 * Excluded from `npm run test:integration` by its file name: see the `capture-screenshots:desktop` project in
 * `scripts/vitest-config.ts`. Capturing is an explicit operation (`npm run capture:screenshots`).
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  applyObsidianTheme,
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;

const TEST_TIMEOUT_IN_MILLISECONDS = 120_000;

const PLUGIN_ID = 'labelled-links';
const ALICE_PATH = 'Materials/01 Relations/Alice.md';
const BOB_PATH = 'Materials/01 Relations/Bob.md';

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

/*
 * The registry shot adds the pair `02 Settings` adds with its button. The default registry alone is not a value:
 * the field shows it only as its placeholder, greyed out.
 */
const REGISTRY_DEFINITIONS = ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling', 'employee <-> employer'];

/**
 * The part of Electron's `BrowserWindow` the capture sizes the window with.
 */
interface ElectronBrowserWindow {
  setContentSize: (width: number, height: number) => void;
}

/**
 * Electron's remote module, which reaches the main-process window from the renderer.
 */
interface ElectronRemote {
  getCurrentWindow: () => ElectronBrowserWindow;
}

/**
 * The desktop renderer's window, which can load Electron's remote module.
 */
interface ElectronWindow extends Window {
  require: (id: '@electron/remote') => ElectronRemote;
}

type NoteMode = 'live-preview' | 'reading';

/*
 * `applyObsidianTheme` rather than a bare `app.changeTheme('obsidian')`: that only schedules the config save, and a
 * config reload landing first drops the theme, so every frame would come out light.
 */
beforeAll(async () => {
  await applyObsidianTheme({ theme: 'dark', vaultPath: vaultPath() });
  await evalInObsidian({
    async callback({ app, heightInPixels, lib, widthInPixels }): Promise<void> {
      const { waitUntil } = lib;

      /*
       * The capture pins its viewport only for the length of the frame, so a window of any other size lays the note
       * out twice: once when it is staged and again when it is shot. A tooltip is placed in fixed pixels against the
       * first layout, and would float away from its badge in the second.
       */
      const RESIZE_SETTLE_DELAY_IN_MILLISECONDS = 500;
      const browserWindow = (activeWindow as ElectronWindow).require('@electron/remote').getCurrentWindow();

      // The window's viewport and its content size differ by a border, which the second call takes off.
      browserWindow.setContentSize(widthInPixels, heightInPixels);
      await sleep(RESIZE_SETTLE_DELAY_IN_MILLISECONDS);
      browserWindow.setContentSize(
        2 * widthInPixels - activeWindow.innerWidth,
        2 * heightInPixels - activeWindow.innerHeight
      );
      await waitUntil({
        message: 'the window to take the frame size',
        predicate: () => activeWindow.innerWidth === widthInPixels && activeWindow.innerHeight === heightInPixels
      });

      // Each note opens with its own `# H1`, so the inline title would print every name twice.
      app.vault.setConfig('showInlineTitle', false);
    },
    input: { heightInPixels: HEIGHT_IN_PIXELS, widthInPixels: WIDTH_IN_PIXELS },
    vaultPath: vaultPath()
  });
});

describe('desktop store screenshots', () => {
  it('1 - the relations pane on Bob', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageNoteWithPane(BOB_PATH, 'reading')).toBe('Bob');
    await shoot(1, 'Alice links Bob as child, so Bob reads it as parent');
  });

  it('2 - the relations pane on Alice', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageNoteWithPane(ALICE_PATH, 'live-preview')).toBe('Alice');
    await shoot(2, 'Every relation of a note, both ways, with its plain links');
  });

  it('3 - a badge and its tooltip in Reading view', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageBadgeTooltip('reading')).toBe('Dan is Alice\'s spouse\nAlice is Dan\'s spouse');
    await shoot(3, 'The label sits on the link, and its tooltip reads both ways');
  });

  it('4 - the same badge in Live Preview', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageBadgeTooltip('live-preview')).toBe('Dan is Alice\'s spouse\nAlice is Dan\'s spouse');
    await shoot(4, 'The same badge while you edit, in Live Preview');
  });

  it('5 - the relation registry', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageRegistry()).toBe(REGISTRY_DEFINITIONS.join('\n'));
    await shoot(5, 'Each label pair is declared once, in the relation registry');
  });
});

/**
 * Captures the window, captions it, and writes it as `images/screenshots/screenshot-desktop-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  // Captioned after capture, so the frame stays an untouched window shot and rewording a label needs no re-shoot.
  const labeled = await labelScreenshot(bytes, { text: caption });

  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

/**
 * Opens Alice in the given mode with the pane beside her, and raises the `spouse` badge's tooltip.
 *
 * @param mode - The view mode to open Alice in.
 * @returns The tooltip text on screen.
 */
async function stageBadgeTooltip(mode: NoteMode): Promise<string> {
  await stageNoteWithPane(ALICE_PATH, mode);
  return await evalInObsidian({
    async callback({ lib, mode: noteMode, obsidianModule }): Promise<string> {
      const { waitUntil } = lib;
      const SETTLE_DELAY_IN_MILLISECONDS = 500;
      const containerSelector = noteMode === 'reading' ? '.markdown-preview-view' : '.cm-content';

      function findBadgeEl(): HTMLElement | null {
        const leafEl = activeDocument.querySelector(':scope .workspace-leaf.mod-active .view-content');
        return leafEl?.querySelector<HTMLElement>(`${containerSelector} .labelled-links-badge`) ?? null;
      }

      await waitUntil({ message: 'the spouse badge', predicate: () => findBadgeEl() !== null });
      const foundBadgeEl = findBadgeEl();
      if (!foundBadgeEl) {
        throw new Error('The spouse badge is gone');
      }

      obsidianModule.displayTooltip(foundBadgeEl, foundBadgeEl.getAttribute('aria-label') ?? '', { placement: 'bottom' });
      await waitUntil({ predicate: () => activeDocument.querySelector('.tooltip') !== null });
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
      return activeDocument.querySelector('.tooltip')?.textContent ?? '';
    },
    input: { mode },
    vaultPath: vaultPath()
  });
}

/**
 * Opens a note in the main area in the given mode, then the relations pane, and waits for the pane to show the
 * note with every snippet read.
 *
 * @param path - The note's path.
 * @param mode - The view mode to open it in.
 * @returns The note name the pane shows.
 */
async function stageNoteWithPane(path: string, mode: NoteMode): Promise<string> {
  return await evalInObsidian({
    async callback({ app, lib, mode: noteMode, path: notePath, pluginId }): Promise<string> {
      const { waitUntil } = lib;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      app.setting.close();
      for (const tooltipEl of activeDocument.querySelectorAll('.tooltip')) {
        tooltipEl.detach();
      }

      const file = app.vault.getFileByPath(notePath);
      if (!file) {
        throw new Error(`${notePath} is not in the vault`);
      }

      const leaf = app.workspace.getLeaf(false);
      await leaf.setViewState({
        active: true,
        state: { file: file.path, mode: noteMode === 'reading' ? 'preview' : 'source', source: false },
        type: 'markdown'
      });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      app.commands.executeCommandById(`${pluginId}:open-relations-pane`);
      // The command reveals the pane, which makes it the active leaf. The note stays the one the pane follows.
      app.workspace.setActiveLeaf(leaf, { focus: true });

      function readTitle(): string {
        return activeDocument.querySelector(':scope .labelled-links-relations-view .labelled-links-relations-title')?.textContent ?? '';
      }

      await waitUntil({
        predicate: () => {
          const snippetEls = [...activeDocument.querySelectorAll(':scope .labelled-links-relations-view .labelled-links-relation-snippet')];
          return readTitle() === file.basename && snippetEls.every((snippetEl) => snippetEl.textContent !== '');
        }
      });
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
      return readTitle();
    },
    input: { mode, path, pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Opens the plugin's settings tab and waits for the registry to show its definitions.
 *
 * @returns The registry text.
 */
async function stageRegistry(): Promise<string> {
  return await evalInObsidian({
    async callback({ app, lib, pluginId, relationDefinitions }): Promise<string> {
      const { configureCommunityPlugin, waitUntil } = lib;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      for (const tooltipEl of activeDocument.querySelectorAll('.tooltip')) {
        tooltipEl.detach();
      }

      await configureCommunityPlugin({ app, pluginId, settings: { relationDefinitions } });
      app.setting.open();
      app.setting.openTabById(pluginId);

      function readRegistry(): string {
        return app.setting.activeTab?.containerEl.querySelector('textarea')?.value ?? '';
      }

      await waitUntil({ message: 'the registry in the settings tab', predicate: () => readRegistry() !== '' });
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
      return readRegistry();
    },
    input: { pluginId: PLUGIN_ID, relationDefinitions: REGISTRY_DEFINITIONS },
    vaultPath: vaultPath()
  });
}

function vaultPath(): string {
  return getTemporaryVault().path;
}

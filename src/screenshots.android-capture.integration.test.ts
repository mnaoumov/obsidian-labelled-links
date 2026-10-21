/**
 * @file
 *
 * Produces the mobile screenshots the community-directory listing needs, driving a real Obsidian Mobile on an
 * Android emulator and writing `images/screenshots/screenshot-mobile-N.png`.
 *
 * The mobile half of `screenshots.desktop-capture.integration.test.ts`, with the same five frames and captions, so
 * the two sets tell one story. Read that file for why these are the frames and why the tooltip is raised with
 * `displayTooltip`. What differs on a phone: the relations pane is the right drawer, which slides over the note, so
 * the pane frames show the drawer and the badge frames close it again.
 *
 * There is no mobile equivalent of the desktop viewport override, so the capture is always the device's own
 * framebuffer, and the AVD is built at exactly the 900x1600 the directory asks for: see `SCREENSHOT_AVD_NAME` in
 * `scripts/vitest-config.ts`.
 *
 * **Opening the settings modal takes one extra step on mobile.** `app.setting.containerEl` is not in the document,
 * and `open()` does not attach it, so it is appended to `document.body` before `open()` is called.
 *
 * **Every wait happens in Node**, through `pollInObsidian`. One `evalInObsidian` is capped on Android, and a cold
 * AVD can take longer than that to render a view.
 *
 * Excluded from `npm run test:integration` by its file name: see the `capture-screenshots:android` project in
 * `scripts/vitest-config.ts`. Capturing is an explicit operation (`npm run capture:screenshots`).
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as sleepInNode } from 'node:timers/promises';
import {
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  pollInObsidian,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * A cold-booted AVD renders its first view far more slowly than a warm desktop does.
 */
const RENDER_TIMEOUT_IN_MILLISECONDS = 120_000;

const TEST_TIMEOUT_IN_MILLISECONDS = 600_000;

const POLL_INTERVAL_IN_MILLISECONDS = 500;

/**
 * Time for a drawer to finish sliding, or a view to finish laying out, after its content is ready.
 */
const SETTLE_DELAY_IN_MILLISECONDS = 1500;

const PLUGIN_ID = 'labelled-links';
const ALICE_PATH = 'Materials/01 Relations/Alice.md';
const BOB_PATH = 'Materials/01 Relations/Bob.md';
const SPOUSE_TOOLTIP = 'Dan is Alice\'s spouse\nAlice is Dan\'s spouse';

/*
 * The registry shot adds the pair `02 Settings` adds with its button. The default registry alone is not a value:
 * the field shows it only as its placeholder, greyed out.
 */
const REGISTRY_DEFINITIONS = ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling', 'employee <-> employer'];

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

type NoteMode = 'live-preview' | 'reading';

beforeAll(async () => {
  await evalInObsidian({
    async callback({ alicePath, app }): Promise<void> {
      app.changeTheme('obsidian');

      // Each note opens with its own `# H1`, so the inline title would print every name twice.
      app.vault.setConfig('showInlineTitle', false);

      // The demo vault's lint exemption is not part of the example, and would take a row of Alice's properties.
      const alice = app.vault.getFileByPath(alicePath);
      if (!alice) {
        throw new Error(`${alicePath} is not in the vault`);
      }
      await app.fileManager.processFrontMatter(alice, (frontmatter: Record<string, unknown>) => {
        delete frontmatter['obsidian-dev-utils'];
      });
    },
    input: { alicePath: ALICE_PATH },
    vaultPath: vaultPath()
  });

  await sleepInNode(SETTLE_DELAY_IN_MILLISECONDS);
}, TEST_TIMEOUT_IN_MILLISECONDS);

describe('mobile store screenshots', () => {
  it('1 - the relations pane on Bob', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageNote(BOB_PATH, 'reading', true)).toBe('Bob');
    await shoot(1, 'Alice links Bob as child, so Bob reads it as parent');
  });

  it('2 - the relations pane on Alice', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageNote(ALICE_PATH, 'live-preview', true)).toBe('Alice');
    await shoot(2, 'Every relation of a note, both ways, with its plain links');
  });

  it('3 - a badge and its tooltip in Reading view', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await stageNote(ALICE_PATH, 'reading', false);
    expect(await raiseBadgeTooltip('reading')).toBe(SPOUSE_TOOLTIP);
    await shoot(3, 'The label sits on the link, and its tooltip reads both ways');
  });

  it('4 - the same badge in Live Preview', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await stageNote(ALICE_PATH, 'live-preview', false);
    expect(await raiseBadgeTooltip('live-preview')).toBe(SPOUSE_TOOLTIP);
    await shoot(4, 'The same badge while you edit, in Live Preview');
  });

  it('5 - the relation registry', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stageRegistry()).toBe(REGISTRY_DEFINITIONS.join('\n'));
    await shoot(5, 'Each label pair is declared once, in the relation registry');
  });
});

function getNoteName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/u, '');
}

/**
 * Raises the `spouse` badge's tooltip in the open note.
 *
 * @param mode - The view mode Alice is open in.
 * @returns The tooltip text on screen.
 */
async function raiseBadgeTooltip(mode: NoteMode): Promise<string> {
  const tooltip = await pollInObsidian({
    input: { mode },
    intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
    poll(): string {
      return activeDocument.querySelector('.tooltip')?.textContent ?? '';
    },
    start({ mode: noteMode, obsidianModule }): void {
      const containerSelector = noteMode === 'reading' ? '.markdown-preview-view' : '.cm-content';
      const badgeEl = activeDocument.querySelector<HTMLElement>(`.workspace-leaf.mod-active ${containerSelector} .labelled-links-badge`);
      if (!badgeEl) {
        throw new Error('The spouse badge is not rendered');
      }
      obsidianModule.displayTooltip(badgeEl, badgeEl.getAttribute('aria-label') ?? '', { placement: 'bottom' });
    },
    timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the badge tooltip never showed',
    until: (text: string): boolean => text !== '',
    vaultPath: vaultPath()
  });
  await sleepInNode(SETTLE_DELAY_IN_MILLISECONDS);
  return tooltip;
}

/**
 * Captures the device framebuffer, captions it, and writes it as `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * The AVD is 900x1600, so the device frame IS the directory's size. Asserting it here keeps that true: run this
 * against any other AVD and it fails loudly instead of quietly shipping an off-spec image.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  expect(readPngDimensions(bytes)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  // Captioned after capture, so the frame stays an untouched device screenshot and rewording a label needs no re-shoot.
  const labeled = await labelScreenshot(bytes, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

/**
 * Opens a note in the given mode and, when asked, the relations pane over it, waiting in Node until the pane shows
 * the note with every snippet read, or the note shows its `spouse` badge.
 *
 * @param path - The note's path.
 * @param mode - The view mode to open it in.
 * @param shouldShowPane - Whether to open the relations pane, or close it.
 * @returns What is ready: the note name the pane shows, or `badge`.
 */
async function stageNote(path: string, mode: NoteMode, shouldShowPane: boolean): Promise<string> {
  const ready = await pollInObsidian({
    input: { mode, path, pluginId: PLUGIN_ID, shouldShowPane },
    intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
    poll({ mode: noteMode, shouldShowPane: isPaneWanted }): string {
      if (isPaneWanted) {
        const title = activeDocument.querySelector(':scope .labelled-links-relations-view .labelled-links-relations-title')?.textContent ?? '';
        const snippetEls = [...activeDocument.querySelectorAll(':scope .labelled-links-relations-view .labelled-links-relation-snippet')];
        return snippetEls.every((snippetEl) => snippetEl.textContent !== '') ? title : '';
      }

      const containerSelector = noteMode === 'reading' ? '.markdown-preview-view' : '.cm-content';
      return activeDocument.querySelector(`.workspace-leaf.mod-active ${containerSelector} .labelled-links-badge`) ? 'badge' : '';
    },
    async start({ app, mode: noteMode, path: notePath, pluginId, shouldShowPane: isPaneWanted }): Promise<void> {
      app.setting.close();
      for (const tooltipEl of activeDocument.querySelectorAll('.tooltip')) {
        tooltipEl.detach();
      }

      const file = app.vault.getFileByPath(notePath);
      if (!file) {
        throw new Error(`${notePath} is not in the vault`);
      }

      /*
       * Every shot starts with the drawer shut. A pane shot then opens it again, so the drawer has to finish sliding
       * shut first: reopening it mid-slide leaves it open and empty.
       */
      if (!app.workspace.rightSplit.collapsed) {
        const DRAWER_SLIDE_DELAY_IN_MILLISECONDS = 1000;
        app.workspace.rightSplit.collapse();
        await sleep(DRAWER_SLIDE_DELAY_IN_MILLISECONDS);
      }
      const leaf = app.workspace.getLeaf(false);
      await leaf.setViewState({
        active: true,
        state: { file: file.path, mode: noteMode === 'reading' ? 'preview' : 'source', source: false },
        type: 'markdown'
      });

      if (isPaneWanted) {
        app.commands.executeCommandById(`${pluginId}:open-relations-pane`);
      }
    },
    timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: `${path} never rendered what the shot needs`,
    until: (result: string): boolean => result === (shouldShowPane ? getNoteName(path) : 'badge'),
    vaultPath: vaultPath()
  });
  await sleepInNode(SETTLE_DELAY_IN_MILLISECONDS);
  return ready;
}

/**
 * Sets the registry and opens the plugin's settings tab on it, waiting in Node until the field shows the
 * definitions.
 *
 * @returns The registry text.
 */
async function stageRegistry(): Promise<string> {
  const registry = await pollInObsidian({
    input: { pluginId: PLUGIN_ID, relationDefinitions: REGISTRY_DEFINITIONS },
    intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
    poll({ app }): string {
      return app.setting.activeTab?.containerEl.querySelector('textarea')?.value ?? '';
    },
    async start({ app, lib, pluginId, relationDefinitions }): Promise<void> {
      const { configureCommunityPlugin } = lib;
      const OPEN_DELAY_IN_MILLISECONDS = 500;

      for (const tooltipEl of activeDocument.querySelectorAll('.tooltip')) {
        tooltipEl.detach();
      }
      app.workspace.rightSplit.collapse();

      await configureCommunityPlugin({ app, pluginId, settings: { relationDefinitions } });

      const { containerEl } = app.setting;
      if (!document.body.contains(containerEl)) {
        document.body.append(containerEl);
      }

      app.setting.open();
      await sleep(OPEN_DELAY_IN_MILLISECONDS);
      app.setting.openTabById(pluginId);
    },
    timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the settings tab never showed the registry',
    until: (text: string): boolean => text !== '',
    vaultPath: vaultPath()
  });
  await sleepInNode(SETTLE_DELAY_IN_MILLISECONDS);
  return registry;
}

function vaultPath(): string {
  return getTemporaryVault().path;
}

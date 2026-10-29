import dedent from 'dedent';
import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const PLUGIN_ID = 'labelled-links';

const ALICE_CONTENT = dedent`
  ---
  child: "[[RP Bob]]"
  ---

  spouse:: [[RP Dan]]\n
`;

const BOB_CONTENT = dedent`
  # RP Bob

  Works with [[RP Carol]] on Fridays.\n
`;

interface PaneGroup {
  readonly label: string;
  readonly rows: readonly PaneRow[];
}

interface PaneRow {
  readonly link: string;
  readonly sentence: string;
  readonly snippet: string;
  readonly written: string;
}

interface PaneSection {
  readonly groups: readonly PaneGroup[];
  readonly title: string;
}

describe('Relations pane', () => {
  it('shows the active note\'s relations by label, incoming under the inverse label, and its plain links with their line', async () => {
    const sections = await evalInObsidian({
      async callback({ aliceContent, app, bobContent, lib, pluginId }): Promise<PaneSection[]> {
        const { createNote, waitUntil } = lib;
        const carol = await createNote({ content: '# RP Carol\n', path: 'RP Carol.md' });
        const dan = await createNote({ content: '# RP Dan\n', path: 'RP Dan.md' });
        const bob = await createNote({ content: bobContent, path: 'RP Bob.md' });
        const alice = await createNote({ content: aliceContent, path: 'RP Alice.md' });
        try {
          await waitUntil({
            predicate: () =>
              (app.metadataCache.getFileCache(alice)?.links?.length ?? 0) === 1
              && (app.metadataCache.getFileCache(bob)?.links?.length ?? 0) === 1
          });

          await app.workspace.getLeaf(false).openFile(bob);
          app.commands.executeCommandById(`${pluginId}:open-relations-pane`);

          function readPane(): PaneSection[] {
            const viewEl = activeDocument.querySelector('.labelled-links-relations-view');
            return [...viewEl?.querySelectorAll('.labelled-links-relations-section') ?? []].map((sectionEl) => ({
              groups: [...sectionEl.querySelectorAll('.labelled-links-relations-group')].map((groupEl) => ({
                label: groupEl.querySelector('.labelled-links-relations-group-title')?.textContent ?? '',
                rows: [...groupEl.querySelectorAll('.labelled-links-relation')].map((rowEl) => ({
                  link: rowEl.querySelector('.labelled-links-relation-link')?.textContent ?? '',
                  sentence: rowEl.querySelector('.labelled-links-relation-sentence')?.textContent ?? '',
                  snippet: rowEl.querySelector('.labelled-links-relation-snippet')?.textContent ?? '',
                  written: rowEl.querySelector('.labelled-links-relation-sentence')?.getAttribute('aria-label') ?? ''
                }))
              })),
              title: sectionEl.querySelector('.labelled-links-relations-section-title')?.textContent ?? ''
            }));
          }

          let pane: PaneSection[] = [];
          await waitUntil({
            predicate: () => {
              pane = readPane();
              return pane.some((section) => section.groups.some((group) => group.rows.some((row) => row.snippet !== '')));
            }
          });
          return pane;
        } finally {
          // The vault is shared by every test file, and another one counts every relation in it.
          for (const file of [alice, bob, carol, dan]) {
            await app.fileManager.trashFile(file);
          }
        }
      },
      input: { aliceContent: ALICE_CONTENT, bobContent: BOB_CONTENT, pluginId: PLUGIN_ID }
    });

    expect(sections).toEqual([
      {
        groups: [{ label: 'parent', rows: [{ link: 'RP Alice', sentence: 'RP Bob is RP Alice\'s child', snippet: '', written: 'RP Alice: child: "[[RP Bob]]"' }] }],
        title: 'Incoming'
      },
      {
        groups: [{ label: 'Links', rows: [{ link: 'RP Carol', sentence: '', snippet: 'Works with [[RP Carol]] on Fridays.', written: '' }] }],
        title: 'Unlabelled'
      }
    ]);
  });

  it('follows the active note', async () => {
    const titles = await evalInObsidian({
      async callback({ app, lib, pluginId }): Promise<string[]> {
        const { createNote, waitUntil } = lib;
        const first = await createNote({ content: 'parent:: [[RP Second]]\n', path: 'RP First.md' });
        const second = await createNote({ content: '# RP Second\n', path: 'RP Second.md' });
        await waitUntil({ predicate: () => (app.metadataCache.getFileCache(first)?.links?.length ?? 0) === 1 });
        try {
          function readTitle(): string {
            return activeDocument.querySelector('.labelled-links-relations-view')?.querySelector('.labelled-links-relations-title')?.textContent ?? '';
          }

          const leaf = app.workspace.getLeaf(false);
          await leaf.openFile(first);
          app.commands.executeCommandById(`${pluginId}:open-relations-pane`);
          await waitUntil({ predicate: () => readTitle() === 'RP First' });
          const firstTitle = readTitle();

          await leaf.openFile(second);
          await waitUntil({ predicate: () => readTitle() === 'RP Second' });
          return [firstTitle, readTitle()];
        } finally {
          await app.fileManager.trashFile(first);
          await app.fileManager.trashFile(second);
        }
      },
      input: { pluginId: PLUGIN_ID }
    });

    expect(titles).toEqual(['RP First', 'RP Second']);
  });
});

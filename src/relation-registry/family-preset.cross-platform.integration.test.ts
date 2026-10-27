import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const PLUGIN_ID = 'labelled-links';

interface PaneGroup {
  readonly label: string;
  readonly rows: readonly string[];
}

interface PaneSection {
  readonly groups: readonly PaneGroup[];
  readonly title: string;
}

describe('Family preset', () => {
  it('derives relatives and shows each label as the variant the described note\'s gender picks, once included', async () => {
    const sections = await evalInObsidian({
      async callback({ app, lib, pluginId }): Promise<PaneSection[]> {
        const { configureCommunityPlugin, createNote, waitUntil } = lib;
        const gran = await createNote({ content: '---\ngender: female\n---\n', path: 'FP Gran.md' });
        const mum = await createNote({ content: '---\ngender: female\nparent: "[[FP Gran]]"\n---\n', path: 'FP Mum.md' });
        const kid = await createNote({ content: '---\nparent: "[[FP Mum]]"\n---\n', path: 'FP Kid.md' });
        const notes = [gran, mum, kid];
        try {
          await waitUntil({
            predicate: () => (app.metadataCache.getFileCache(kid)?.frontmatterLinks?.length ?? 0) === 1 && (app.metadataCache.getFileCache(mum)?.frontmatterLinks?.length ?? 0) === 1
          });
          await configureCommunityPlugin({ app, pluginId, settings: { includedPresets: ['family'] } });
          await app.workspace.getLeaf(false).openFile(kid);
          app.commands.executeCommandById(`${pluginId}:open-relations-pane`);

          function readPane(): PaneSection[] {
            const viewEl = activeDocument.querySelector('.labelled-links-relations-view');
            return [...viewEl?.querySelectorAll('.labelled-links-relations-section') ?? []].map((sectionEl) => ({
              groups: [...sectionEl.querySelectorAll('.labelled-links-relations-group')].map((groupEl) => ({
                label: groupEl.querySelector('.labelled-links-relations-group-title')?.textContent ?? '',
                rows: [...groupEl.querySelectorAll('.labelled-links-relation-link')].map((linkEl) => linkEl.textContent)
              })),
              title: sectionEl.querySelector('.labelled-links-relations-section-title')?.textContent ?? ''
            }));
          }

          let pane: PaneSection[] = [];
          await waitUntil({
            predicate: () => {
              pane = readPane();
              return pane.some((section) => section.title === 'Derived');
            }
          });
          return pane;
        } finally {
          await configureCommunityPlugin({ app, pluginId, settings: { includedPresets: [] } });
          // The vault is shared by every test file, and another one counts every relation in it.
          for (const note of notes) {
            await app.fileManager.trashFile(note);
          }
        }
      },
      input: { pluginId: PLUGIN_ID }
    });

    expect(sections).toEqual([
      { groups: [{ label: 'mother', rows: ['FP Mum'] }], title: 'Outgoing' },
      { groups: [{ label: 'grandmother', rows: ['FP Gran'] }], title: 'Derived' }
    ]);
  });
});

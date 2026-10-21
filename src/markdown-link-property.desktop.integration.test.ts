import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { LabelledLinksApi } from '../api.d.ts';

const PLUGIN_ID = 'labelled-links';

interface ProbeResult {
  readonly contentAfterRename: string;
  readonly frontmatterLinks: unknown[];
  readonly hasApi: boolean;
  readonly incoming: unknown[];
  readonly resolvedLinks: Record<string, number>;
}

// Obsidian caches a markdown link in a property as a link of its own, so a property needs no wikilink to be a
// Relation, and a rename of its target rewrites it.
describe('Markdown link in a property', () => {
  it('is cached, resolved, rewritten on rename and read as a relation', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib, pluginId }): Promise<ProbeResult> {
        const { createNote, findPluginApi, waitUntil } = lib;
        const api = findPluginApi<LabelledLinksApi>({ apiVersionRange: '^1.0.0', pluginId });
        if (!api) {
          return { contentAfterRename: '', frontmatterLinks: [], hasApi: false, incoming: [], resolvedLinks: {} };
        }

        const bob = await createNote({ content: '# Bob\n', path: 'ML Bob.md' });
        const alice = await createNote({ content: '---\nchild: "[ML Bob](<ML Bob.md>)"\n---\n', path: 'ML Alice.md' });
        try {
          await waitUntil({
            predicate: () => api.getRelations('ML Bob.md', { direction: 'incoming' }).length === 1
          });
          const frontmatterLinks = app.metadataCache.getFileCache(alice)?.frontmatterLinks ?? [];
          const resolvedLinks = { ...app.metadataCache.resolvedLinks['ML Alice.md'] };
          const incoming = api.getRelations('ML Bob.md', { direction: 'incoming' });

          await app.fileManager.renameFile(bob, 'ML Robert.md');
          await waitUntil({
            predicate: () => String(app.metadataCache.getFileCache(alice)?.frontmatter?.['child']).includes('Robert')
          });
          const contentAfterRename = await app.vault.read(alice);
          return { contentAfterRename, frontmatterLinks, hasApi: true, incoming, resolvedLinks };
        } finally {
          // The vault is shared by every suite in this worker, and the index suite counts every relation in it.
          await app.fileManager.trashFile(alice);
          await app.fileManager.trashFile(bob);
        }
      },
      input: { pluginId: PLUGIN_ID }
    });

    expect(result.hasApi).toBe(true);
    expect(result.frontmatterLinks).toEqual([expect.objectContaining({ key: 'child', link: 'ML Bob.md' })]);
    expect(result.resolvedLinks).toEqual({ 'ML Bob.md': 1 });
    expect(result.incoming).toEqual([
      expect.objectContaining({
        direction: 'incoming',
        isTargetResolved: true,
        label: 'parent',
        linkLabel: 'child',
        sourcePath: 'ML Alice.md',
        targetPath: 'ML Bob.md'
      })
    ]);
    expect(result.contentAfterRename).toContain('ML Robert.md');
  });
});

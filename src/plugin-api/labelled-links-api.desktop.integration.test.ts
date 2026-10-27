import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { LabelledLinksApi } from '../../api.d.ts';

const PLUGIN_ID = 'labelled-links';

interface ProbeResult {
  readonly changedPaths: (null | readonly string[])[];
  readonly danRelations: unknown[];
  readonly hasApi: boolean;
  readonly inverseLabel: null | string;
}

describe('Labelled Links API', () => {
  it('answers relations through the plugin registry and announces their changes on the workspace', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib, pluginId }): Promise<ProbeResult> {
        const { createNote, findPluginApi, waitUntil } = lib;
        const api = findPluginApi<LabelledLinksApi>({ apiVersionRange: '^1.0.0', pluginId });
        if (!api) {
          return { changedPaths: [], danRelations: [], hasApi: false, inverseLabel: null };
        }

        const dan = await createNote({ content: '# Dan\n', path: 'API Dan.md' });
        const erin = await createNote({ content: 'child:: [[API Dan]]\n', path: 'API Erin.md' });
        // Creating a file re-resolves every link, so its event names no note; an edit names the notes it touches.
        const changedPaths: (null | readonly string[])[] = [];
        const eventRef = app.workspace.on('labelled-links:relations-changed', (payload) => {
          changedPaths.push(payload.paths);
        });
        try {
          await waitUntil({
            predicate: () => api.getRelations('API Dan.md', { direction: 'incoming' }).length === 1
          });
          changedPaths.length = 0;
          await app.vault.modify(erin, 'child:: [[API Dan]]\nfriend:: [[API Dan]]\n');
          await waitUntil({
            predicate: () => changedPaths.some((paths) => paths?.includes('API Dan.md') ?? false)
          });
          return {
            changedPaths,
            danRelations: api.getRelations('API Dan.md', { direction: 'incoming', label: 'parent' }),
            hasApi: true,
            inverseLabel: api.getInverseLabel('child')
          };
        } finally {
          app.workspace.offref(eventRef);
          // The vault is shared by every suite in this worker, and the index suite counts every relation in it.
          await app.fileManager.trashFile(erin);
          await app.fileManager.trashFile(dan);
        }
      },
      input: { pluginId: PLUGIN_ID }
    });

    expect(result.hasApi).toBe(true);
    expect(result.inverseLabel).toBe('parent');
    expect(result.danRelations).toEqual([
      expect.objectContaining({
        direction: 'incoming',
        isTargetResolved: true,
        label: 'parent',
        linkLabel: 'child',
        sourcePath: 'API Erin.md',
        targetPath: 'API Dan.md'
      })
    ]);
    expect(result.changedPaths).toContainEqual(expect.arrayContaining(['API Dan.md', 'API Erin.md']));
  });

  it('derives relations from a composition rule in the registry', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib, pluginId }): Promise<unknown[]> {
        const { configureCommunityPlugin, createNote, findPluginApi, waitUntil } = lib;
        const api = findPluginApi<LabelledLinksApi>({ apiVersionRange: '^1.1.0', pluginId });
        if (!api) {
          return [];
        }

        const notes = [
          await createNote({ content: 'child:: [[API Kid]]\nsibling:: [[API Aunt]]\n', path: 'API Dad.md' }),
          await createNote({ content: '# Kid\n', path: 'API Kid.md' }),
          await createNote({ content: '# Aunt\n', path: 'API Aunt.md' })
        ];
        try {
          await configureCommunityPlugin({
            app,
            pluginId,
            settings: { relationDefinitions: ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling', 'aunt = parent -> sibling'] }
          });
          await waitUntil({ predicate: () => api.getDerivedRelations('API Kid.md').length === 1 });
          return api.getDerivedRelations('API Kid.md', { label: 'aunt' });
        } finally {
          await configureCommunityPlugin({ app, pluginId, settings: { relationDefinitions: ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling'] } });
          // The vault is shared by every suite in this worker, and the index suite counts every relation in it.
          for (const note of notes) {
            await app.fileManager.trashFile(note);
          }
        }
      },
      input: { pluginId: PLUGIN_ID }
    });

    expect(result).toEqual([
      {
        isTargetResolved: true,
        label: 'aunt',
        sourcePath: 'API Kid.md',
        steps: [
          expect.objectContaining({ direction: 'incoming', label: 'parent', sourcePath: 'API Dad.md', targetPath: 'API Kid.md' }),
          expect.objectContaining({ direction: 'outgoing', label: 'sibling', sourcePath: 'API Dad.md', targetPath: 'API Aunt.md' })
        ],
        targetPath: 'API Aunt.md'
      }
    ]);
  });
});

import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { RelationIndexComponent } from './relation-index-component.ts';

import { RebuildRelationIndexCommandHandler } from './rebuild-relation-index-command-handler.ts';

describe('RebuildRelationIndexCommandHandler', () => {
  it('rebuilds the index and reports what it found', async () => {
    const rebuild = vi.fn(async () => {
      await noopAsync();
    });
    const showNotice = vi.fn();
    const handler = new RebuildRelationIndexCommandHandler({
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
      relationIndex: strictProxy<RelationIndexComponent>({
        getStats: () => ({ noteCount: 3, relationCount: 4 }),
        rebuild
      })
    });

    const command = handler.buildCommand();
    expect(command.id).toBe('rebuild-relation-index');
    expect(command.name).toBe('Rebuild relation index');
    expect(command.checkCallback?.(true)).toBe(true);
    expect(rebuild).not.toHaveBeenCalled();

    command.checkCallback?.(false);
    await vi.waitFor(() => {
      expect(showNotice).toHaveBeenCalledWith('Indexed 4 relation(s) in 3 note(s).');
    });
    expect(rebuild).toHaveBeenCalledOnce();
  });
});

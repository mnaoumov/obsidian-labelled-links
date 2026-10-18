import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { RELATIONS_VIEW_TYPE } from '../views/relations-view.ts';
import { OpenRelationsPaneCommandHandler } from './open-relations-pane-command-handler.ts';

describe('OpenRelationsPaneCommandHandler', () => {
  it('opens or reveals the relations pane in the right sidebar', async () => {
    const app = App.createConfigured__().asOriginalType__();
    const ensureSideLeaf = vi.spyOn(app.workspace, 'ensureSideLeaf');
    const handler = new OpenRelationsPaneCommandHandler({ app });

    const command = handler.buildCommand();
    expect(command.id).toBe('open-relations-pane');
    expect(command.name).toBe('Open relations pane');
    expect(command.checkCallback?.(true)).toBe(true);
    expect(ensureSideLeaf).not.toHaveBeenCalled();

    command.checkCallback?.(false);
    await vi.waitFor(() => {
      expect(ensureSideLeaf).toHaveBeenCalledWith(RELATIONS_VIEW_TYPE, 'right', { reveal: true });
    });
  });
});

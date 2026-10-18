import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { Plugin as ObsidianPlugin } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { Plugin } from './plugin.ts';
import { RelationIndexComponent } from './relation-index-component.ts';
import {
  RELATIONS_VIEW_TYPE,
  RelationsView
} from './views/relations-view.ts';

interface AppGlobal {
  app: AppOriginal;
}

interface PluginWithSettings {
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

const manifest = castTo<PluginManifest>({
  author: 'test',
  description: 'test',
  id: 'labelled-links',
  minAppVersion: '1.0.0',
  name: 'Labelled Links',
  version: '1.0.0'
});

let app: AppOriginal;

describe('Plugin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    app = App.createConfigured__({ files: { 'Alice.md': 'employee:: [[Bob]]\n', 'Bob.md': '# Bob\n' } }).asOriginalType__();
    // Expose the app as the global instance so library helpers that resolve the app without an explicit argument read this one.
    castTo<AppGlobal>(window).app = app;
  });

  it('extends the Obsidian Plugin class', () => {
    expect(Plugin.prototype).toBeInstanceOf(ObsidianPlugin);
  });

  it('registers the open pane, rebuild and open demo vault commands', async () => {
    const plugin = new Plugin(app, manifest);
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');
    await plugin.onload();
    expect(addCommandSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'open-relations-pane' }));
    expect(addCommandSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'rebuild-relation-index' }));
    expect(addCommandSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'open-demo-vault' }));
  });

  it('registers the relations pane, which the open pane command shows', async () => {
    const plugin = new Plugin(app, manifest);
    const registerViewSpy = vi.spyOn(plugin, 'registerView');
    const registerHoverLinkSourceSpy = vi.spyOn(plugin, 'registerHoverLinkSource');
    await plugin.onload();
    expect(registerViewSpy).toHaveBeenCalledWith(RELATIONS_VIEW_TYPE, expect.any(Function));
    // eslint-disable-next-line unicorn/name-replacements -- `defaultMod` is an Obsidian `registerHoverLinkSource` info member name.
    expect(registerHoverLinkSourceSpy).toHaveBeenCalledWith(RELATIONS_VIEW_TYPE, { defaultMod: true, display: 'Labelled Links' });

    const leaf = await app.workspace.ensureSideLeaf(RELATIONS_VIEW_TYPE, 'right');
    expect(leaf.view).toBeInstanceOf(RelationsView);
  });

  it('gives the index the registry from the settings, and a new one whenever they are saved', async () => {
    const setRegistrySpy = vi.spyOn(RelationIndexComponent.prototype, 'setRegistry');
    const plugin = new Plugin(app, manifest);
    await plugin.onload();
    const callCount = setRegistrySpy.mock.calls.length;
    expect(callCount).toBeGreaterThan(0);
    expect(setRegistrySpy.mock.calls.at(-1)?.[0].getInverseLabel('child')).toBe('parent');

    await castTo<PluginWithSettings>(plugin).pluginSettingsComponent.editAndSave((settings) => {
      settings.relationDefinitions = ['employee <-> employer'];
    });
    await vi.waitFor(() => {
      expect(setRegistrySpy.mock.calls.length).toBeGreaterThan(callCount);
    });
    expect(setRegistrySpy.mock.calls.at(-1)?.[0].getInverseLabel('employee')).toBe('employer');
  });
});

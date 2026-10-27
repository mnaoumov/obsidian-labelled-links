import type { PluginApiDeclaration } from '@mnaoumov/obsidian-lib/plugin/plugin-api';
import type {
  App as AppOriginal,
  MarkdownPostProcessorContext,
  PluginManifest
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
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

import { LabelledLinksApiImpl } from './plugin-api/labelled-links-api-impl.ts';
import {
  PLUGIN_API_CONTRACT,
  PLUGIN_API_VERSION,
  RELATIONS_CHANGED_EVENT_NAME
} from './plugin-api/labelled-links-api.ts';
import { Plugin } from './plugin.ts';
import { RelationIndexComponent } from './relation-index/relation-index-component.ts';
import {
  RELATIONS_VIEW_TYPE,
  RelationsView
} from './relations-pane/relations-view.ts';

interface AppGlobal {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Test setup replaces the global app before each test.
  app: AppOriginal;
}

interface PluginApisReader {
  readonly getPluginApis: () => PluginApiDeclaration[];
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

  it('registers the link badges for Live Preview and Reading view', async () => {
    const plugin = new Plugin(app, manifest);
    const registerEditorExtensionSpy = vi.spyOn(plugin, 'registerEditorExtension');
    const registerMarkdownPostProcessorSpy = vi.spyOn(plugin, 'registerMarkdownPostProcessor');
    await plugin.onload();
    expect(registerEditorExtensionSpy).toHaveBeenCalledTimes(1);
    expect(registerMarkdownPostProcessorSpy).toHaveBeenCalledTimes(1);

    const postProcessor = ensureNonNullable(registerMarkdownPostProcessorSpy.mock.calls[0]?.[0]);
    const el = createDiv();
    await postProcessor(el, strictProxy<MarkdownPostProcessorContext>({ getSectionInfo: () => null, sourcePath: 'Alice.md' }));
    expect(el.childElementCount).toBe(0);
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

  it('declares no api before it has loaded, and the relations api once it has', async () => {
    const plugin = new Plugin(app, manifest);
    expect(castTo<PluginApisReader>(plugin).getPluginApis()).toEqual([]);
    await plugin.onload();
    const declarations = castTo<PluginApisReader>(plugin).getPluginApis();
    expect(declarations).toHaveLength(1);
    expect(declarations[0]?.api).toBeInstanceOf(LabelledLinksApiImpl);
    expect(declarations[0]?.apiVersion).toBe(PLUGIN_API_VERSION);
    expect(declarations[0]?.contract).toBe(PLUGIN_API_CONTRACT);
  });

  it('re-triggers the index changes on the workspace with a plain-data payload until it unloads', async () => {
    const onSpy = vi.spyOn(RelationIndexComponent.prototype, 'on');
    const offrefSpy = vi.spyOn(RelationIndexComponent.prototype, 'offref');
    const triggerSpy = vi.spyOn(app.workspace, 'trigger');
    const plugin = new Plugin(app, manifest);
    plugin.load();
    await vi.waitFor(() => {
      expect(castTo<PluginApisReader>(plugin).getPluginApis()).toHaveLength(1);
    });

    const callbacks = onSpy.mock.calls.map(([, callback]) => callback);
    for (const callback of callbacks) {
      callback(['Alice.md']);
    }
    expect(triggerSpy).toHaveBeenCalledWith(RELATIONS_CHANGED_EVENT_NAME, { paths: ['Alice.md'] });
    for (const callback of callbacks) {
      callback(null);
    }
    expect(triggerSpy).toHaveBeenCalledWith(RELATIONS_CHANGED_EVENT_NAME, { paths: null });

    plugin.unload();
    expect(offrefSpy).toHaveBeenCalled();
  });
});

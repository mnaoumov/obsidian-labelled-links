import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventMap } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettingsComponent', () => {
  it('takes its defaults from the PluginSettings class', async () => {
    const component = createComponent(undefined);
    await component.loadWithPromises();
    expect(component.settings).toBeInstanceOf(PluginSettings);
    expect(component.settings.relationDefinitions).toStrictEqual(['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling']);
  });

  // This drives the component through the lifecycle Obsidian does: `load()` reads `data.json`, and a
  // Value the user saved there has to win over the class default.
  it('loads a saved setting from data.json over its default', async () => {
    const component = createComponent({ relationDefinitions: ['employee <-> employer'] });
    await component.loadWithPromises();
    expect(component.settings.relationDefinitions).toStrictEqual(['employee <-> employer']);
  });

  it('builds the relation registry from the current settings', async () => {
    const component = createComponent({ relationDefinitions: ['employee <-> employer', 'boss = employer -> employer'] });
    await component.loadWithPromises();
    const registry = component.createRelationRegistry();
    expect(registry.getInverseLabel('employer')).toBe('employee');
    expect(registry.getRule('boss')?.chains).toStrictEqual([['employer', 'employer']]);
  });

  it('rejects a registry with a malformed or repeated line, naming each one', async () => {
    const component = createComponent(undefined);
    await component.loadWithPromises();
    expect(await component.setProperty('relationDefinitions', ['employee <->', 'spouse', 'spouse'])).toBe(
      '"employee <->" is not a definition. Write "label <-> inverse", "label <-> label" or a lone "label".\n'
        + '"spouse" defines "spouse" again. Each label can be defined once.'
    );
  });

  it('accepts a valid registry', async () => {
    const component = createComponent(undefined);
    await component.loadWithPromises();
    expect(await component.setProperty('relationDefinitions', ['employee <-> employer'])).toBe('');
  });
});

function createComponent(data: unknown): PluginSettingsComponent {
  const dataHandler: DataHandler = {
    loadData(): Promise<unknown> {
      return Promise.resolve(data);
    },
    saveData(): Promise<void> {
      return noopAsync();
    }
  };

  return new PluginSettingsComponent({
    dataHandler,
    pluginEventSource: new AsyncEvents<PluginEventMap>()
  });
}

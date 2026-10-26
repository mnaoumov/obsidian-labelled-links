import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventMap } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { SettingGroup } from 'obsidian';

import { SettingEx } from '@mnaoumov/obsidian-lib/setting-ex';
import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { Plugin } from './plugin.ts';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

class MockDataHandler implements DataHandler {
  public async loadData(): Promise<unknown> {
    await noopAsync();
    return {};
  }

  public async saveData(): Promise<void> {
    await noopAsync();
  }
}

async function createTab(): Promise<PluginSettingsTab> {
  const app = App.createConfigured__();
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: new MockDataHandler(),
    pluginEventSource: new AsyncEvents<PluginEventMap>()
  });
  await pluginSettingsComponent.loadWithPromises();
  const plugin = strictProxy<Plugin>({ app: app.asOriginalType__() });
  return new PluginSettingsTab({ plugin, pluginSettingsComponent });
}

/**
 * Renders the rows the way Obsidian does when the tab opens: rows whose `visible` predicate is false are
 * skipped, every other row is named, described and rendered.
 *
 * @param tab - The settings tab.
 * @returns The rendered settings, one per row.
 */
function renderRows(tab: PluginSettingsTab): SettingEx[] {
  const settings: SettingEx[] = [];
  for (const definition of tab.getSettingDefinitions()) {
    if (!('render' in definition) || definition.visible === false) {
      continue;
    }
    const setting = new SettingEx(tab.containerEl);
    setting.setName(definition.name);
    if (definition.desc !== undefined) {
      setting.setDesc(definition.desc);
    }
    definition.render(setting, castTo<SettingGroup>(null));
    settings.push(setting);
  }
  return settings;
}

describe('PluginSettingsTab', () => {
  it('declares the relation registry row', async () => {
    const tab = await createTab();
    expect(tab.getSettingDefinitions().map((definition) => 'name' in definition ? definition.name : '')).toStrictEqual(['Relation registry']);
  });

  it('renders the registry as a multi-line text area showing one definition per line', async () => {
    const tab = await createTab();
    const [setting] = renderRows(tab);
    const textArea = setting?.controlEl.querySelector('textarea');
    expect(textArea?.rows).toBe(8);
    expect(textArea?.hasClass('labelled-links-registry')).toBe(true);
    expect(setting?.descEl.textContent).toContain('employee <-> employer');
  });

  it('shows the registry examples as rendered inline code', async () => {
    const tab = await createTab();
    const [setting] = renderRows(tab);
    const codeEls = [...setting?.descEl.querySelectorAll('code') ?? []];
    expect(codeEls.map((codeEl) => codeEl.textContent)).toStrictEqual(['employee <-> employer', 'spouse <-> spouse', 'mentions', 'aunt = parent -> sibling', '|']);
    expect(codeEls.every((codeEl) => codeEl.parentElement?.matches('.markdown-rendered.code'))).toBe(true);
  });
});

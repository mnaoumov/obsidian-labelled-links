import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventMap } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { SettingGroup } from 'obsidian';

import { SettingEx } from '@mnaoumov/obsidian-lib/setting-ex';
import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App,
  ToggleComponent
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from './plugin.ts';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { FAMILY_PRESET } from './relation-registry/relation-presets.ts';

interface TabFixture {
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly tab: PluginSettingsTab;
}

class MockDataHandler implements DataHandler {
  public constructor(private readonly data: unknown) {}

  public async loadData(): Promise<unknown> {
    await noopAsync();
    return this.data;
  }

  public async saveData(): Promise<void> {
    await noopAsync();
  }
}

async function createTab(data: unknown = {}): Promise<TabFixture> {
  const app = App.createConfigured__();
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: new MockDataHandler(data),
    pluginEventSource: new AsyncEvents<PluginEventMap>()
  });
  await pluginSettingsComponent.loadWithPromises();
  const plugin = strictProxy<Plugin>({ app: app.asOriginalType__() });
  return { pluginSettingsComponent, tab: new PluginSettingsTab({ plugin, pluginSettingsComponent }) };
}

function getToggle(setting: SettingEx | undefined): ToggleComponent {
  const toggle = setting?.components.find((component) => component instanceof ToggleComponent);
  if (!(toggle instanceof ToggleComponent)) {
    throw new TypeError('The setting has no toggle.');
  }
  return toggle;
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
  it('declares the relation registry row and a row per bundled preset', async () => {
    const { tab } = await createTab();
    expect(tab.getSettingDefinitions().map((definition) => 'name' in definition ? definition.name : '')).toStrictEqual(['Relation registry', 'Family preset']);
  });

  it('renders the registry as a multi-line text area showing one definition per line', async () => {
    const { tab } = await createTab();
    const [setting] = renderRows(tab);
    const textArea = setting?.controlEl.querySelector('textarea');
    expect(textArea?.rows).toBe(8);
    expect(textArea?.hasClass('labelled-links-registry')).toBe(true);
    expect(setting?.descEl.textContent).toContain('employee <-> employer');
  });

  it('shows the registry examples as rendered inline code', async () => {
    const { tab } = await createTab();
    const [setting] = renderRows(tab);
    const codeEls = [...setting?.descEl.querySelectorAll('code') ?? []];
    expect(codeEls.map((codeEl) => codeEl.textContent)).toStrictEqual([
      'employee <-> employer',
      'spouse <-> spouse',
      'mentions',
      'aunt = parent -> sibling',
      '|',
      'spouse = partnership[!divorceDate] -> partner',
      '!',
      '[status: retired]',
      'stepParent = parent -> spouse except parent',
      'birthMother < mother',
      'parent @ gender: female -> mother, male -> father'
    ]);
    expect(codeEls.every((codeEl) => codeEl.parentElement?.matches('.markdown-rendered.code'))).toBe(true);
  });

  it('lists a preset\'s version and lines, marking the ones the user\'s registry overrides', async () => {
    const { tab } = await createTab({ relationDefinitions: ['parent <-> kid'] });
    const [, setting] = renderRows(tab);
    expect(setting?.descEl.textContent).toContain(`Version ${FAMILY_PRESET.version}.`);
    const itemEls = [...setting?.descEl.querySelectorAll(':scope .labelled-links-preset-lines li') ?? []];
    expect(itemEls.map((itemEl) => itemEl.querySelector('code')?.textContent)).toStrictEqual(FAMILY_PRESET.lines);
    expect(itemEls.filter((itemEl) => itemEl.hasClass('labelled-links-preset-line-overridden')).map((itemEl) => itemEl.querySelector('code')?.textContent))
      .toStrictEqual(['parent <-> child']);
  });

  it('includes a preset when its toggle is switched on, and removes it when switched off', async () => {
    const { pluginSettingsComponent, tab } = await createTab();
    const [, setting] = renderRows(tab);
    const toggle = getToggle(setting);
    expect(toggle.getValue()).toBe(false);

    // The bound toggle writes the setting asynchronously.
    toggle.setValue(true);
    await vi.waitFor(() => {
      expect(pluginSettingsComponent.settings.includedPresets).toStrictEqual(['family']);
    });

    toggle.setValue(false);
    await vi.waitFor(() => {
      expect(pluginSettingsComponent.settings.includedPresets).toStrictEqual([]);
    });
  });
});

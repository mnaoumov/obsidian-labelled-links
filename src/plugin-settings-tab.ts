import type { SettingDefinitionItem } from 'obsidian';

import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

// Prefixes the registry examples, which are syntax rather than UI text, so the sentence-case rule skips them.
const EMPTY = '';

const REGISTRY_TEXT_AREA_ROWS = 8;

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingEx({
        desc: createFragment((fragment) => {
          fragment.appendText('One definition per line. ');
          fragment.createEl('code', { text: `${EMPTY}employee <-> employer` });
          fragment.appendText(' is a pair: a link labelled employee is shown as employer from the other end. ');
          fragment.createEl('code', { text: `${EMPTY}spouse <-> spouse` });
          fragment.appendText(' is a symmetric label. A lone ');
          fragment.createEl('code', { text: `${EMPTY}mentions` });
          fragment.appendText(' has no inverse, so it is shown as itself from both ends, like every label not listed here. Inverse labels are never written into your notes.');
        }),
        name: 'Relation registry',
        render: (setting) => {
          setting.addMultipleText((multipleText) => {
            this.bind({ propertyName: 'relationDefinitions', valueComponent: multipleText });
            multipleText.inputEl.rows = REGISTRY_TEXT_AREA_ROWS;
          });
        }
      })
    ];
  }
}

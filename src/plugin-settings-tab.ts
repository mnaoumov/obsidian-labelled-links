import type { SettingDefinitionItem } from 'obsidian';

import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

const REGISTRY_TEXT_AREA_ROWS = 8;

/**
 * The registry field's class, which widens it so a pair like `employee <-> employer` fits on its line.
 */
const REGISTRY_TEXT_AREA_CLASS = 'labelled-links-registry';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingEx({
        desc: createFragment((fragment) => {
          fragment.appendText('One definition per line. ');
          appendCodeBlock(fragment, 'employee <-> employer');
          fragment.appendText(' is a pair: a link labelled employee is shown as employer from the other end. ');
          appendCodeBlock(fragment, 'spouse <-> spouse');
          fragment.appendText(' is a symmetric label. A lone ');
          appendCodeBlock(fragment, 'mentions');
          fragment.appendText(' has no inverse, so it is shown as itself from both ends, like every label not listed here. ');
          appendCodeBlock(fragment, 'aunt = parent -> sibling');
          fragment.appendText(' is a rule: a note\'s parent\'s sibling is shown as its aunt. Separate alternative chains with ');
          appendCodeBlock(fragment, '|');
          fragment.appendText('. ');
          appendCodeBlock(fragment, 'birthMother < mother');
          fragment.appendText(' makes a label a kind of another: a query for mother can ask to include birthMother links too. ');
          fragment.appendText('Inverse labels and derived relations are never written into your notes.');
        }),
        name: 'Relation registry',
        render: (setting) => {
          setting.addMultipleText((multipleText) => {
            this.bind({ propertyName: 'relationDefinitions', valueComponent: multipleText });
            multipleText.inputEl.rows = REGISTRY_TEXT_AREA_ROWS;
            multipleText.inputEl.addClass(REGISTRY_TEXT_AREA_CLASS);
          });
        }
      })
    ];
  }
}

import type { SettingDefinitionItem } from 'obsidian';

import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';
import type { RelationPreset } from './relation-presets.ts';

import {
  getOverriddenPresetLines,
  RELATION_PRESETS,
  togglePreset
} from './relation-presets.ts';

const REGISTRY_TEXT_AREA_ROWS = 8;

/**
 * The registry field's class, which widens it so a pair like `employee <-> employer` fits on its line.
 */
const REGISTRY_TEXT_AREA_CLASS = 'labelled-links-registry';

/**
 * The class of the list of a preset's lines.
 */
const PRESET_LINES_CLASS = 'labelled-links-preset-lines';

/**
 * The class of a preset line the user's own registry overrides.
 */
const OVERRIDDEN_PRESET_LINE_CLASS = 'labelled-links-preset-line-overridden';

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
          appendCodeBlock(fragment, 'spouse = partnership[!divorceDate] -> partner');
          fragment.appendText(' keeps only the notes a step reaches whose property is set, or with ');
          appendCodeBlock(fragment, '!');
          fragment.appendText(' is not, or holds a value: ');
          appendCodeBlock(fragment, '[status: retired]');
          fragment.appendText('. ');
          appendCodeBlock(fragment, 'stepParent = parent -> spouse except parent');
          fragment.appendText(' leaves out the notes already related by the labels after except. ');
          appendCodeBlock(fragment, 'birthMother < mother');
          fragment.appendText(' makes a label a kind of another: a query for mother can ask to include birthMother links too. ');
          appendCodeBlock(fragment, 'parent @ gender: female -> mother, male -> father');
          fragment.appendText(' shows a parent as mother or father by the gender property of the note it describes. ');
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
      }),
      ...RELATION_PRESETS.map((preset) => this.presetSetting(preset))
    ];
  }

  private presetSetting(preset: RelationPreset): SettingDefinitionItem {
    return this.settingEx({
      desc: createFragment((fragment) => {
        fragment.appendText(`${preset.description} Version ${preset.version}. `);
        fragment.appendText('Its lines are read after your registry, so a line of yours defining the same label wins.');
      }),
      name: `${preset.name} preset`,
      render: (setting) => {
        setting.addToggle((toggle) => {
          this.bind({
            componentToPluginSettingsValueConverter: (isIncluded: boolean) => togglePreset(this.pluginSettingsComponent.settings.includedPresets, preset.id, isIncluded),
            pluginSettingsToComponentValueConverter: (includedPresets) => includedPresets.includes(preset.id),
            propertyName: 'includedPresets',
            valueComponent: toggle
          });
        });

        const overriddenLines = new Set(getOverriddenPresetLines(this.pluginSettingsComponent.settings.relationDefinitions, preset));
        const listEl = setting.descEl.createEl('ul', { cls: PRESET_LINES_CLASS });
        for (const line of preset.lines) {
          const itemEl = listEl.createEl('li');
          appendCodeBlock(itemEl, line);
          if (!overriddenLines.has(line)) {
            continue;
          }

          itemEl.addClass(OVERRIDDEN_PRESET_LINE_CLASS);
          itemEl.appendText(' (your registry defines this label, so your line is used)');
        }
      }
    });
  }
}

import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import { PluginSettingsComponentBase } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';

import { PluginSettings } from './plugin-settings.ts';
import { getIncludedPresetLines } from './relation-presets.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

interface PluginSettingsComponentConstructorParams {
  readonly dataHandler: DataHandler;
  readonly pluginEventSource: PluginEventSource;
}

/**
 * Owns the plugin's settings: loading them from `data.json`, saving them back, and telling the rest of
 * the plugin when they change.
 */
export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  public constructor(params: PluginSettingsComponentConstructorParams) {
    super({
      ...params,
      pluginSettingsClass: PluginSettings
    });
  }

  /**
   * Builds the relation registry from the current settings: the user's lines, then the included presets' lines,
   * so a user's line wins over a preset line defining the same label. Lines that fail validation are left out.
   *
   * @returns The registry.
   */
  public createRelationRegistry(): RelationRegistry {
    const { definitions, labelVariants, rules, subLabels } = parseRelationDefinitions([
      ...this.settings.relationDefinitions,
      ...getIncludedPresetLines(this.settings.includedPresets)
    ]);
    return new RelationRegistry(definitions, rules, subLabels, labelVariants);
  }

  protected override registerValidators(): void {
    super.registerValidators();
    this.registerValidator('relationDefinitions', (relationDefinitions) => parseRelationDefinitions(relationDefinitions).errors.join('\n') || undefined);
  }
}

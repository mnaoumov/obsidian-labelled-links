import type { Editor } from 'obsidian';

import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import { Notice } from 'obsidian';

import { sampleStateField } from './editor-extensions/sample-state-field.ts';
import { sampleViewPlugin } from './editor-extensions/sample-view-plugin.ts';
import { SampleEditorSuggest } from './editor-suggests/sample-editor-suggest.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  protected override async onloadImpl(): Promise<void> {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.pluginSettingsComponent = pluginSettingsComponent;

    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent
        })
      })
    );

    this.addCommand({
      callback: this.runSampleCommand.bind(this),
      id: 'sample',
      name: 'Sample'
    });

    this.addCommand({
      editorCallback: this.runSampleEditorCommand.bind(this),
      id: 'sample-editor',
      name: 'Sample editor'
    });

    this.registerEditorExtension([sampleViewPlugin, sampleStateField]);

    this.registerEditorSuggest(new SampleEditorSuggest(this.app));

    // `OpenDemoVaultCommandHandler` is what makes the README's first demo-vault route real: it downloads
    // The `<plugin-id>-demo-vault.zip` attached to the GitHub release and opens it as a vault in
    // A new window. It is not registered automatically -- a demo vault without this command can only be
    // Reached by downloading the asset by hand. It hides itself on mobile, so no platform guard is needed.
    await this.commandHandlerComponent.registerCommandHandlers(() => [
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }

  private runSampleCommand(): void {
    new Notice('Sample command');
  }

  private runSampleEditorCommand(editor: Editor): void {
    editor.replaceSelection('Sample Editor Command');
  }
}

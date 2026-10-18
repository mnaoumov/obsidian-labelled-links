import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginHoverLinkSourceRegistrar } from '@mnaoumov/obsidian-lib/hover-link-source-registrar';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import { PluginViewRegistrar } from '@mnaoumov/obsidian-lib/view-registrar';

import { OpenRelationsPaneCommandHandler } from './command-handlers/open-relations-pane-command-handler.ts';
import { RebuildRelationIndexCommandHandler } from './command-handlers/rebuild-relation-index-command-handler.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { RelationIndexComponent } from './relation-index-component.ts';
import {
  RELATIONS_VIEW_TYPE,
  RelationsView
} from './views/relations-view.ts';

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

    const relationIndex = this.addChild(new RelationIndexComponent(this.app));
    function updateRegistry(): void {
      relationIndex.setRegistry(pluginSettingsComponent.createRelationRegistry());
    }
    pluginSettingsComponent.on('loadSettings', updateRegistry);
    pluginSettingsComponent.on('saveSettings', updateRegistry);
    updateRegistry();

    new PluginViewRegistrar(this).registerView({
      type: RELATIONS_VIEW_TYPE,
      viewCreator(leaf) {
        return new RelationsView({ leaf, relationIndex });
      }
    });
    new PluginHoverLinkSourceRegistrar(this).registerHoverLinkSource({
      id: RELATIONS_VIEW_TYPE,
      info: {
        // eslint-disable-next-line unicorn/name-replacements -- `defaultMod` is an Obsidian `registerHoverLinkSource` info member name.
        defaultMod: true,
        display: this.manifest.name
      }
    });

    // `OpenDemoVaultCommandHandler` is what makes the README's first demo-vault route real: it downloads
    // The `<plugin-id>-demo-vault.zip` attached to the GitHub release and opens it as a vault in
    // A new window. It is not registered automatically -- a demo vault without this command can only be
    // Reached by downloading the asset by hand. It hides itself on mobile, so no platform guard is needed.
    await this.commandHandlerComponent.registerCommandHandlers(() => [
      new OpenRelationsPaneCommandHandler({ app: this.app }),
      new RebuildRelationIndexCommandHandler({
        pluginNoticeComponent: this.pluginNoticeComponent,
        relationIndex
      }),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}

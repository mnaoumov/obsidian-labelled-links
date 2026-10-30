import type { PluginApiDeclaration } from '@mnaoumov/obsidian-lib/plugin/plugin-api';

import { OpenBugReportCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-bug-report-command-handler';
import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginEditorExtensionRegistrar } from '@mnaoumov/obsidian-lib/editor-extension-registrar';
import { PluginHoverLinkSourceRegistrar } from '@mnaoumov/obsidian-lib/hover-link-source-registrar';
import { PluginMarkdownPostProcessorRegistrar } from '@mnaoumov/obsidian-lib/markdown-post-processor-registrar';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import { PluginViewRegistrar } from '@mnaoumov/obsidian-lib/view-registrar';

import { LinkBadgeReadingViewComponent } from './link-badges/link-badge-reading-view-component.ts';
import { createLinkBadgeExtension } from './link-badges/link-badge-view-plugin.ts';
import { LabelledLinksApiImpl } from './plugin-api/labelled-links-api-impl.ts';
import {
  PLUGIN_API_CONTRACT,
  PLUGIN_API_VERSION,
  RELATIONS_CHANGED_EVENT_NAME
} from './plugin-api/labelled-links-api.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { RebuildRelationIndexCommandHandler } from './relation-index/rebuild-relation-index-command-handler.ts';
import { RelationIndexComponent } from './relation-index/relation-index-component.ts';
import { OpenRelationsPaneCommandHandler } from './relations-pane/open-relations-pane-command-handler.ts';
import {
  RELATIONS_VIEW_TYPE,
  RelationsView
} from './relations-pane/relations-view.ts';

export class Plugin extends PluginBase {
  private labelledLinksApi: LabelledLinksApiImpl | null = null;

  /**
   * Declares the API for the base to publish, once `onloadImpl` has built it.
   *
   * Published by the base rather than by hand: the `plugin-loaded` broadcast's `apiVersions` is derived
   * from this method alone, so a hand `publishPluginApi` call would announce this plugin as publishing no
   * API at all.
   *
   * @returns The declaration, or none before the plugin has loaded.
   */
  protected override getPluginApis(): PluginApiDeclaration[] {
    return this.labelledLinksApi
      ? [
        {
          api: this.labelledLinksApi,
          apiVersion: PLUGIN_API_VERSION,
          contract: PLUGIN_API_CONTRACT
        }
      ]
      : [];
  }

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

    // Other plugins share no code with this one, so the index's own event is re-triggered on the workspace,
    // With a plain-data payload, under the name `api.d.ts` publishes.
    const relationsChangedEventRef = relationIndex.on('changed', (paths) => {
      this.app.workspace.trigger(RELATIONS_CHANGED_EVENT_NAME, { paths: paths === null ? null : [...paths] });
    });
    this.register(() => {
      relationIndex.offref(relationsChangedEventRef);
    });
    this.labelledLinksApi = new LabelledLinksApiImpl(relationIndex);

    new PluginEditorExtensionRegistrar(this).registerEditorExtension(createLinkBadgeExtension(relationIndex));
    const linkBadgeReadingViewComponent = this.addChild(new LinkBadgeReadingViewComponent({ app: this.app, relationIndex }));
    new PluginMarkdownPostProcessorRegistrar(this).registerMarkdownPostProcessor({
      postProcessor: linkBadgeReadingViewComponent.postProcess.bind(linkBadgeReadingViewComponent)
    });

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
      new OpenBugReportCommandHandler({
        app: this.app,
        gitHubRepo: 'mnaoumov/obsidian-labelled-links',
        pluginId: this.manifest.id
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

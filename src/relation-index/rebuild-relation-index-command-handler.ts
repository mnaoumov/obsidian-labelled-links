import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { RelationIndexComponent } from './relation-index-component.ts';

interface RebuildRelationIndexCommandHandlerConstructorParams {
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly relationIndex: RelationIndexComponent;
}

/**
 * Reads every note again and rebuilds the relation index, then says how much it found. The index keeps
 * itself current, so this is for when it looks wrong rather than a step anyone has to take.
 */
export class RebuildRelationIndexCommandHandler extends GlobalCommandHandler {
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly relationIndex: RelationIndexComponent;

  public constructor(params: RebuildRelationIndexCommandHandlerConstructorParams) {
    super({
      icon: 'refresh-cw',
      id: 'rebuild-relation-index',
      name: 'Rebuild relation index'
    });
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.relationIndex = params.relationIndex;
  }

  protected override async execute(): Promise<void> {
    await this.relationIndex.rebuild();
    const { noteCount, relationCount } = this.relationIndex.getStats();
    this.pluginNoticeComponent.showNotice(`Indexed ${String(relationCount)} relation(s) in ${String(noteCount)} note(s).`);
  }
}

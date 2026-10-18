import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import { RELATIONS_VIEW_TYPE } from '../views/relations-view.ts';

interface OpenRelationsPaneCommandHandlerConstructorParams {
  readonly app: App;
}

/**
 * Opens the relations pane in the right sidebar, or reveals it when it is already open. On mobile the right
 * sidebar is the right drawer, so the same command slides it in.
 */
export class OpenRelationsPaneCommandHandler extends GlobalCommandHandler {
  private readonly app: App;

  public constructor(params: OpenRelationsPaneCommandHandlerConstructorParams) {
    super({
      icon: 'arrow-right-left',
      id: 'open-relations-pane',
      name: 'Open relations pane'
    });
    this.app = params.app;
  }

  protected override async execute(): Promise<void> {
    await this.app.workspace.ensureSideLeaf(RELATIONS_VIEW_TYPE, 'right', { reveal: true });
  }
}

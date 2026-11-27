import type {
  HoverParent,
  HoverPopover,
  IconName,
  TFile,
  ViewStateResult,
  WorkspaceLeaf
} from 'obsidian';

import { convertAsyncToSync } from '@mnaoumov/typescript-lib/async';
import { ItemView } from 'obsidian';

import type { RelationIndexComponent } from '../relation-index/relation-index-component.ts';

import {
  RELATION_LIST_HOVER_SOURCE,
  RelationListRenderer
} from './relation-list-renderer.ts';

/**
 * The view type the relations pane is registered under. It is also the hover source its rows, and the code block's,
 * fire page previews from.
 */
export const RELATIONS_VIEW_TYPE = RELATION_LIST_HOVER_SOURCE;

interface RelationsViewConstructorParams {
  readonly leaf: WorkspaceLeaf;
  readonly relationIndex: RelationIndexComponent;
}

/**
 * The relations pane: every relation of the active note, outgoing and incoming, grouped by label, plus its
 * plain links and backlinks with the line each one sits on, drawn by {@link RelationListRenderer}.
 *
 * The relations the registry's composition rules derive follow, in a section of their own. The pane follows the
 * active note and redraws whenever the index reports a change that touches it.
 *
 * A header button switches the pane to the wide meaning of each label: a relation whose label the registry declares
 * as a kind of another (`birthMother < mother`) is listed in its widest superset's group, naming its own label,
 * and the derived section follows the sub-labels too. The choice is kept in the pane's view state.
 */
export class RelationsView extends ItemView implements HoverParent {
  public hoverPopover: HoverPopover | null = null;

  private file: null | TFile = null;
  private includeSubLabelsActionEl: HTMLElement | null = null;
  private readonly relationIndex: RelationIndexComponent;
  private readonly renderer: RelationListRenderer;
  private shouldIncludeSubLabels = false;

  /**
   * Creates the pane.
   *
   * @param params - The leaf the pane lives in and the index it reads.
   */
  public constructor(params: RelationsViewConstructorParams) {
    super(params.leaf);
    this.relationIndex = params.relationIndex;
    this.renderer = new RelationListRenderer({ app: this.app, hoverParent: this, relationIndex: params.relationIndex });
  }

  public override getDisplayText(): string {
    return 'Relations';
  }

  public override getIcon(): IconName {
    return 'arrow-right-left';
  }

  public override getState(): Record<string, unknown> {
    return { ...super.getState(), includeSubLabels: this.shouldIncludeSubLabels };
  }

  public override getViewType(): string {
    return RELATIONS_VIEW_TYPE;
  }

  /**
   * Draws the pane again for the note it shows.
   */
  public async refresh(): Promise<void> {
    const { contentEl, file } = this;
    this.renderer.cancel();
    contentEl.empty();
    contentEl.addClass('labelled-links-relations-view');

    if (!file) {
      contentEl.createDiv({ cls: 'pane-empty', text: 'Open a note to see its relations.' });
      return;
    }

    contentEl.createDiv({ cls: 'labelled-links-relations-title', text: file.basename });
    const sectionCount = await this.renderer.render({
      containerEl: contentEl,
      file,
      options: {
        hiddenLabels: [],
        shouldIncludeDerived: true,
        shouldIncludeSubLabels: this.shouldIncludeSubLabels,
        shouldIncludeUnlabelled: true,
        shownLabels: null
      }
    });
    if (sectionCount === 0) {
      contentEl.createDiv({ cls: 'pane-empty', text: 'This note has no relations, links or backlinks.' });
    }
  }

  /**
   * Shows the relations of another note.
   *
   * @param file - The note, or `null` to show none.
   */
  public async setFile(file: null | TFile): Promise<void> {
    this.file = file;
    await this.refresh();
  }

  /**
   * Switches the pane between the narrow and the wide meaning of each label.
   *
   * @param shouldIncludeSubLabels - Whether a sub-label's relations are listed in their widest superset's group.
   */
  public async setIncludeSubLabels(shouldIncludeSubLabels: boolean): Promise<void> {
    this.shouldIncludeSubLabels = shouldIncludeSubLabels;
    this.includeSubLabelsActionEl?.toggleClass('is-active', shouldIncludeSubLabels);
    this.includeSubLabelsActionEl?.setAttribute('aria-pressed', String(shouldIncludeSubLabels));
    await this.refresh();
  }

  public override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const shouldIncludeSubLabels = (state as null | Partial<Record<string, unknown>>)?.['includeSubLabels'];
    if (typeof shouldIncludeSubLabels === 'boolean' && shouldIncludeSubLabels !== this.shouldIncludeSubLabels) {
      await this.setIncludeSubLabels(shouldIncludeSubLabels);
    }
  }

  protected override async onOpen(): Promise<void> {
    this.includeSubLabelsActionEl = this.addAction(
      'list-tree',
      'Include sub-labels',
      convertAsyncToSync(async () => {
        await this.setIncludeSubLabels(!this.shouldIncludeSubLabels);
        this.app.workspace.requestSaveLayout();
      })
    );
    this.includeSubLabelsActionEl.setAttribute('aria-pressed', String(this.shouldIncludeSubLabels));
    this.registerEvent(this.app.workspace.on('file-open', convertAsyncToSync(this.setFile.bind(this))));
    const eventRef = this.relationIndex.on('changed', convertAsyncToSync(this.handleIndexChanged.bind(this)));
    this.register(() => {
      this.relationIndex.offref(eventRef);
    });
    await this.setFile(this.app.workspace.getActiveFile());
  }

  private async handleIndexChanged(paths: null | readonly string[]): Promise<void> {
    if (this.file && (paths === null || paths.includes(this.file.path))) {
      await this.refresh();
    }
  }
}

import type {
  App,
  HoverParent,
  HoverPopover,
  TFile
} from 'obsidian';

import { convertAsyncToSync } from '@mnaoumov/typescript-lib/async';
import { MarkdownRenderChild } from 'obsidian';

import type { RelationIndexComponent } from '../relation-index/relation-index-component.ts';
import type { RelationsCodeBlockParseResult } from './relations-code-block-options.ts';

import { RelationListRenderer } from '../relations-pane/relation-list-renderer.ts';
import { parseRelationsCodeBlockOptions } from './relations-code-block-options.ts';

/**
 * Params for the {@link RelationsCodeBlockComponent} constructor.
 */
export interface RelationsCodeBlockComponentConstructorParams {
  /**
   * The Obsidian app.
   */
  readonly app: App;

  /**
   * The element Obsidian rendered the code block into.
   */
  readonly containerEl: HTMLElement;

  /**
   * The index the block reads.
   */
  readonly relationIndex: RelationIndexComponent;

  /**
   * The code block's source.
   */
  readonly source: string;

  /**
   * The path of the note holding the block.
   */
  readonly sourcePath: string;
}

/**
 * A `labelled-links` code block: the relations of a note listed inside another note, or inside itself, grouped by
 * label like the relations pane, so an infobox or a character sheet shows them with the pane closed.
 *
 * The block's options (see {@link parseRelationsCodeBlockOptions}) pick the note and the labels. It redraws when the
 * index reports a change that touches the note it lists, and stops listening once Obsidian unloads it.
 */
export class RelationsCodeBlockComponent extends MarkdownRenderChild implements HoverParent {
  public hoverPopover: HoverPopover | null = null;

  private readonly app: App;
  private readonly parseResult: RelationsCodeBlockParseResult;
  private readonly relationIndex: RelationIndexComponent;
  private readonly renderer: RelationListRenderer;
  private shownPath: null | string = null;
  private readonly sourcePath: string;

  /**
   * Creates the block.
   *
   * @param params - The app, the element, the index, the block's source and the note holding it.
   */
  public constructor(params: RelationsCodeBlockComponentConstructorParams) {
    super(params.containerEl);
    this.app = params.app;
    this.relationIndex = params.relationIndex;
    this.sourcePath = params.sourcePath;
    this.parseResult = parseRelationsCodeBlockOptions(params.source);
    this.renderer = new RelationListRenderer({ app: params.app, hoverParent: this, relationIndex: params.relationIndex });
  }

  public override onload(): void {
    super.onload();
    const eventRef = this.relationIndex.on('changed', convertAsyncToSync(this.handleIndexChanged.bind(this)));
    this.register(() => {
      this.relationIndex.offref(eventRef);
    });
    convertAsyncToSync(this.refresh.bind(this))();
  }

  /**
   * Draws the block again.
   */
  public async refresh(): Promise<void> {
    const { containerEl } = this;
    this.renderer.cancel();
    containerEl.empty();
    containerEl.addClass('labelled-links-relations-view', 'labelled-links-relations-code-block');

    const { errors, options } = this.parseResult;
    if (errors.length > 0) {
      const errorEl = containerEl.createDiv({ cls: 'labelled-links-relations-code-block-error' });
      errorEl.createDiv({ text: 'This block could not be read:' });
      const listEl = errorEl.createEl('ul');
      for (const error of errors) {
        listEl.createEl('li', { text: error });
      }
      return;
    }

    const file = this.resolveFile(options.center);
    this.shownPath = file?.path ?? null;
    if (!file) {
      containerEl.createDiv({ cls: 'pane-empty', text: `No note matches "${options.center ?? this.sourcePath}".` });
      return;
    }

    const sectionCount = await this.renderer.render({ containerEl, file, options });
    if (sectionCount === 0) {
      containerEl.createDiv({ cls: 'pane-empty', text: `${file.basename} has no relations to list here.` });
    }
  }

  private async handleIndexChanged(paths: null | readonly string[]): Promise<void> {
    // A block whose note did not resolve may resolve after any change: the note may just have been created.
    if (paths === null || this.shownPath === null || paths.includes(this.shownPath)) {
      await this.refresh();
    }
  }

  private resolveFile(center: null | string): null | TFile {
    return center === null
      ? this.app.vault.getFileByPath(this.sourcePath)
      : this.app.metadataCache.getFirstLinkpathDest(center, this.sourcePath);
  }
}

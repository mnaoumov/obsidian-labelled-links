import type {
  App,
  MarkdownPostProcessorContext
} from 'obsidian';

import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  Component,
  debounce,
  MarkdownView
} from 'obsidian';

import type { RelationIndexComponent } from '../relation-index/relation-index-component.ts';

import {
  createLinkBadgeEl,
  getLinkBadge,
  getPositionedRelations,
  isRelationInText
} from './link-badge.ts';

/**
 * How long a burst of index changes is collected before the reading views it touches are re-rendered.
 */
const RERENDER_DELAY_IN_MILLISECONDS = 300;

/**
 * Params for {@link LinkBadgeReadingViewComponent}.
 */
export interface LinkBadgeReadingViewComponentConstructorParams {
  readonly app: App;
  readonly relationIndex: RelationIndexComponent;
}

/**
 * The badges in Reading view. {@link LinkBadgeReadingViewComponent.postProcess} adds them to each rendered
 * section. A section rendered before the index knew its note carries no badges, so after the index changes, a
 * reading view whose note's badges now differ from the ones it was rendered with is rendered again.
 */
export class LinkBadgeReadingViewComponent extends Component {
  private readonly app: App;
  private readonly relationIndex: RelationIndexComponent;
  private readonly renderedBadgeKeys = new Map<string, string>();
  private readonly rerenderDebounced = debounce(this.rerenderOutdatedViews.bind(this), RERENDER_DELAY_IN_MILLISECONDS, true);

  /**
   * Creates the component.
   *
   * @param params - The app and the index the labels are read from.
   */
  public constructor(params: LinkBadgeReadingViewComponentConstructorParams) {
    super();
    this.app = params.app;
    this.relationIndex = params.relationIndex;
  }

  public override onload(): void {
    super.onload();
    const eventRef = this.relationIndex.on('changed', () => {
      this.rerenderDebounced();
    });
    this.register(() => {
      this.relationIndex.offref(eventRef);
      this.rerenderDebounced.cancel();
    });
  }

  /**
   * Adds a badge after each labelled link of one rendered section. A link is paired with the cached reference it
   * was rendered from by its target, in the order both are written.
   *
   * @param el - The rendered section.
   * @param context - The context, which knows the note and the lines the section was rendered from.
   */
  public postProcess(el: HTMLElement, context: MarkdownPostProcessorContext): void {
    const sectionInfo = context.getSectionInfo(el);
    if (!sectionInfo) {
      return;
    }

    const { lineEnd, lineStart, text } = sectionInfo;
    this.renderedBadgeKeys.set(context.sourcePath, this.getBadgeKey(context.sourcePath));
    const relations = getPositionedRelations(this.relationIndex, context.sourcePath).filter((relation) =>
      lineStart <= relation.reference.position.start.line
      && relation.reference.position.end.line <= lineEnd
      && isRelationInText(text, relation)
    );

    for (const linkEl of el.querySelectorAll<HTMLElement>('a.internal-link')) {
      if (linkEl.closest('.internal-embed')) {
        continue;
      }

      const href = linkEl.dataset['href'];
      const index = relations.findIndex((relation) => relation.reference.link === href);
      if (index === -1) {
        continue;
      }

      const relation = ensureNonNullable(relations.splice(index, 1)[0]);
      const badge = getLinkBadge(this.relationIndex, relation);
      if (badge) {
        linkEl.after(createLinkBadgeEl(badge));
      }
    }
  }

  /**
   * Gets a key that changes whenever the badges of a note would: a link moves, gains or loses a label, or its
   * tooltip changes.
   *
   * @param path - The note's path.
   * @returns The key.
   */
  private getBadgeKey(path: string): string {
    return getPositionedRelations(this.relationIndex, path)
      .map((relation) => {
        const badge = getLinkBadge(this.relationIndex, relation);
        return badge ? `${String(relation.reference.position.start.offset)}:${badge.label}:${badge.tooltip}` : '';
      })
      .join('\n');
  }

  private rerenderOutdatedViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const { view } = leaf;
      if (!(view instanceof MarkdownView) || view.getMode() !== 'preview' || !view.file) {
        continue;
      }

      const { path } = view.file;
      const badgeKey = this.getBadgeKey(path);
      if (this.renderedBadgeKeys.get(path) === badgeKey) {
        continue;
      }

      this.renderedBadgeKeys.set(path, badgeKey);
      view.previewMode.rerender(true);
    }
  }
}

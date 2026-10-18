import type {
  EditorState,
  Extension,
  StateField
} from '@codemirror/state';
import type {
  DecorationSet,
  EditorView,
  PluginValue,
  ViewUpdate
} from '@codemirror/view';
import type { AsyncEventRef } from '@mnaoumov/typescript-lib/async-events';
import type { MarkdownFileInfo } from 'obsidian';

import {
  RangeSetBuilder,
  StateEffect
} from '@codemirror/state';
import {
  Decoration,
  ViewPlugin,
  WidgetType
} from '@codemirror/view';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  editorInfoField,
  editorLivePreviewField
} from 'obsidian';

import type { LinkBadge } from '../link-badge.ts';
import type { RelationIndexComponent } from '../relation-index-component.ts';

import {
  createLinkBadgeEl,
  getLinkBadge,
  getPositionedRelations,
  isRelationInText
} from '../link-badge.ts';

/**
 * Asks the badges of one editor to be rebuilt from the index.
 */
const refreshLinkBadgesEffect = StateEffect.define();

// `obsidian`'s declarations resolve `@codemirror/state` to its CommonJS typings and this module to its ESM ones, so
// TypeScript sees two `StateField` classes where Obsidian loads one.
const markdownFileInfoField = castTo<StateField<MarkdownFileInfo>>(editorInfoField);
const livePreviewField = castTo<StateField<boolean>>(editorLivePreviewField);

class LinkBadgeViewPluginValue implements PluginValue {
  public decorations: DecorationSet;
  private readonly eventRef: AsyncEventRef;
  private filePath: null | string = null;
  private readonly relationIndex: RelationIndexComponent;

  public constructor(view: EditorView, relationIndex: RelationIndexComponent) {
    this.relationIndex = relationIndex;
    this.decorations = this.buildDecorations(view.state);
    this.eventRef = relationIndex.on('changed', (paths) => {
      const filePath = getFilePath(view.state);
      if (filePath !== null && (paths === null || paths.includes(filePath))) {
        view.dispatch({ effects: refreshLinkBadgesEffect.of(null) });
      }
    });
  }

  public destroy(): void {
    this.relationIndex.offref(this.eventRef);
  }

  public update(update: ViewUpdate): void {
    const shouldRebuild = getFilePath(update.state) !== this.filePath
      || isLivePreview(update.state) !== isLivePreview(update.startState)
      || update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshLinkBadgesEffect)));

    if (shouldRebuild) {
      this.decorations = this.buildDecorations(update.state);
    } else if (update.docChanged) {
      // The cache has not seen this edit yet, so the badges move with the text until the next `changed` event.
      this.decorations = this.decorations.map(update.changes);
    }
  }

  private buildDecorations(state: EditorState): DecorationSet {
    this.filePath = getFilePath(state);
    if (this.filePath === null || !isLivePreview(state)) {
      return Decoration.none;
    }

    const text = state.doc.toString();
    const builder = new RangeSetBuilder<Decoration>();
    for (const relation of getPositionedRelations(this.relationIndex, this.filePath)) {
      const badge = getLinkBadge(this.relationIndex, relation);
      if (badge === null || !isRelationInText(text, relation)) {
        continue;
      }

      const offset = relation.reference.position.end.offset;
      builder.add(offset, offset, Decoration.widget({ side: 1, widget: new LinkBadgeWidget(badge) }));
    }
    return builder.finish();
  }
}

class LinkBadgeWidget extends WidgetType {
  private readonly badge: LinkBadge;

  public constructor(badge: LinkBadge) {
    super();
    this.badge = badge;
  }

  public override eq(other: LinkBadgeWidget): boolean {
    return this.badge.label === other.badge.label && this.badge.tooltip === other.badge.tooltip;
  }

  public toDOM(): HTMLElement {
    return createLinkBadgeEl(this.badge);
  }
}

/**
 * Creates the Live Preview extension that shows a badge with the label after each labelled link.
 *
 * @param relationIndex - The index the labels are read from.
 * @returns The extension.
 */
export function createLinkBadgeExtension(relationIndex: RelationIndexComponent): Extension {
  return ViewPlugin.define((view) => new LinkBadgeViewPluginValue(view, relationIndex), {
    decorations: (value) => value.decorations
  });
}

function getFilePath(state: EditorState): null | string {
  return state.field(markdownFileInfoField, false)?.file?.path ?? null;
}

function isLivePreview(state: EditorState): boolean {
  return state.field(livePreviewField, false) ?? false;
}

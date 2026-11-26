/**
 * @file
 *
 * Suggests the registry's labels while one is typed where `Labelled Links` reads a label, so a label is picked rather
 * than retyped and misspelled.
 */

import type {
  App,
  Editor,
  EditorPosition,
  EditorSuggestContext,
  EditorSuggestTriggerInfo
} from 'obsidian';

import { EditorSuggest } from 'obsidian';

import type { RelationRegistry } from '../relation-registry/relation-registry.ts';

import { normalizeLabel } from '../relation-registry/relation-registry.ts';
import { findLabelSuggestContext } from './label-suggest-context.ts';

/**
 * Parameters for the {@link LabelSuggest} constructor.
 */
export interface LabelSuggestConstructorParams {
  /**
   * The Obsidian app.
   */
  readonly app: App;

  /**
   * Gets the current registry, read on every keystroke the suggest opens on.
   *
   * @returns The registry.
   */
  readonly getRegistry: () => RelationRegistry;

  /**
   * The plugin's name, shown under the list so the popup says whose it is.
   */
  readonly pluginName: string;
}

/**
 * The editor suggest offering the registry's labels in an inline field key before `::` and in a `%%:label%%`
 * comment right after a link.
 */
export class LabelSuggest extends EditorSuggest<string> {
  private readonly getRegistry: () => RelationRegistry;
  private suffix = '';

  /**
   * Creates the suggest.
   *
   * @param params - The parameters.
   */
  public constructor(params: LabelSuggestConstructorParams) {
    super(params.app);
    this.getRegistry = params.getRegistry;
    this.setInstructions([{ command: params.pluginName, purpose: 'Relation registry labels' }]);
  }

  /**
   * Gets the registry's labels matching the typed part: those starting with it first, then those containing it,
   * each group in registry order.
   *
   * @param context - The context.
   * @returns The labels.
   */
  public override getSuggestions(context: EditorSuggestContext): string[] {
    const query = normalizeLabel(context.query);
    const labels = this.getRegistry().getLabels();
    const prefixMatches = labels.filter((label) => normalizeLabel(label).startsWith(query));
    const otherMatches = labels.filter((label) => !normalizeLabel(label).startsWith(query) && normalizeLabel(label).includes(query));
    return [...prefixMatches, ...otherMatches];
  }

  /**
   * Opens when the cursor is in an inline field key before `::` or in a hidden label comment after a link.
   *
   * @param cursor - The cursor.
   * @param editor - The editor.
   * @returns The trigger info, or `null` to stay closed.
   */
  public override onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
    const labelContext = findLabelSuggestContext(editor.getLine(cursor.line), cursor.ch);
    if (!labelContext || this.getRegistry().getLabels().length === 0) {
      return null;
    }

    this.suffix = labelContext.suffix;
    return {
      end: { ch: labelContext.endCh, line: cursor.line },
      query: labelContext.query,
      start: { ch: labelContext.startCh, line: cursor.line }
    };
  }

  /**
   * Renders a label, with its inverse when the registry has one.
   *
   * @param label - The label.
   * @param el - The element to render into.
   */
  public override renderSuggestion(label: string, el: HTMLElement): void {
    el.addClass('mod-complex');
    const contentEl = el.createDiv({ cls: 'suggestion-content' });
    contentEl.createDiv({ cls: 'suggestion-title', text: label });
    const inverseLabel = this.getRegistry().getInverseLabel(label);
    if (inverseLabel !== null) {
      contentEl.createDiv({ cls: 'suggestion-note', text: `Inverse: ${inverseLabel}` });
    }
  }

  /**
   * Writes the chosen label over the typed part, finishing the field's `::` or the comment's `%%` when needed.
   *
   * @param label - The label.
   */
  public override selectSuggestion(label: string): void {
    const context = this.context;
    if (!context) {
      return;
    }

    const text = label + this.suffix;
    context.editor.replaceRange(text, context.start, context.end);
    context.editor.setCursor({ ch: context.start.ch + text.length, line: context.start.line });
    this.close();
  }
}

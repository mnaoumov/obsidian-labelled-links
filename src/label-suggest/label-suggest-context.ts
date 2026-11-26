/**
 * @file
 *
 * Finds the label being typed on a line, where `Labelled Links` reads one: an inline field key before `::`
 * (`employee:: [[B]]`, `[employee:: [[B]]]`, `(employee:: [[B]])`) and a hidden label comment right after a link
 * (`[[B]]%%:employee%%`).
 */

import {
  getMandatoryNamedGroup,
  getOptionalNamedGroup
} from '@mnaoumov/typescript-lib/reg-exp';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';

/**
 * Where a label is being typed, and how a chosen label replaces it.
 */
export interface LabelSuggestContext {
  /**
   * The end of the text a chosen label replaces, exclusive.
   */
  readonly endCh: number;

  /**
   * The part of the label typed before the cursor.
   */
  readonly query: string;

  /**
   * The start of the text a chosen label replaces.
   */
  readonly startCh: number;

  /**
   * The text written after a chosen label: `:: ` to finish a field key typed with its `::`, `%%` to close a comment.
   */
  readonly suffix: string;
}

const FIELD_SEPARATOR = '::';

const COMMENT_CLOSING = '%%';

/**
 * The characters a label being typed may hold. A space ends it, so typing prose never extends a query.
 */
const LABEL_CHAR = String.raw`[-\p{L}\p{N}_\p{Emoji_Presentation}/]`;

/**
 * Where an inline field key may start: the line start, after quote markers, a list marker and a task checkbox,
 * or right after the `[` or `(` of a bracketed field.
 */
const KEY_POSITION = String.raw`(?:^(?:\s*>)*\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)?|[[(])`;

/**
 * A key typed together with its `::`, ending at the cursor: `emp::`.
 */
const TYPED_FIELD_KEY_REG_EXP = new RegExp(`${KEY_POSITION}(?<query>${LABEL_CHAR}+)::$`, 'u');

/**
 * A key being edited before the cursor, which the `::` after the cursor finishes.
 */
const EDITED_FIELD_KEY_BEFORE_REG_EXP = new RegExp(`${KEY_POSITION}(?<query>${LABEL_CHAR}*)$`, 'u');

/**
 * The rest of a key being edited, after the cursor, up to its `::`.
 */
const EDITED_FIELD_KEY_AFTER_REG_EXP = new RegExp(`^(?<rest>${LABEL_CHAR}*)::`, 'u');

/**
 * A hidden label comment opened right after a link, ending at the cursor: `[[B]]%%:emp`.
 */
const COMMENT_LABEL_BEFORE_REG_EXP = new RegExp(String.raw`(?:\]\]|\))[ \t]*%%[ \t]*:[ \t]*(?<query>${LABEL_CHAR}*)$`, 'u');

/**
 * The rest of a hidden label after the cursor, and the comment's closing `%%` when it is already there.
 */
const COMMENT_LABEL_AFTER_REG_EXP = new RegExp(String.raw`^(?<rest>${LABEL_CHAR}*)(?<closing>[ \t]*%%)?`, 'u');

/**
 * Finds the label being typed at the cursor.
 *
 * @param lineText - The text of the cursor's line.
 * @param cursorCh - The cursor's column.
 * @returns The context, or `null` when the cursor is not where a label is read.
 */
export function findLabelSuggestContext(lineText: string, cursorCh: number): LabelSuggestContext | null {
  const before = lineText.slice(0, cursorCh);
  const after = lineText.slice(cursorCh);

  const commentMatch = COMMENT_LABEL_BEFORE_REG_EXP.exec(before);
  if (commentMatch) {
    const query = getMandatoryNamedGroup(commentMatch, 'query');
    // The pattern matches every string, the empty one included.
    const afterMatch = ensureNonNullable(COMMENT_LABEL_AFTER_REG_EXP.exec(after));
    return {
      endCh: cursorCh + getMandatoryNamedGroup(afterMatch, 'rest').length,
      query,
      startCh: cursorCh - query.length,
      suffix: getOptionalNamedGroup(afterMatch, 'closing') === null ? COMMENT_CLOSING : ''
    };
  }

  const typedKeyMatch = TYPED_FIELD_KEY_REG_EXP.exec(before);
  if (typedKeyMatch) {
    const query = getMandatoryNamedGroup(typedKeyMatch, 'query');
    return {
      endCh: cursorCh,
      query,
      startCh: cursorCh - query.length - FIELD_SEPARATOR.length,
      suffix: /^\s/u.test(after) ? FIELD_SEPARATOR : `${FIELD_SEPARATOR} `
    };
  }

  const editedKeyAfterMatch = EDITED_FIELD_KEY_AFTER_REG_EXP.exec(after);
  if (!editedKeyAfterMatch) {
    return null;
  }

  const editedKeyBeforeMatch = EDITED_FIELD_KEY_BEFORE_REG_EXP.exec(before);
  if (!editedKeyBeforeMatch) {
    return null;
  }

  const query = getMandatoryNamedGroup(editedKeyBeforeMatch, 'query');
  return {
    endCh: cursorCh + getMandatoryNamedGroup(editedKeyAfterMatch, 'rest').length,
    query,
    startCh: cursorCh - query.length,
    suffix: ''
  };
}

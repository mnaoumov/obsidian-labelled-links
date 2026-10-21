import type {
  Reference,
  ReferenceCache
} from 'obsidian';

import { LabelForm } from './relation-extractor.ts';

/**
 * Spells a link and its label in each form a label can be written in.
 */
const LABELLED_LINK_FORMATTERS: Record<LabelForm, (label: string, original: string) => string> = {
  [LabelForm.BracketedInlineField]: (label, original) => `[${label}:: ${original}]`,
  [LabelForm.Comment]: (label, original) => `${original}%%:${label}%%`,
  [LabelForm.InlineField]: (label, original) => `${label}:: ${original}`,
  [LabelForm.ParenthesizedInlineField]: (label, original) => `(${label}:: ${original})`,
  [LabelForm.Property]: (label, original) => `${label}: ${JSON.stringify(original)}`
};

/**
 * Params for {@link formatRelationSentence}.
 */
export interface FormatRelationSentenceParams {
  /**
   * The label, as written in the source note.
   */
  readonly label: string;

  /**
   * The name of the note the label is written in.
   */
  readonly sourceName: string;

  /**
   * The name of the note the link points at.
   */
  readonly targetName: string;
}

/**
 * Params for {@link formatWrittenRelation}.
 */
export interface FormatWrittenRelationParams {
  /**
   * The label, as written in the source note.
   */
  readonly label: string;

  /**
   * How the label is written.
   */
  readonly labelForm: LabelForm;

  /**
   * The link as written in the source note.
   */
  readonly original: string;

  /**
   * The name of the note the label is written in.
   */
  readonly sourceName: string;
}

/**
 * Says which end of a labelled link the label describes: `child:: [[Bob]]` in Alice's note makes Bob Alice's
 * child, so the sentence is `Bob is Alice's child`.
 *
 * @param params - The label and the two ends.
 * @returns The sentence.
 */
export function formatRelationSentence(params: FormatRelationSentenceParams): string {
  const { label, sourceName, targetName } = params;
  return `${targetName} is ${sourceName}'s ${label}`;
}

/**
 * Spells a labelled link the way its source note writes it, after the note's name: `Alice: child:: [[Bob]]`,
 * `Alice: child: "[[Bob]]"` for a property, `Alice: [[Bob]]%%:child%%` for a hidden label. A link in a list
 * property, or one of several in one value, is spelled as if it were the property's only value.
 *
 * @param params - The label, its form, the link and the source note's name.
 * @returns The text.
 */
export function formatWrittenRelation(params: FormatWrittenRelationParams): string {
  const { label, labelForm, original, sourceName } = params;
  return `${sourceName}: ${formatLabelledLink(label, labelForm, original)}`;
}

/**
 * Gets the name a note is shown under: its path without the folder and without the `.md` extension.
 *
 * @param path - The note's path.
 * @returns The name.
 */
export function getNoteName(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.endsWith('.md') ? name.slice(0, -'.md'.length) : name;
}

/**
 * Checks whether a reference is one in the note's body, which has a position, rather than one in its properties.
 *
 * @param reference - The reference.
 * @returns Whether it has a position.
 */
export function isReferenceCache(reference: Reference): reference is ReferenceCache {
  return 'position' in reference;
}

function formatLabelledLink(label: string, labelForm: LabelForm, original: string): string {
  return LABELLED_LINK_FORMATTERS[labelForm](label, original);
}

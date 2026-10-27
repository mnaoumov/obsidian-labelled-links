import type {
  CachedMetadata,
  Reference,
  ReferenceCache
} from 'obsidian';

import { parseFrontmatterLinks } from '@mnaoumov/obsidian-lib/parse-link';
import { getMandatoryNamedGroup } from '@mnaoumov/typescript-lib/reg-exp';

/**
 * How a label is written in its source note.
 */
export enum LabelForm {
  /**
   * An inline field in square brackets: `[child:: [[B]]]`.
   */
  BracketedInlineField = 'bracketed-inline-field',

  /**
   * A hidden label in a comment right after the link: `[[B]]%%:child%%`.
   */
  Comment = 'comment',

  /**
   * An inline field taking the rest of its line: `child:: [[B]]`.
   */
  InlineField = 'inline-field',

  /**
   * An inline field in parentheses: `(child:: [[B]])`.
   */
  ParenthesizedInlineField = 'parenthesized-inline-field',

  /**
   * A property: `child: "[[B]]"`.
   */
  Property = 'property'
}

/**
 * A reference found in a note, with the label it carries.
 */
export interface ExtractedReference {
  /**
   * The property or inline-field key the reference is the value of, or `null` for a plain link.
   */
  readonly label: null | string;

  /**
   * How {@link ExtractedReference.label} is written, or `null` for a plain link.
   */
  readonly labelForm: LabelForm | null;

  /**
   * The reference as Obsidian caches it.
   */
  readonly reference: Reference;
}

/**
 * Params for {@link extractReferences}.
 */
export interface ExtractReferencesParams {
  /**
   * The note's cached metadata.
   */
  readonly cache: CachedMetadata;

  /**
   * The note's text, which the cached metadata was computed from. Inline fields are read from it, because the
   * metadata cache does not record them.
   */
  readonly content: string;
}

/**
 * The span of an inline field's value on one line, in UTF-16 columns.
 */
interface InlineField {
  readonly form: LabelForm;
  readonly label: string;
  readonly valueEnd: number;
  readonly valueStart: number;
}

/**
 * The characters a field key may start with: letters, digits, underscore and emoji, as in `Dataview`.
 */
const KEY_START = String.raw`[\p{L}\p{N}_\p{Emoji_Presentation}]`;

/**
 * The characters a field key may continue with: the start characters plus `-`, `/` and spaces.
 */
const KEY_REST = String.raw`[-\p{L}\p{N}_\p{Emoji_Presentation}/ ]`;

/**
 * Formatting a key may be wrapped in, `**employee**:: [[B]]` included.
 */
const KEY_FORMATTING = '[*_~`]*';

/**
 * A field that takes the rest of its line: `employee:: [[B]]`, also inside a quote, after a list marker or a
 * task checkbox.
 */
const FULL_LINE_FIELD_REG_EXP = new RegExp(
  String.raw`^(?:\s*>)*\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)?${KEY_FORMATTING}(?<key>${KEY_START}${KEY_REST}*?)${KEY_FORMATTING}\s*::`,
  'u'
);

/**
 * The key of a bracketed field, matched right after its opening `[` or `(`.
 */
const BRACKETED_KEY_REG_EXP = new RegExp(String.raw`^${KEY_FORMATTING}(?<key>${KEY_START}${KEY_REST}*?)${KEY_FORMATTING}\s*::`, 'u');

/**
 * A hidden label: a comment holding `:` and the label, right after the link it labels, `[[B]]%%:child%%`.
 */
const COMMENT_LABEL_REG_EXP = new RegExp(String.raw`^[ \t]*%%[ \t]*:[ \t]*(?<key>${KEY_START}${KEY_REST}*?)[ \t]*%%`, 'u');

const CLOSING_BRACKETS = new Map([
  ['(', ')'],
  ['[', ']']
]);

const BRACKETED_FIELD_FORMS = new Map([
  ['(', LabelForm.ParenthesizedInlineField],
  ['[', LabelForm.BracketedInlineField]
]);

interface FindClosingBracketParams {
  readonly closingBracket: string;
  readonly line: string;
  readonly openingBracket: string;
  readonly start: number;
}

/**
 * Finds every reference of a note and the label each one carries.
 *
 * - A link in a property value is labelled with the property name. A list property loses its index, so both
 *   links of `employee: ["[[A]]", "[[B]]"]` are labelled `employee`.
 * - A link in the value of an inline field (`employee:: [[B]]`, `[employee:: [[B]]]`, `(employee:: [[B]])`) is
 *   labelled with the field key.
 * - A link followed by a `%%:label%%` comment (`[[B]]%%:child%%`) is labelled with the comment's label, which wins
 *   over an inline field the link sits in. Being a comment, the label is not rendered in Reading view.
 * - Every other link and embed is a plain link, with the label `null`.
 *
 * @param params - The note's metadata and text.
 * @returns The references, property links first, then body links in the order Obsidian caches them.
 */
export function extractReferences(params: ExtractReferencesParams): ExtractedReference[] {
  const { cache, content } = params;
  const references: ExtractedReference[] = [];

  const multiValueReferences = parseFrontmatterLinks(cache.frontmatter ?? {}).multiValueFrontmatterLinks;
  // Obsidian caches a value holding several links (`"[[A]], [[B]]"`) as ONE link to `A]], [[B`, so the cached
  // Entry for such a key is replaced by the links parsed out of its value.
  const multiValueKeys = new Set(multiValueReferences.map((reference) => reference.key));

  for (const reference of cache.frontmatterLinks ?? []) {
    if (!multiValueKeys.has(reference.key)) {
      references.push({ label: getPropertyLabel(reference.key), labelForm: LabelForm.Property, reference });
    }
  }

  for (const reference of multiValueReferences) {
    references.push({ label: getPropertyLabel(reference.key), labelForm: LabelForm.Property, reference });
  }

  const bodyReferences = [...cache.links ?? [], ...cache.embeds ?? []].sort(compareByOffset);
  if (bodyReferences.length === 0) {
    return references;
  }

  const lines = content.split('\n');
  const fieldsByLine = new Map<number, InlineField[]>();

  for (const reference of bodyReferences) {
    const lineIndex = reference.position.start.line;
    let fields = fieldsByLine.get(lineIndex);
    if (!fields) {
      fields = findInlineFields(lines[lineIndex] ?? '');
      fieldsByLine.set(lineIndex, fields);
    }

    const commentLabel = findCommentLabel(lines, reference);
    const field = findField(fields, reference);
    references.push({
      label: commentLabel ?? field?.label ?? null,
      labelForm: commentLabel === null ? field?.form ?? null : LabelForm.Comment,
      reference
    });
  }

  return references;
}

function compareByOffset(a: ReferenceCache, b: ReferenceCache): number {
  return a.position.start.offset - b.position.start.offset;
}

function findBracketedFields(line: string): InlineField[] {
  const fields: InlineField[] = [];

  for (let index = 0; index < line.length; index++) {
    const openingBracket = line.charAt(index);
    const closingBracket = CLOSING_BRACKETS.get(openingBracket);
    const form = BRACKETED_FIELD_FORMS.get(openingBracket);
    if (closingBracket === undefined || form === undefined) {
      continue;
    }

    const match = BRACKETED_KEY_REG_EXP.exec(line.slice(index + 1));
    if (!match) {
      continue;
    }

    const valueStart = index + 1 + match[0].length;
    const valueEnd = findClosingBracket({ closingBracket, line, openingBracket, start: valueStart });
    if (valueEnd === -1) {
      continue;
    }

    fields.push({ form, label: getMandatoryNamedGroup(match, 'key').trim(), valueEnd, valueStart });
    index = valueEnd;
  }

  return fields;
}

function findClosingBracket(params: FindClosingBracketParams): number {
  const { closingBracket, line, openingBracket, start } = params;
  let depth = 0;

  for (let index = start; index < line.length; index++) {
    const char = line.charAt(index);
    if (char === openingBracket) {
      depth++;
    } else if (char === closingBracket) {
      if (depth === 0) {
        return index;
      }
      depth--;
    }
  }

  return -1;
}

function findCommentLabel(lines: readonly string[], reference: ReferenceCache): null | string {
  const { end } = reference.position;
  const match = COMMENT_LABEL_REG_EXP.exec((lines[end.line] ?? '').slice(end.col));
  return match ? getMandatoryNamedGroup(match, 'key').trim() : null;
}

function findField(fields: readonly InlineField[], reference: ReferenceCache): InlineField | undefined {
  const { end, start } = reference.position;
  const isSingleLine = start.line === end.line;
  return fields.find((candidate) => candidate.valueStart <= start.col && (isSingleLine ? end.col : start.col) <= candidate.valueEnd);
}

/**
 * Finds the inline fields on one line of a note.
 *
 * @param line - The line.
 * @returns The fields, bracketed ones first, so that a bracketed field inside a full-line one wins.
 */
function findInlineFields(line: string): InlineField[] {
  const fields = findBracketedFields(line);

  const match = FULL_LINE_FIELD_REG_EXP.exec(line);
  if (match) {
    fields.push({ form: LabelForm.InlineField, label: getMandatoryNamedGroup(match, 'key').trim(), valueEnd: line.length, valueStart: match[0].length });
  }

  return fields;
}

/**
 * Turns a property key as Obsidian caches it into a label: `employee.0` (the first item of a list) becomes
 * `employee`, and a nested `contact.manager` stays as it is.
 *
 * @param key - The cached key.
 * @returns The label.
 */
function getPropertyLabel(key: string): string {
  return key.split('.').filter((segment) => !/^\d+$/u.test(segment)).join('.');
}

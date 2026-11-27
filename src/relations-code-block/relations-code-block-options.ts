import type { RelationListOptions } from '../relations-pane/relation-list-renderer.ts';

/**
 * The language of the fenced code block that lists a note's relations.
 */
export const RELATIONS_CODE_BLOCK_LANGUAGE = 'labelled-links';

/**
 * The options of a `labelled-links` code block, read from its `key: value` lines.
 */
export interface RelationsCodeBlockOptions extends RelationListOptions {
  /**
   * The link text of the note whose relations are listed, or `null` for the note holding the block.
   */
  readonly center: null | string;
}

/**
 * The options a `labelled-links` code block's source spells, and the lines it could not read.
 */
export interface RelationsCodeBlockParseResult {
  /**
   * One message per line that could not be read.
   */
  readonly errors: readonly string[];

  /**
   * The options, with the defaults for every key the source leaves out.
   */
  readonly options: RelationsCodeBlockOptions;
}

type BooleanKey = 'shouldIncludeDerived' | 'shouldIncludeSubLabels' | 'shouldIncludeUnlabelled';

const BOOLEAN_KEYS: Readonly<Record<string, BooleanKey>> = {
  'derived': 'shouldIncludeDerived',
  'sub-labels': 'shouldIncludeSubLabels',
  'unlabelled': 'shouldIncludeUnlabelled'
};

const BOOLEAN_VALUES: Readonly<Record<string, boolean>> = {
  false: false,
  no: false,
  true: true,
  yes: true
};

/**
 * The shortest quoted value: its two quotes.
 */
const MIN_QUOTED_LENGTH = 2;

const KNOWN_KEYS = ['center', 'derived', 'hide', 'labels', 'sub-labels', 'unlabelled'];

/**
 * Reads the options of a `labelled-links` code block. Each non-empty line is `key: value`, keys ignoring case:
 *
 * - `center`: the note whose relations are listed, as a wikilink or its link text; the host note by default;
 * - `labels`: the only labels to list, comma-separated;
 * - `hide`: labels to leave out, comma-separated;
 * - `derived`: whether derived relations are listed, `true` by default;
 * - `sub-labels`: whether a sub-label's relations are listed in their widest superset's group, `false` by default;
 * - `unlabelled`: whether plain links and backlinks are listed, `false` by default.
 *
 * A line starting with `#` is a comment.
 *
 * @param source - The code block's source.
 * @returns The options and the lines that could not be read.
 */
export function parseRelationsCodeBlockOptions(source: string): RelationsCodeBlockParseResult {
  const errors: string[] = [];
  let center: null | string = null;
  let hiddenLabels: string[] = [];
  let shownLabels: null | string[] = null;
  const booleans: Record<BooleanKey, boolean> = {
    shouldIncludeDerived: true,
    shouldIncludeSubLabels: false,
    shouldIncludeUnlabelled: false
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      errors.push(`"${line}" is not a "key: value" line.`);
      continue;
    }

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    const booleanKey = BOOLEAN_KEYS[key];
    if (booleanKey) {
      const booleanValue = BOOLEAN_VALUES[value.toLowerCase()];
      if (booleanValue === undefined) {
        errors.push(`"${key}" takes true or false, not "${value}".`);
      } else {
        booleans[booleanKey] = booleanValue;
      }
      continue;
    }

    switch (key) {
      case 'center': {
        center = parseLinkText(value);
        break;
      }
      case 'hide': {
        hiddenLabels = splitLabels(value);
        break;
      }
      case 'labels': {
        shownLabels = splitLabels(value);
        break;
      }
      default: {
        errors.push(`Unknown option "${key}". The options are ${KNOWN_KEYS.join(', ')}.`);
        break;
      }
    }
  }

  return {
    errors,
    options: {
      center,
      hiddenLabels,
      shownLabels,
      ...booleans
    }
  };
}

/**
 * Reads the link text out of a `center` value: `[[Alice]]`, `[[People/Alice|Alice]]`, `"[[Alice]]"` or `Alice`.
 *
 * @param value - The value.
 * @returns The link text, or `null` when the value is empty.
 */
function parseLinkText(value: string): null | string {
  let text = value;
  if (text.length >= MIN_QUOTED_LENGTH && (text.startsWith('"') || text.startsWith('\'')) && text.endsWith(text.charAt(0))) {
    text = text.slice(1, -1).trim();
  }
  if (text.startsWith('[[') && text.endsWith(']]')) {
    text = text.slice('[['.length, -']]'.length);
    const pipeIndex = text.indexOf('|');
    if (pipeIndex !== -1) {
      text = text.slice(0, pipeIndex);
    }
    text = text.trim();
  }
  return text === '' ? null : text;
}

function splitLabels(value: string): string[] {
  return value.split(',').map((label) => label.trim()).filter((label) => label !== '');
}

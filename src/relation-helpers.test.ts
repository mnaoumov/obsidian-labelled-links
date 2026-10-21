import type { Reference } from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  describe,
  expect,
  it
} from 'vitest';

import { LabelForm } from './relation-extractor.ts';
import {
  formatRelationSentence,
  formatWrittenRelation,
  getNoteName,
  isReferenceCache
} from './relation-helpers.ts';

describe('formatRelationSentence', () => {
  it('names the target as the source\'s label', () => {
    expect(formatRelationSentence({ label: 'child', sourceName: 'Alice', targetName: 'Bob' })).toBe('Bob is Alice\'s child');
  });
});

describe('formatWrittenRelation', () => {
  it.each([
    [LabelForm.BracketedInlineField, 'Alice: [child:: [[Bob]]]'],
    [LabelForm.Comment, 'Alice: [[Bob]]%%:child%%'],
    [LabelForm.InlineField, 'Alice: child:: [[Bob]]'],
    [LabelForm.ParenthesizedInlineField, 'Alice: (child:: [[Bob]])'],
    [LabelForm.Property, 'Alice: child: "[[Bob]]"']
  ])('spells a %s the way the source note writes it', (labelForm, expected) => {
    expect(formatWrittenRelation({ label: 'child', labelForm, original: '[[Bob]]', sourceName: 'Alice' })).toBe(expected);
  });

  it('quotes a property value as YAML does', () => {
    expect(formatWrittenRelation({ label: 'child', labelForm: LabelForm.Property, original: '[Bob "B"](<Bob.md>)', sourceName: 'Alice' })).toBe(
      String.raw`Alice: child: "[Bob \"B\"](<Bob.md>)"`
    );
  });
});

describe('getNoteName', () => {
  it('drops the folder and the .md extension', () => {
    expect(getNoteName('People/Alice.md')).toBe('Alice');
  });

  it('keeps the extension of a file that is not a note', () => {
    expect(getNoteName('Photo.png')).toBe('Photo.png');
  });
});

describe('isReferenceCache', () => {
  it('tells a body reference, which has a position, from a property one', () => {
    const position = { end: { col: 0, line: 0, offset: 0 }, start: { col: 0, line: 0, offset: 0 } };
    expect(isReferenceCache(castTo<Reference>({ link: 'Bob', original: '[[Bob]]', position }))).toBe(true);
    expect(isReferenceCache(castTo<Reference>({ key: 'child', link: 'Bob', original: '[[Bob]]' }))).toBe(false);
  });
});

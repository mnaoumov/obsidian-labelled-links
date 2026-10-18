import type { Reference } from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getNoteName,
  isReferenceCache
} from './relation-helpers.ts';

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

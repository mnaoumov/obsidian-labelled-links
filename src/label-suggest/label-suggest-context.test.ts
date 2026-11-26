import {
  describe,
  expect,
  it
} from 'vitest';

import { findLabelSuggestContext } from './label-suggest-context.ts';

function findAtBar(lineWithBar: string): ReturnType<typeof findLabelSuggestContext> {
  const cursorCh = lineWithBar.indexOf('|');
  return findLabelSuggestContext(lineWithBar.replace('|', ''), cursorCh);
}

describe('findLabelSuggestContext', () => {
  it('opens on a key typed with its `::` at the line start, finishing the field with a space', () => {
    expect(findAtBar('emp::|')).toStrictEqual({ endCh: 5, query: 'emp', startCh: 0, suffix: ':: ' });
  });

  it('leaves out the space when one already follows the cursor', () => {
    expect(findAtBar('emp::| [[B]]')).toStrictEqual({ endCh: 5, query: 'emp', startCh: 0, suffix: '::' });
  });

  it('opens after quote markers, a list marker and a task checkbox', () => {
    expect(findAtBar('> - [ ] emp::|')).toStrictEqual({ endCh: 13, query: 'emp', startCh: 8, suffix: ':: ' });
    expect(findAtBar('1. emp::|')).toStrictEqual({ endCh: 8, query: 'emp', startCh: 3, suffix: ':: ' });
  });

  it('opens right after the bracket of a bracketed field', () => {
    expect(findAtBar('See [emp::|')).toStrictEqual({ endCh: 10, query: 'emp', startCh: 5, suffix: ':: ' });
    expect(findAtBar('See (emp::|')).toStrictEqual({ endCh: 10, query: 'emp', startCh: 5, suffix: ':: ' });
  });

  it('opens inside a key that `::` already follows, replacing the whole key', () => {
    expect(findAtBar('work|place:: [[B]]')).toStrictEqual({ endCh: 9, query: 'work', startCh: 0, suffix: '' });
    expect(findAtBar('See [|:: [[B]]]')).toStrictEqual({ endCh: 5, query: '', startCh: 5, suffix: '' });
  });

  it('stays closed in prose, a key that no `::` follows and a key not in a key position', () => {
    expect(findAtBar('employee|')).toBeNull();
    expect(findAtBar('work|place [[B]]')).toBeNull();
    expect(findAtBar('See emp::|')).toBeNull();
    expect(findAtBar('See emp|:: [[B]]')).toBeNull();
    expect(findAtBar('::|')).toBeNull();
  });

  it('opens in a hidden label comment after a wikilink, closing the comment', () => {
    expect(findAtBar('[[B]]%%:|')).toStrictEqual({ endCh: 8, query: '', startCh: 8, suffix: '%%' });
    expect(findAtBar('[[B]] %% : chi|')).toStrictEqual({ endCh: 14, query: 'chi', startCh: 11, suffix: '%%' });
  });

  it('opens in a hidden label comment after a markdown link, keeping its closing `%%`', () => {
    expect(findAtBar('[B](B.md)%%:ch|ild%%')).toStrictEqual({ endCh: 17, query: 'ch', startCh: 12, suffix: '' });
    expect(findAtBar('[B](B.md)%%:|child %%')).toStrictEqual({ endCh: 17, query: '', startCh: 12, suffix: '' });
  });

  it('stays closed in a comment that does not follow a link or holds no `:`', () => {
    expect(findAtBar('Text %%:|')).toBeNull();
    expect(findAtBar('[[B]]%%|')).toBeNull();
  });
});

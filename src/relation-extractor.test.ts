import type { CachedMetadata } from 'obsidian';

import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { extractReferences } from './relation-extractor.ts';

interface LabelledLink {
  readonly label: null | string;
  readonly link: string;
}

function extract(content: string): LabelledLink[] {
  const app = App.createConfigured__({ files: { 'Note.md': content } });
  const cache = ensureNonNullable(app.metadataCache.getCache('Note.md'));
  return toLabelledLinks(cache, content);
}

function toLabelledLinks(cache: CachedMetadata, content: string): LabelledLink[] {
  return extractReferences({ cache, content }).map(({ label, reference }) => ({ label, link: reference.link }));
}

describe('extractReferences', () => {
  it('labels a link-valued property with its name', () => {
    expect(extract('---\nemployee: "[[Alice]]"\n---\n')).toStrictEqual([{ label: 'employee', link: 'Alice' }]);
  });

  it('labels every item of a list property with the property name', () => {
    expect(extract('---\nchild:\n  - "[[Bob]]"\n  - "[[Carol]]"\n---\n')).toStrictEqual([
      { label: 'child', link: 'Bob' },
      { label: 'child', link: 'Carol' }
    ]);
  });

  it('keeps a nested property key as it is', () => {
    expect(extract('---\ncontact:\n  manager: "[[Dave]]"\n---\n')).toStrictEqual([{ label: 'contact.manager', link: 'Dave' }]);
  });

  it('labels each link of a property value that holds several', () => {
    expect(extract('---\nsibling: "[[Eve]], [[Frank]]"\n---\n')).toStrictEqual([
      { label: 'sibling', link: 'Eve' },
      { label: 'sibling', link: 'Frank' }
    ]);
  });

  it('labels a link in a full-line inline field', () => {
    expect(extract('employee:: [[Alice]]\n')).toStrictEqual([{ label: 'employee', link: 'Alice' }]);
  });

  it('labels every link in a full-line inline field value, embeds included', () => {
    expect(extract('child:: [[Bob]], [[Carol]] and ![[Photo.png]]\n')).toStrictEqual([
      { label: 'child', link: 'Bob' },
      { label: 'child', link: 'Carol' },
      { label: 'child', link: 'Photo.png' }
    ]);
  });

  it.each([
    ['- employee:: [[Alice]]'],
    ['1. employee:: [[Alice]]'],
    ['- [x] employee:: [[Alice]]'],
    ['> employee:: [[Alice]]'],
    ['**employee**:: [[Alice]]'],
    ['employee :: [[Alice]]']
  ])('labels a full-line inline field written as %j', (line) => {
    expect(extract(`${line}\n`)).toStrictEqual([{ label: 'employee', link: 'Alice' }]);
  });

  it('keeps spaces inside a field key', () => {
    expect(extract('works for:: [[Alice]]\n')).toStrictEqual([{ label: 'works for', link: 'Alice' }]);
  });

  it('labels a link in a bracketed inline field and leaves the rest of the line plain', () => {
    expect(extract('Met [[Alice]] at work [employee:: [[Bob]]] and (mentor:: [[Carol]]) today.\n')).toStrictEqual([
      { label: null, link: 'Alice' },
      { label: 'employee', link: 'Bob' },
      { label: 'mentor', link: 'Carol' }
    ]);
  });

  it('prefers a bracketed field inside a full-line one', () => {
    expect(extract('employee:: [[Alice]] [mentor:: [[Bob]]]\n')).toStrictEqual([
      { label: 'employee', link: 'Alice' },
      { label: 'mentor', link: 'Bob' }
    ]);
  });

  it('ignores a bracketed field that is never closed', () => {
    expect(extract('Note [employee:: [[Alice]]\n')).toStrictEqual([{ label: null, link: 'Alice' }]);
  });

  it('treats a link outside any field as plain', () => {
    expect(extract('# Heading\n\nSee [[Alice]] and [Bob](Bob.md).\n')).toStrictEqual([
      { label: null, link: 'Alice' },
      { label: null, link: 'Bob.md' }
    ]);
  });

  it('puts property links before body links', () => {
    expect(extract('---\nparent: "[[Dave]]"\n---\nchild:: [[Bob]]\n')).toStrictEqual([
      { label: 'parent', link: 'Dave' },
      { label: 'child', link: 'Bob' }
    ]);
  });

  it('returns nothing for a note with no links', () => {
    expect(extract('Just text.\n')).toStrictEqual([]);
  });

  it('reads a link as plain when the text no longer has its line', () => {
    const app = App.createConfigured__({ files: { 'Note.md': 'First\n\nemployee:: [[Alice]]\n' } });
    const cache = ensureNonNullable(app.metadataCache.getCache('Note.md'));
    expect(toLabelledLinks(cache, '')).toStrictEqual([{ label: null, link: 'Alice' }]);
  });

  it('labels a link that spans lines by where it starts', () => {
    const cache: CachedMetadata = {
      links: [
        {
          displayText: 'Alice',
          link: 'Alice',
          original: '[[Alice\n]]',
          position: {
            end: { col: 2, line: 1, offset: 22 },
            start: { col: 10, line: 0, offset: 10 }
          }
        }
      ]
    };
    expect(toLabelledLinks(cache, 'employee::[[Alice\n]]')).toStrictEqual([{ label: 'employee', link: 'Alice' }]);
  });
});

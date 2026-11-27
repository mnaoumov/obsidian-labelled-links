import dedent from 'dedent';
import {
  describe,
  expect,
  it
} from 'vitest';

import { parseRelationsCodeBlockOptions } from './relations-code-block-options.ts';

describe('parseRelationsCodeBlockOptions', () => {
  it('lists every labelled and derived relation of the host note by default', () => {
    expect(parseRelationsCodeBlockOptions('')).toStrictEqual({
      errors: [],
      options: {
        center: null,
        hiddenLabels: [],
        shouldIncludeDerived: true,
        shouldIncludeSubLabels: false,
        shouldIncludeUnlabelled: false,
        shownLabels: null
      }
    });
  });

  it('reads every option, keys ignoring case, skipping blank and comment lines', () => {
    const source = dedent`
      # Alice's family
      Center: [[People/Alice|Alice]]

      labels: parent, , child
      hide: spouse
      derived: no
      sub-labels: YES
      unlabelled: true
    `;
    expect(parseRelationsCodeBlockOptions(source)).toStrictEqual({
      errors: [],
      options: {
        center: 'People/Alice',
        hiddenLabels: ['spouse'],
        shouldIncludeDerived: false,
        shouldIncludeSubLabels: true,
        shouldIncludeUnlabelled: true,
        shownLabels: ['parent', 'child']
      }
    });
  });

  it.each([
    ['"[[Alice]]"', 'Alice'],
    ['\'Alice\'', 'Alice'],
    ['Alice', 'Alice'],
    ['[[ Alice ]]', 'Alice'],
    ['"', '"'],
    ['""', null],
    ['', null]
  ])('reads the center %s as %s', (value, expected) => {
    expect(parseRelationsCodeBlockOptions(`center: ${value}`).options.center).toBe(expected);
  });

  it('reports each line it cannot read', () => {
    const source = dedent`
      just text
      derived: maybe
      depth: 2
    `;
    expect(parseRelationsCodeBlockOptions(source).errors).toStrictEqual([
      '"just text" is not a "key: value" line.',
      '"derived" takes true or false, not "maybe".',
      'Unknown option "depth". The options are center, derived, hide, labels, sub-labels, unlabelled.'
    ]);
  });
});

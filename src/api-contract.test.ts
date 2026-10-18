import type {
  ApiMethodCases,
  PayloadCases
} from '@mnaoumov/typescript-lib/api-contract-verifier';
import type { FrontmatterLinkCache } from 'obsidian';

import {
  validateSync,
  verifyApiContract
} from '@mnaoumov/typescript-lib/api-contract-verifier';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type {
  LabelledLinksApi,
  LabelledLinksRelation
} from '../api.d.ts';

import { LABELLED_LINKS_API_CONTRACT } from '../api-contract.ts';

const app = App.createConfigured__({ files: { 'Alice.md': '' } });
const alice = ensureNonNullable(app.vault.getFileByPath('Alice.md')).asOriginalType__();

const PROPERTY_REFERENCE: FrontmatterLinkCache = { key: 'employee', link: 'Bob', original: '[[Bob]]' };

const RELATION: LabelledLinksRelation = {
  direction: 'outgoing',
  isTargetResolved: true,
  label: 'employee',
  linkLabel: 'employee',
  reference: PROPERTY_REFERENCE,
  sourcePath: 'Alice.md',
  targetPath: 'Bob.md'
};

const PLAIN_LINK: LabelledLinksRelation = {
  direction: 'incoming',
  isTargetResolved: false,
  label: null,
  linkLabel: null,
  reference: { displayText: 'B', link: 'Bob', original: '[[Bob|B]]' },
  sourcePath: 'Carol.md',
  targetPath: 'Bob'
};

const LABEL: PayloadCases = { invalid: [[], [null], [1], ['employee', 'extra'], 'employee'], valid: [['employee']] };
const NULLABLE_LABEL: PayloadCases = { invalid: [undefined, 1, ['employer']], valid: ['employer', null] };
const GET_RELATIONS_INPUT: PayloadCases = {
  invalid: [
    [],
    [1],
    ['Alice.md', 'outgoing'],
    ['Alice.md', { direction: 'sideways' }],
    ['Alice.md', { label: 1 }],
    ['Alice.md', {}, 'extra']
  ],
  valid: [
    ['Alice.md'],
    [alice],
    ['Alice.md', {}],
    ['Alice.md', { direction: 'incoming', label: null }],
    ['Alice.md', { direction: 'outgoing', label: 'employee' }]
  ]
};
const RELATIONS: PayloadCases = {
  invalid: [
    null,
    RELATION,
    [{ ...RELATION, direction: 'sideways' }],
    [{ ...RELATION, isTargetResolved: 'yes' }],
    [{ ...RELATION, reference: { link: 'Bob' } }],
    [{ ...RELATION, reference: { ...PROPERTY_REFERENCE, displayText: 1 } }],
    [{ ...RELATION, targetPath: null }]
  ],
  valid: [[], [RELATION, PLAIN_LINK]]
};

const CASES: Record<keyof LabelledLinksApi, ApiMethodCases> = {
  getInverseLabel: { input: LABEL, output: NULLABLE_LABEL },
  getRelations: { input: GET_RELATIONS_INPUT, output: RELATIONS }
};

describe('LABELLED_LINKS_API_CONTRACT', () => {
  it('should pass the contract verification', async () => {
    expect(await verifyApiContract(LABELLED_LINKS_API_CONTRACT, { cases: CASES, vendor: 'labelled-links' })).toEqual([]);
  });

  it('should name the failing argument and what it expected', () => {
    expect(validateSync(LABELLED_LINKS_API_CONTRACT.getInverseLabel.input, [1])).toEqual({
      issues: [{ message: 'Expected a relation label.', path: [0] }]
    });
    expect(validateSync(LABELLED_LINKS_API_CONTRACT.getRelations.input, [1])).toEqual({
      issues: [{ message: 'Expected a note path or an instance of TFile.', path: [0] }]
    });
  });
});

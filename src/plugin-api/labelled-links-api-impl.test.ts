import { validateSync } from '@mnaoumov/typescript-lib/api-contract-verifier';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { LABELLED_LINKS_API_CONTRACT } from '../../api-contract.ts';
import { RelationIndexComponent } from '../relation-index/relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from '../relation-registry/relation-registry.ts';
import { LabelledLinksApiImpl } from './labelled-links-api-impl.ts';

interface ApiFixture {
  readonly api: LabelledLinksApiImpl;
  readonly app: App;
  readonly index: RelationIndexComponent;
}

const FILES = {
  'Alice.md': '---\nemployee: "[[Bob]]"\n---\nSee [[Bob]].\n',
  'Bob.md': '# Bob\n',
  'Carol.md': 'spouse:: [[Bob]]\n'
};

async function createApi(): Promise<ApiFixture> {
  const app = App.createConfigured__({ files: FILES });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  const { definitions, rules, subLabels } = parseRelationDefinitions(['employee <-> employer', 'spouse <-> spouse', 'spouseEmployer = spouse -> employer', 'spouse < relative']);
  index.setRegistry(new RelationRegistry(definitions, rules, subLabels));
  await index.rebuild();
  return { api: new LabelledLinksApiImpl(index), app, index };
}

describe('LabelledLinksApiImpl', () => {
  it('lists a note\'s relations as plain data, incoming ones under their inverse label', async () => {
    const { api } = await createApi();
    expect(
      api.getRelations('Bob.md').map(({ direction, label, linkLabel, sourcePath, targetPath }) => ({
        direction,
        label,
        linkLabel,
        sourcePath,
        targetPath
      }))
    ).toStrictEqual([
      { direction: 'incoming', label: 'employer', linkLabel: 'employee', sourcePath: 'Alice.md', targetPath: 'Bob.md' },
      { direction: 'incoming', label: null, linkLabel: null, sourcePath: 'Alice.md', targetPath: 'Bob.md' },
      { direction: 'incoming', label: 'spouse', linkLabel: 'spouse', sourcePath: 'Carol.md', targetPath: 'Bob.md' }
    ]);
  });

  it('accepts a file and filters by direction and label', async () => {
    const { api, app } = await createApi();
    const alice = ensureNonNullable(app.asOriginalType__().vault.getFileByPath('Alice.md'));
    expect(api.getRelations(alice, { direction: 'outgoing', label: 'EMPLOYEE' }).map((relation) => relation.targetPath)).toEqual(['Bob.md']);
    expect(api.getRelations(alice, { direction: 'incoming' })).toEqual([]);
    expect(api.getRelations('Bob.md', { label: null }).map((relation) => relation.sourcePath)).toEqual(['Alice.md']);
    expect(api.getRelations('Bob.md', { label: 'relative' })).toEqual([]);
    expect(api.getRelations('Bob.md', { includeSubLabels: true, label: 'relative' }).map((relation) => relation.sourcePath)).toEqual(['Carol.md']);
  });

  it('returns copies, so writing to them leaves the index untouched', async () => {
    const { api, index } = await createApi();
    const [relation] = api.getRelations('Alice.md', { label: 'employee' });
    ensureNonNullable(relation).reference.link = 'Changed';
    expect(index.getRelations('Alice.md', { label: 'employee' })[0]?.reference.link).toBe('Bob');
  });

  it('returns what the published contract promises', async () => {
    const { api } = await createApi();
    expect(validateSync(LABELLED_LINKS_API_CONTRACT.getRelations.output, api.getRelations('Bob.md'))).toEqual({
      value: api.getRelations('Bob.md')
    });
  });

  it('lists the derived relations as plain data, each with the stored relations it was built from', async () => {
    const { api } = await createApi();
    const relations = api.getDerivedRelations('Carol.md');
    expect(
      relations.map(({ isTargetResolved, label, sourcePath, steps, targetPath }) => ({
        isTargetResolved,
        label,
        sourcePath,
        steps: steps.map((step) => `${step.direction} ${String(step.label)}`),
        targetPath
      }))
    ).toStrictEqual([
      { isTargetResolved: true, label: 'spouseEmployer', sourcePath: 'Carol.md', steps: ['outgoing spouse', 'incoming employer'], targetPath: 'Alice.md' }
    ]);
    expect(validateSync(LABELLED_LINKS_API_CONTRACT.getDerivedRelations.output, relations)).toEqual({ value: relations });
    expect(api.getDerivedRelations('Carol.md', { label: 'unknown' })).toEqual([]);
  });

  it('returns derived relations whose steps are copies', async () => {
    const { api, index } = await createApi();
    ensureNonNullable(api.getDerivedRelations('Carol.md')[0]?.steps[0]).reference.link = 'Changed';
    expect(index.getDerivedRelations('Carol.md')[0]?.steps[0]?.reference.link).toBe('Bob');
  });

  it('answers the inverse label from the registry', async () => {
    const { api } = await createApi();
    expect(api.getInverseLabel('Employee')).toBe('employer');
    expect(api.getInverseLabel('unknown')).toBeNull();
  });
});

import { validateSync } from '@mnaoumov/typescript-lib/api-contract-verifier';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { LABELLED_LINKS_API_CONTRACT } from '../api-contract.ts';
import { LabelledLinksApiImpl } from './labelled-links-api-impl.ts';
import { RelationIndexComponent } from './relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

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
  index.setRegistry(new RelationRegistry(parseRelationDefinitions(['employee <-> employer', 'spouse <-> spouse']).definitions));
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

  it('answers the inverse label from the registry', async () => {
    const { api } = await createApi();
    expect(api.getInverseLabel('Employee')).toBe('employer');
    expect(api.getInverseLabel('unknown')).toBeNull();
  });
});

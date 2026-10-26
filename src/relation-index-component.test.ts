import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  App,
  TFile
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  DerivedRelation,
  Relation
} from './relation-index-component.ts';

import {
  RelationDirection,
  RelationIndexComponent
} from './relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

interface IndexFixture {
  readonly app: App;
  readonly index: RelationIndexComponent;
}

interface RelationSummary {
  readonly direction: RelationDirection;
  readonly isTargetResolved: boolean;
  readonly label: null | string;
  readonly linkLabel: null | string;
  readonly sourcePath: string;
  readonly targetPath: string;
}

const FILES = {
  'Alice.md': '---\nemployee: "[[Bob]]"\n---\nSee [[Carol]].\nmentor:: [[Nobody]]\n',
  'Bob.md': '# Bob\n',
  'Carol.md': 'spouse:: [[Alice]]\nmentions:: [[Bob]]\n'
};

async function createIndex(files: Record<string, string> = FILES): Promise<IndexFixture> {
  const app = App.createConfigured__({ files });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  index.setRegistry(new RelationRegistry(parseRelationDefinitions(['employee <-> employer', 'spouse <-> spouse', 'mentions']).definitions));
  await index.rebuild();
  return { app, index };
}

function getFile(app: App, path: string): TFile {
  return ensureNonNullable(app.vault.getFileByPath(path));
}

function summarize(relations: readonly Relation[]): RelationSummary[] {
  return relations.map(({ direction, isTargetResolved, label, linkLabel, sourcePath, targetPath }) => ({
    direction,
    isTargetResolved,
    label,
    linkLabel,
    sourcePath,
    targetPath
  }));
}

const FAMILY_FILES = {
  'Alice.md': '---\nmother: "[[Beth]]"\n---\nspouse:: [[Dan]]\n',
  'Beth.md': 'mother:: [[Carol]]\nchild:: [[Alice]]\nchild:: [[Eve]]\nchild:: [[Ghost]]\n',
  'Carol.md': '',
  'Couple.md': 'partner:: [[Dan]]\npartner:: [[Frank]]\n',
  'Couple2.md': 'partner:: [[Alice]]\npartner:: [[Dan]]\n',
  'Dan.md': '',
  'Eve.md': 'sibling:: [[Alice]]\n',
  'Frank.md': '',
  'Ivy.md': '---\nparent: "[[Eve]]"\n---\n'
};

const FAMILY_DEFINITIONS = [
  'parent <-> child',
  'sibling <-> sibling',
  'spouse <-> spouse',
  'partner <-> partnership',
  'grandmother = mother -> mother',
  'sibling = parent -> child',
  'aunt = parent -> sibling',
  'mate = spouse | partnership -> partner'
];

interface DerivedRelationSummary {
  readonly isTargetResolved: boolean;
  readonly label: string;
  readonly steps: readonly string[];
  readonly targetPath: string;
}

async function createFamilyIndex(): Promise<IndexFixture> {
  const fixture = await createIndex(FAMILY_FILES);
  const { definitions, rules } = parseRelationDefinitions(FAMILY_DEFINITIONS);
  fixture.index.setRegistry(new RelationRegistry(definitions, rules));
  return fixture;
}

function summarizeDerived(relations: readonly DerivedRelation[]): DerivedRelationSummary[] {
  return relations.map(({ isTargetResolved, label, steps, targetPath }) => ({
    isTargetResolved,
    label,
    steps: steps.map((step) => `${step.sourcePath} ${String(step.linkLabel)} ${step.targetPath}`),
    targetPath
  }));
}

describe('RelationIndexComponent derived relations', () => {
  it('walks each rule\'s chains, following inverse labels, leaving out the note itself and what is stored', async () => {
    const { index } = await createFamilyIndex();
    expect(summarizeDerived(index.getDerivedRelations('Alice.md'))).toStrictEqual([
      { isTargetResolved: true, label: 'grandmother', steps: ['Alice.md mother Beth.md', 'Beth.md mother Carol.md'], targetPath: 'Carol.md' },
      // Eve is Alice's sibling too, but Eve's note stores it, so only the unresolved Ghost is derived.
      { isTargetResolved: false, label: 'sibling', steps: ['Beth.md child Alice.md', 'Beth.md child Ghost'], targetPath: 'Ghost' },
      // The partnership chain reaches Dan too, so he is listed once, by the first chain.
      { isTargetResolved: true, label: 'mate', steps: ['Alice.md spouse Dan.md'], targetPath: 'Dan.md' }
    ]);
  });

  it('derives through a hub note linking both ends, and through a rule naming another rule', async () => {
    const { index } = await createFamilyIndex();
    expect(summarizeDerived(index.getDerivedRelations('Dan.md'))).toStrictEqual([
      { isTargetResolved: true, label: 'mate', steps: ['Alice.md spouse Dan.md'], targetPath: 'Alice.md' },
      { isTargetResolved: true, label: 'mate', steps: ['Couple.md partner Dan.md', 'Couple.md partner Frank.md'], targetPath: 'Frank.md' }
    ]);
    expect(summarizeDerived(index.getDerivedRelations('Ivy.md'))).toStrictEqual([
      { isTargetResolved: true, label: 'aunt', steps: ['Ivy.md parent Eve.md', 'Eve.md sibling Alice.md'], targetPath: 'Alice.md' },
      { isTargetResolved: false, label: 'aunt', steps: ['Ivy.md parent Eve.md', 'Beth.md child Eve.md', 'Beth.md child Ghost'], targetPath: 'Ghost' }
    ]);
  });

  it('filters by rule label, ignoring case, and derives nothing for a label no rule defines', async () => {
    const { index } = await createFamilyIndex();
    expect(index.getDerivedRelations('Ivy.md', { label: 'AUNT' })).toHaveLength(2);
    expect(index.getDerivedRelations('Ivy.md', { label: 'parent' })).toStrictEqual([]);
  });

  it('reports every change as a change to any note while the registry has a rule', async () => {
    const { app, index } = await createFamilyIndex();
    index.getDerivedRelations('Alice.md');
    const handler = vi.fn();
    index.on('changed', handler);
    const file = getFile(app, 'Carol.md');
    app.metadataCache.trigger('changed', file, 'mother:: [[Zoe]]\n', ensureNonNullable(app.metadataCache.getFileCache(file)));
    expect(handler).toHaveBeenCalledWith(null);
  });
});

const SUB_LABEL_FILES = {
  'Birth.md': '---\nmother: "[[Birth Gran]]"\n---\n',
  'Birth Gran.md': '',
  'Gran.md': '',
  'Kid.md': '---\nmother: "[[Mom]]"\nbirthMother: "[[Birth]]"\n---\nSee [[Gran]].\n',
  'Mom.md': '---\nmother: "[[Gran]]"\n---\n'
};

const SUB_LABEL_DEFINITIONS = [
  'mother <-> child',
  'birthMother < mother',
  'grandmother = mother -> mother',
  'birthGrandmother = birthMother -> mother',
  'birthGrandmother < grandmother'
];

async function createSubLabelIndex(): Promise<IndexFixture> {
  const fixture = await createIndex(SUB_LABEL_FILES);
  const { definitions, rules, subLabels } = parseRelationDefinitions(SUB_LABEL_DEFINITIONS);
  fixture.index.setRegistry(new RelationRegistry(definitions, rules, subLabels));
  return fixture;
}

describe('RelationIndexComponent sub-labels', () => {
  it('returns only the label it is asked for by default, and its sub-labels too when asked', async () => {
    const { index } = await createSubLabelIndex();
    expect(index.getRelations('Kid.md', { label: 'mother' }).map((relation) => relation.targetPath)).toStrictEqual(['Mom.md']);
    expect(index.getRelations('Kid.md', { includeSubLabels: true, label: 'MOTHER' }).map((relation) => relation.targetPath)).toStrictEqual(['Mom.md', 'Birth.md']);
    expect(index.getRelations('Kid.md', { includeSubLabels: true, label: null }).map((relation) => relation.targetPath)).toStrictEqual(['Gran.md']);
  });

  it('labels an incoming sub-label link with its superset\'s inverse', async () => {
    const { index } = await createSubLabelIndex();
    expect(summarize(index.getRelations('Birth.md', { label: 'child' }))).toStrictEqual([
      { direction: RelationDirection.Incoming, isTargetResolved: true, label: 'child', linkLabel: 'birthMother', sourcePath: 'Kid.md', targetPath: 'Birth.md' }
    ]);
  });

  it('answers the widest superset labels of a label from the registry', async () => {
    const { index } = await createSubLabelIndex();
    expect(index.getRootLabels('birthGrandmother')).toStrictEqual(['grandmother']);
  });

  it('derives through sub-labels and includes sub-label rules only when asked', async () => {
    const { index } = await createSubLabelIndex();
    expect(summarizeDerived(index.getDerivedRelations('Kid.md', { label: 'grandmother' }))).toStrictEqual([
      { isTargetResolved: true, label: 'grandmother', steps: ['Kid.md mother Mom.md', 'Mom.md mother Gran.md'], targetPath: 'Gran.md' }
    ]);
    expect(summarizeDerived(index.getDerivedRelations('Kid.md', { includeSubLabels: true, label: 'grandmother' }))).toStrictEqual([
      { isTargetResolved: true, label: 'grandmother', steps: ['Kid.md mother Mom.md', 'Mom.md mother Gran.md'], targetPath: 'Gran.md' },
      { isTargetResolved: true, label: 'grandmother', steps: ['Kid.md birthMother Birth.md', 'Birth.md mother Birth Gran.md'], targetPath: 'Birth Gran.md' },
      { isTargetResolved: true, label: 'birthGrandmother', steps: ['Kid.md birthMother Birth.md', 'Birth.md mother Birth Gran.md'], targetPath: 'Birth Gran.md' }
    ]);
  });
});

describe('RelationIndexComponent label variants', () => {
  it('reports every change as a change to any note while the registry has a variant', async () => {
    const { app, index } = await createIndex();
    const { definitions, labelVariants } = parseRelationDefinitions(['employee <-> employer', 'employee @ role: lead -> lead']);
    index.setRegistry(new RelationRegistry(definitions, [], [], labelVariants));
    index.getRelations('Bob.md');
    const handler = vi.fn();
    index.on('changed', handler);
    const file = getFile(app, 'Bob.md');
    app.metadataCache.trigger('changed', file, '---\nrole: lead\n---\n', ensureNonNullable(app.metadataCache.getFileCache(file)));
    expect(handler).toHaveBeenCalledWith(null);
  });
});

describe('RelationIndexComponent', () => {
  it('lists a note\'s outgoing relations and plain links, unresolved targets included', async () => {
    const { index } = await createIndex();
    expect(summarize(index.getRelations('Alice.md', { direction: RelationDirection.Outgoing }))).toStrictEqual([
      { direction: RelationDirection.Outgoing, isTargetResolved: true, label: 'employee', linkLabel: 'employee', sourcePath: 'Alice.md', targetPath: 'Bob.md' },
      { direction: RelationDirection.Outgoing, isTargetResolved: true, label: null, linkLabel: null, sourcePath: 'Alice.md', targetPath: 'Carol.md' },
      { direction: RelationDirection.Outgoing, isTargetResolved: false, label: 'mentor', linkLabel: 'mentor', sourcePath: 'Alice.md', targetPath: 'Nobody' }
    ]);
  });

  it('lists incoming relations under their inverse label, or their own label when they have no inverse', async () => {
    const { index } = await createIndex();
    expect(summarize(index.getRelations('Bob.md'))).toStrictEqual([
      { direction: RelationDirection.Incoming, isTargetResolved: true, label: 'employer', linkLabel: 'employee', sourcePath: 'Alice.md', targetPath: 'Bob.md' },
      { direction: RelationDirection.Incoming, isTargetResolved: true, label: 'mentions', linkLabel: 'mentions', sourcePath: 'Carol.md', targetPath: 'Bob.md' }
    ]);
  });

  it('accepts a file as well as a path, and lists plain backlinks with a null label', async () => {
    const { app, index } = await createIndex();
    const carol = ensureNonNullable(app.asOriginalType__().vault.getFileByPath('Carol.md'));
    const relations = index.getRelations(carol, { direction: RelationDirection.Incoming });
    expect(summarize(relations)).toStrictEqual([
      { direction: RelationDirection.Incoming, isTargetResolved: true, label: null, linkLabel: null, sourcePath: 'Alice.md', targetPath: 'Carol.md' }
    ]);
  });

  it('filters by label as seen from the queried note, ignoring case, and by null for the plain links', async () => {
    const { index } = await createIndex();
    expect(index.getRelations('Bob.md', { label: 'EMPLOYER' }).map((relation) => relation.sourcePath)).toStrictEqual(['Alice.md']);
    expect(index.getRelations('Bob.md', { label: 'employee' })).toStrictEqual([]);
    expect(index.getRelations('Alice.md', { label: null }).map((relation) => relation.targetPath)).toStrictEqual(['Carol.md']);
  });

  it('answers a path that names no file with the relations pointing at it', async () => {
    const { index } = await createIndex();
    expect(index.getRelations('Nobody').map((relation) => relation.label)).toStrictEqual(['mentor']);
  });

  it('points a link to a heading of the same note at the note itself', async () => {
    const { index } = await createIndex({ 'Self.md': '# Top\n\nsee:: [[#Top]]\n' });
    expect(summarize(index.getRelations('Self.md', { direction: RelationDirection.Incoming }))).toStrictEqual([
      { direction: RelationDirection.Incoming, isTargetResolved: true, label: 'see', linkLabel: 'see', sourcePath: 'Self.md', targetPath: 'Self.md' }
    ]);
  });

  it('answers the inverse of a label from the current registry', async () => {
    const { index } = await createIndex();
    expect(index.getInverseLabel('Employee')).toBe('employer');
    expect(index.getInverseLabel('mentions')).toBeNull();
  });

  it('labels incoming relations from the current registry without re-indexing', async () => {
    const { index } = await createIndex();
    index.setRegistry(new RelationRegistry(parseRelationDefinitions(['employee <-> boss']).definitions));
    expect(index.getRelations('Bob.md', { label: 'boss' })).toHaveLength(1);
  });

  it('updates a note incrementally when its metadata changes, and names the notes it touched', async () => {
    const { app, index } = await createIndex();
    index.getRelations('Bob.md');
    const onChanged = vi.fn();
    index.on('changed', onChanged);

    await app.vault.modify(getFile(app, 'Alice.md'), 'employee:: [[Carol]]\n');

    expect(onChanged).toHaveBeenCalledWith(['Alice.md', 'Bob.md', 'Carol.md', 'Nobody']);
    expect(index.getRelations('Bob.md', { label: 'employer' })).toStrictEqual([]);
    expect(index.getRelations('Carol.md', { label: 'employer' }).map((relation) => relation.sourcePath)).toStrictEqual(['Alice.md']);
    expect(index.getRelations('Nobody')).toStrictEqual([]);
  });

  it('indexes a created note and resolves the links that pointed at its name', async () => {
    const { app, index } = await createIndex();
    await app.vault.create('Nobody.md', 'employee:: [[Bob]]\n');
    expect(index.getRelations('Nobody.md', { direction: RelationDirection.Incoming }).map((relation) => relation.sourcePath)).toStrictEqual(['Alice.md']);
    expect(index.getRelations('Bob.md', { label: 'employer' }).map((relation) => relation.sourcePath)).toStrictEqual(['Alice.md', 'Nobody.md']);
  });

  it('moves a renamed note\'s relations to its new path', async () => {
    const { app, index } = await createIndex();
    await app.vault.rename(getFile(app, 'Alice.md'), 'Alicia.md');
    expect(index.getRelations('Alicia.md', { label: 'employee' }).map((relation) => relation.targetPath)).toStrictEqual(['Bob.md']);
    expect(index.getRelations('Alice.md', { direction: RelationDirection.Outgoing })).toStrictEqual([]);
  });

  it('re-resolves after a rename of a note nothing indexed, such as an attachment', async () => {
    const { app, index } = await createIndex({ 'Note.md': 'photo:: ![[Old.png]]\n', 'Old.png': '' });
    await app.vault.rename(getFile(app, 'Old.png'), 'New.png');
    expect(index.getRelations('Note.md').map((relation) => relation.isTargetResolved)).toStrictEqual([false]);
  });

  it('drops a deleted note\'s relations and leaves the links to it unresolved', async () => {
    const { app, index } = await createIndex();
    await app.fileManager.trashFile(getFile(app, 'Bob.md'));
    expect(index.getRelations('Bob.md')).toStrictEqual([]);
    expect(index.getRelations('Bob').map((relation) => relation.isTargetResolved)).toStrictEqual([false, false]);
    await app.fileManager.trashFile(getFile(app, 'Carol.md'));
    expect(index.getRelations('Bob').map((relation) => relation.sourcePath)).toStrictEqual(['Alice.md']);
  });

  it('keeps an edit that arrives while the index is being rebuilt', async () => {
    const { app, index } = await createIndex();
    const vault = app.vault;
    const cachedRead = vault.cachedRead.bind(vault);
    vi.spyOn(vault, 'cachedRead').mockImplementation(async (file) => {
      const content = await cachedRead(file);
      if (file.path === 'Alice.md') {
        await vault.modify(file, 'employee:: [[Carol]]\n');
      }
      return content;
    });

    await index.rebuild();
    expect(index.getRelations('Alice.md', { label: 'employee' }).map((relation) => relation.targetPath)).toStrictEqual(['Carol.md']);
  });

  it('indexes the vault once the layout is ready', async () => {
    const app = App.createConfigured__({ files: FILES });
    const index = new RelationIndexComponent(app.asOriginalType__());
    index.load();
    app.workspace.setLayoutReady__();
    await vi.waitUntil(() => index.getStats().noteCount === 3);
    expect(index.getStats()).toStrictEqual({ noteCount: 3, relationCount: 4 });
  });

  it('skips a note the metadata cache has not parsed yet', async () => {
    const { app, index } = await createIndex();
    vi.spyOn(app.metadataCache, 'getFileCache').mockReturnValue(null);
    await index.rebuild();
    expect(index.getStats()).toStrictEqual({ noteCount: 0, relationCount: 0 });
  });

  it('indexes no references for a file that is not a note', async () => {
    const { app, index } = await createIndex();
    const canvas = await app.vault.create('Canvas.canvas', '{}');
    index.getRelations('Bob.md');
    app.metadataCache.trigger('changed', canvas, '{}', { links: [] });
    expect(index.getRelations('Canvas.canvas')).toStrictEqual([]);
  });

  it('stops notifying a handler removed with offref', async () => {
    const { app, index } = await createIndex();
    const onChanged = vi.fn();
    index.offref(index.on('changed', onChanged));
    await app.vault.modify(getFile(app, 'Bob.md'), '# Bob again\n');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('reports a stale resolution to its handlers as a change to any note', async () => {
    const { app, index } = await createIndex();
    const onChanged = vi.fn();
    index.on('changed', onChanged);
    await app.vault.create('Dave.md', '# Dave\n');
    expect(onChanged).toHaveBeenCalledWith(null);
  });
});

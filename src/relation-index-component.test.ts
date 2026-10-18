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

import type { Relation } from './relation-index-component.ts';

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

import type {
  Reference,
  TFile
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Relation } from '../relation-index-component.ts';

import {
  RelationDirection,
  RelationIndexComponent
} from '../relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from '../relation-registry.ts';
import {
  RELATIONS_VIEW_TYPE,
  RelationsView
} from './relations-view.ts';

interface PaneGroup {
  readonly label: string;
  readonly rows: readonly string[];
}

interface PaneSection {
  readonly groups: readonly PaneGroup[];
  readonly title: string;
}

interface ViewFixture {
  readonly app: App;
  readonly index: RelationIndexComponent;
  readonly view: RelationsView;
}

const FILES = {
  'Alice.md': '---\nEmployee: "[[Bob]]"\n---\nSee [[Carol]] often.\nmentor:: [[Nobody]]\nemployee:: [[Dan]]\n',
  'Bob.md': '# Bob\nmentions:: [[Alice]]\n',
  'Carol.md': 'spouse:: [[Alice]]\n',
  'Dan.md': '# Dan\n',
  'Eve.md': 'Back to [[Alice]].\n',
  'Gallery.md': 'Look: ![[Photo.png]]\n',
  'Lonely.md': '# Lonely\n',
  'Photo.png': ''
};

async function createFixture(): Promise<ViewFixture> {
  const app = App.createConfigured__({ files: FILES });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  index.setRegistry(new RelationRegistry(parseRelationDefinitions(['employee <-> employer', 'spouse <-> spouse']).definitions));
  await index.rebuild();
  const view = new RelationsView({ leaf: WorkspaceLeaf.create2__(app).asOriginalType3__(), relationIndex: index });
  return { app, index, view };
}

function createRelation(reference: Reference, sourcePath: string): Relation {
  return {
    direction: RelationDirection.Incoming,
    isTargetResolved: true,
    label: null,
    linkLabel: null,
    reference,
    sourcePath,
    targetPath: 'Alice.md'
  };
}

function getFile(app: App, path: string): TFile {
  return ensureNonNullable(app.asOriginalType__().vault.getFileByPath(path));
}

function readPane(view: RelationsView): PaneSection[] {
  return [...view.contentEl.querySelectorAll('.labelled-links-relations-section')].map((sectionEl) => ({
    groups: [...sectionEl.querySelectorAll('.labelled-links-relations-group')].map((groupEl) => ({
      label: groupEl.querySelector('.labelled-links-relations-group-title')?.textContent ?? '',
      rows: [...groupEl.querySelectorAll('.labelled-links-relation')].map((rowEl) => [...rowEl.children].map((el) => el.textContent).join(' | '))
    })),
    title: sectionEl.querySelector('.labelled-links-relations-section-title')?.textContent ?? ''
  }));
}

function triggerMetadataChanged(app: App, path: string): void {
  const { metadataCache } = app.asOriginalType__();
  const file = getFile(app, path);
  metadataCache.trigger('changed', file, FILES[path as keyof typeof FILES], ensureNonNullable(metadataCache.getFileCache(file)));
}

describe('RelationsView', () => {
  it('names itself and its view type', async () => {
    const { view } = await createFixture();
    expect(view.getViewType()).toBe(RELATIONS_VIEW_TYPE);
    expect(view.getDisplayText()).toBe('Relations');
    expect(view.getIcon()).toBe('arrow-right-left');
  });

  it('asks for a note when none is open', async () => {
    const { view } = await createFixture();
    await view.setFile(null);
    expect(view.contentEl.querySelector('.pane-empty')?.textContent).toBe('Open a note to see its relations.');
  });

  it('says so when the note has no relations, links or backlinks', async () => {
    const { app, view } = await createFixture();
    await view.setFile(getFile(app, 'Lonely.md'));
    expect(view.contentEl.querySelector('.labelled-links-relations-title')?.textContent).toBe('Lonely');
    expect(view.contentEl.querySelector('.pane-empty')?.textContent).toBe('This note has no relations, links or backlinks.');
  });

  it('groups outgoing and incoming relations by label, ignoring case, and lists plain links and backlinks with their line', async () => {
    const { app, view } = await createFixture();
    await view.setFile(getFile(app, 'Alice.md'));
    expect(readPane(view)).toStrictEqual([
      {
        groups: [
          { label: 'Employee', rows: ['Bob', 'Dan'] },
          { label: 'mentor', rows: ['Nobody'] }
        ],
        title: 'Outgoing'
      },
      {
        groups: [
          { label: 'mentions', rows: ['Bob'] },
          { label: 'spouse', rows: ['Carol'] }
        ],
        title: 'Incoming'
      },
      {
        groups: [
          { label: 'Links', rows: ['Carol | See [[Carol]] often.'] },
          { label: 'Backlinks', rows: ['Eve | Back to [[Alice]].'] }
        ],
        title: 'Unlabelled'
      }
    ]);
    const unresolvedEl = view.contentEl.querySelector('.labelled-links-relation-link.is-unresolved');
    expect(unresolvedEl?.textContent).toBe('Nobody');
  });

  it('shows the label an incoming relation is written with when it differs from its inverse', async () => {
    const { app, view } = await createFixture();
    await view.setFile(getFile(app, 'Bob.md'));
    expect(readPane(view)).toStrictEqual([
      { groups: [{ label: 'mentions', rows: ['Alice'] }], title: 'Outgoing' },
      { groups: [{ label: 'employer', rows: ['Alice | Alice --Employee--> Bob'] }], title: 'Incoming' }
    ]);
    expect(view.contentEl.querySelector('.labelled-links-relation-written-label')?.getAttribute('aria-label')).toBe(
      'Alice links to Bob with the label "Employee", read from this end as "employer".'
    );
  });

  it('keeps the extension of a target that is not a note', async () => {
    const { app, view } = await createFixture();
    await view.setFile(getFile(app, 'Gallery.md'));
    expect(readPane(view)).toStrictEqual([{ groups: [{ label: 'Links', rows: ['Photo.png | Look: ![[Photo.png]]'] }], title: 'Unlabelled' }]);
  });

  it('opens the other note on click, in a new tab with the modifier key, and asks for a page preview on hover', async () => {
    const { app, view } = await createFixture();
    const openLinkText = vi.spyOn(app.workspace, 'openLinkText').mockResolvedValue();
    const trigger = vi.spyOn(app.workspace, 'trigger');
    await view.setFile(getFile(app, 'Bob.md'));
    const linkEl = ensureNonNullable(view.contentEl.querySelector<HTMLElement>('.labelled-links-relation-link'));

    linkEl.dispatchEvent(new MouseEvent('click', { cancelable: true }));
    linkEl.dispatchEvent(new MouseEvent('click', { cancelable: true, ctrlKey: true }));
    await vi.waitFor(() => {
      expect(openLinkText).toHaveBeenCalledTimes(2);
    });
    expect(openLinkText).toHaveBeenNthCalledWith(1, 'Alice.md', 'Bob.md', false);
    expect(openLinkText.mock.calls[1]?.[2]).toBeTruthy();

    linkEl.dispatchEvent(new MouseEvent('mouseover'));
    expect(trigger).toHaveBeenCalledWith(
      'hover-link',
      expect.objectContaining({
        hoverParent: view,
        linktext: 'Alice.md',
        source: RELATIONS_VIEW_TYPE,
        sourcePath: 'Bob.md',
        targetEl: linkEl
      })
    );
  });

  it('shows no snippet for a reference with no position, a source that is gone or a line past the end', async () => {
    const { app } = await createFixture();
    const relationIndex = strictProxy<RelationIndexComponent>({
      getRelations: () => [
        createRelation({ link: 'Alice', original: '[[Alice]]' }, 'Eve.md'),
        createRelation(castTo<Reference>({ link: 'Alice', original: '[[Alice]]', position: { start: { line: 0 } } }), 'Gone.md'),
        createRelation(castTo<Reference>({ link: 'Alice', original: '[[Alice]]', position: { start: { line: 99 } } }), 'Eve.md')
      ]
    });
    const view = new RelationsView({ leaf: WorkspaceLeaf.create2__(app).asOriginalType3__(), relationIndex });
    await view.setFile(getFile(app, 'Alice.md'));
    expect([...view.contentEl.querySelectorAll('.labelled-links-relation-snippet')].map((el) => el.textContent)).toStrictEqual(['', '', '']);
  });

  it('drops a refresh that a newer one overtook', async () => {
    const { app, view } = await createFixture();
    const first = view.setFile(getFile(app, 'Alice.md'));
    await view.setFile(getFile(app, 'Lonely.md'));
    await first;
    expect(view.contentEl.querySelector('.labelled-links-relations-title')?.textContent).toBe('Lonely');
    expect(view.contentEl.querySelector('.labelled-links-relation-snippet')).toBeNull();
  });

  it('follows the active note and redraws when the index changes the note it shows, until it closes', async () => {
    const { app, index, view } = await createFixture();
    const leaf = WorkspaceLeaf.create2__(app);
    vi.spyOn(app.asOriginalType__().workspace, 'getActiveFile').mockReturnValue(getFile(app, 'Lonely.md'));
    await leaf.open(view);
    expect(view.contentEl.querySelector('.labelled-links-relations-title')?.textContent).toBe('Lonely');

    app.asOriginalType__().workspace.trigger('file-open', getFile(app, 'Dan.md'));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector('.labelled-links-relations-title')?.textContent).toBe('Dan');
    });

    const refresh = vi.spyOn(view, 'refresh');
    index.setRegistry(new RelationRegistry([]));
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(readPane(view)).toStrictEqual([{ groups: [{ label: 'employee', rows: ['Alice'] }], title: 'Incoming' }]);

    // Eve's links touch Eve and Alice only, so the pane showing Dan ignores them; Dan's own change does not.
    triggerMetadataChanged(app, 'Eve.md');
    triggerMetadataChanged(app, 'Dan.md');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    await view.setFile(null);
    refresh.mockClear();
    index.setRegistry(new RelationRegistry([]));
    expect(refresh).not.toHaveBeenCalled();

    view.unload();
    await view.setFile(getFile(app, 'Dan.md'));
    refresh.mockClear();
    index.setRegistry(new RelationRegistry([]));
    expect(refresh).not.toHaveBeenCalled();
  });
});

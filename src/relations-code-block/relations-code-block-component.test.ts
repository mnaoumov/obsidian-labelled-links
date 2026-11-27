import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { RelationIndexComponent } from '../relation-index/relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from '../relation-registry/relation-registry.ts';
import { RELATION_LIST_HOVER_SOURCE } from '../relations-pane/relation-list-renderer.ts';
import { RelationsCodeBlockComponent } from './relations-code-block-component.ts';

interface BlockFixture {
  readonly app: App;
  readonly block: RelationsCodeBlockComponent;
  readonly index: RelationIndexComponent;
}

interface BlockGroup {
  readonly label: string;
  readonly rows: readonly string[];
}

interface BlockSection {
  readonly groups: readonly BlockGroup[];
  readonly title: string;
}

interface IndexTrigger {
  readonly triggerChanged: (paths: null | readonly string[]) => void;
}

const FILES = {
  'Alice.md': '---\nchild: "[[Bob]]"\nbirthChild: "[[Kid]]"\n---\nspouse:: [[Dan]]\nSee [[Carol]].\n',
  'Bob.md': '# Bob\nchild:: [[Erin]]\n',
  'Carol.md': '',
  'Dan.md': '',
  'Erin.md': '',
  'Kid.md': '',
  'Lonely.md': ''
};

const DEFINITIONS = ['child <-> parent', 'spouse <-> spouse', 'birthChild < child', 'grandchild = child -> child'];

async function createFixture(source: string, sourcePath = 'Alice.md', lines = DEFINITIONS): Promise<BlockFixture> {
  const app = App.createConfigured__({ files: FILES });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  const { definitions, rules, subLabels } = parseRelationDefinitions(lines);
  index.setRegistry(new RelationRegistry(definitions, rules, subLabels));
  await index.rebuild();
  const block = new RelationsCodeBlockComponent({
    app: app.asOriginalType__(),
    containerEl: createDiv(),
    relationIndex: index,
    source,
    sourcePath
  });
  return { app, block, index };
}

async function loadBlock(block: RelationsCodeBlockComponent): Promise<void> {
  const refresh = vi.spyOn(block, 'refresh');
  block.load();
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalled();
  });
  await refresh.mock.results[0]?.value;
  refresh.mockRestore();
}

function readBlock(block: RelationsCodeBlockComponent): BlockSection[] {
  return [...block.containerEl.querySelectorAll('.labelled-links-relations-section')].map((sectionEl) => ({
    groups: [...sectionEl.querySelectorAll('.labelled-links-relations-group')].map((groupEl) => ({
      label: groupEl.querySelector('.labelled-links-relations-group-title')?.textContent ?? '',
      rows: [...groupEl.querySelectorAll('.labelled-links-relation')].map((rowEl) => [...rowEl.children].map((el) => el.textContent).join(' | '))
    })),
    title: sectionEl.querySelector('.labelled-links-relations-section-title')?.textContent ?? ''
  }));
}

function readMessage(block: RelationsCodeBlockComponent): string {
  return block.containerEl.querySelector('.pane-empty')?.textContent ?? '';
}

function triggerChanged(index: RelationIndexComponent, paths: null | readonly string[]): void {
  castTo<IndexTrigger>(index).triggerChanged(paths);
}

describe('RelationsCodeBlockComponent', () => {
  it('lists the host note\'s labelled and derived relations, without its plain links, by default', async () => {
    const { block } = await createFixture('');
    await loadBlock(block);
    expect(block.containerEl.hasClass('labelled-links-relations-code-block')).toBe(true);
    expect(readBlock(block)).toStrictEqual([
      {
        groups: [
          { label: 'birthChild', rows: ['Kid'] },
          { label: 'child', rows: ['Bob'] },
          { label: 'spouse', rows: ['Dan'] }
        ],
        title: 'Outgoing'
      },
      { groups: [{ label: 'grandchild', rows: ['Erin | Erin is Alice\'s grandchild'] }], title: 'Derived' }
    ]);
  });

  it('lists another note, picked by its link, with only the labels asked for and the plain links', async () => {
    const { block } = await createFixture('center: [[Bob]]\nlabels: parent, child\nunlabelled: true', 'Carol.md');
    await loadBlock(block);
    expect(readBlock(block)).toStrictEqual([
      { groups: [{ label: 'child', rows: ['Erin'] }], title: 'Outgoing' },
      { groups: [{ label: 'parent', rows: ['Alice | Bob is Alice\'s child'] }], title: 'Incoming' }
    ]);
  });

  it('leaves out hidden labels and derived relations, and groups sub-labels under their superset when asked', async () => {
    const { block } = await createFixture('hide: spouse\nderived: false\nsub-labels: true\nunlabelled: yes');
    await loadBlock(block);
    expect(readBlock(block)).toStrictEqual([
      { groups: [{ label: 'child', rows: ['Bob', 'Kid | birthChild'] }], title: 'Outgoing' },
      { groups: [{ label: 'Links', rows: ['Carol | See [[Carol]].'] }], title: 'Unlabelled' }
    ]);
  });

  it('hides a derived label too, and says so when nothing is left to list', async () => {
    const { block } = await createFixture('hide: grandchild, child, birthChild, spouse');
    await loadBlock(block);
    expect(readBlock(block)).toStrictEqual([]);
    expect(readMessage(block)).toBe('Alice has no relations to list here.');
  });

  it('says so for a note with no relations at all', async () => {
    const { block } = await createFixture('', 'Lonely.md');
    await loadBlock(block);
    expect(readMessage(block)).toBe('Lonely has no relations to list here.');
  });

  it('names a center that matches no note, and a host note that is gone', async () => {
    const missing = await createFixture('center: Nobody');
    await loadBlock(missing.block);
    expect(readMessage(missing.block)).toBe('No note matches "Nobody".');

    const gone = await createFixture('', 'Gone.md');
    await loadBlock(gone.block);
    expect(readMessage(gone.block)).toBe('No note matches "Gone.md".');
  });

  it('lists the lines it cannot read instead of the relations', async () => {
    const { block } = await createFixture('depth: 2\nderived: maybe');
    await loadBlock(block);
    expect(block.containerEl.querySelector('.labelled-links-relations-code-block-error')?.textContent).toBe(
      'This block could not be read:'
        + 'Unknown option "depth". The options are center, derived, hide, labels, sub-labels, unlabelled.'
        + '"derived" takes true or false, not "maybe".'
    );
    expect(readBlock(block)).toStrictEqual([]);
  });

  it('raises page previews from its rows as their own owner', async () => {
    const { app, block } = await createFixture('');
    await loadBlock(block);
    const trigger = vi.spyOn(app.workspace, 'trigger');
    ensureNonNullable(block.containerEl.querySelector('.labelled-links-relation-link')).dispatchEvent(new MouseEvent('mouseover'));
    expect(trigger).toHaveBeenCalledWith(
      'hover-link',
      expect.objectContaining({ hoverParent: block, linktext: 'Kid.md', source: RELATION_LIST_HOVER_SOURCE, sourcePath: 'Alice.md' })
    );
    expect(block.hoverPopover).toBeNull();
  });

  it('redraws when the index changes the note it lists, and after any change while its note is missing, until it unloads', async () => {
    // A registry with a rule widens every change to all notes, so this one has none.
    const { block, index } = await createFixture('', 'Alice.md', ['child <-> parent']);
    await loadBlock(block);
    const refresh = vi.spyOn(block, 'refresh');

    triggerChanged(index, ['Lonely.md']);
    triggerChanged(index, ['Alice.md']);
    triggerChanged(index, null);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    const missing = await createFixture('center: Nobody');
    await loadBlock(missing.block);
    const missingRefresh = vi.spyOn(missing.block, 'refresh');
    triggerChanged(missing.index, ['Lonely.md']);
    await vi.waitFor(() => {
      expect(missingRefresh).toHaveBeenCalledTimes(1);
    });

    block.unload();
    refresh.mockClear();
    triggerChanged(index, null);
    await noopAsync();
    expect(refresh).not.toHaveBeenCalled();
  });
});

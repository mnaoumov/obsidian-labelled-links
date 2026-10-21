import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  createLinkBadgeEl,
  getLinkBadge,
  getPositionedRelations,
  isRelationInText,
  LINK_BADGE_CLASS
} from './link-badge.ts';
import { RelationIndexComponent } from './relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

const ALICE_CONTENT = '---\nchild: "[[Bob]]"\n---\nspouse:: [[Dan]]\nSee [[Carol]] and ![[Photo.png]] [mentor:: [[Ghost]]]\n';

async function createIndex(): Promise<RelationIndexComponent> {
  const app = App.createConfigured__({
    files: { 'Alice.md': ALICE_CONTENT, 'Bob.md': '# Bob\n', 'Carol.md': '# Carol\n', 'Dan.md': '# Dan\n', 'Photo.png': '' }
  });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  index.setRegistry(new RelationRegistry(parseRelationDefinitions(['parent <-> child', 'spouse <-> spouse']).definitions));
  await index.rebuild();
  return index;
}

describe('getPositionedRelations', () => {
  it('lists the body links in the order they are written, leaving out properties and embeds', async () => {
    const index = await createIndex();
    const relations = getPositionedRelations(index, 'Alice.md');
    expect(relations.map((relation) => [relation.reference.original, relation.linkLabel])).toEqual([
      ['[[Dan]]', 'spouse'],
      ['[[Carol]]', null],
      ['[[Ghost]]', 'mentor']
    ]);
  });
});

describe('getLinkBadge', () => {
  it('names the relation and its inverse', async () => {
    const index = await createIndex();
    const [dan] = getPositionedRelations(index, 'Alice.md');
    expect(getLinkBadge(index, ensureNonNullable(dan))).toEqual({
      label: 'spouse',
      tooltip: 'Dan is Alice\'s spouse\nAlice is Dan\'s spouse'
    });
  });

  it('says so when the registry has no inverse, and names an unresolved target by its link', async () => {
    const index = await createIndex();
    const ghost = getPositionedRelations(index, 'Alice.md')[2];
    expect(getLinkBadge(index, ensureNonNullable(ghost))).toEqual({
      label: 'mentor',
      tooltip: 'Ghost is Alice\'s mentor\nNo inverse label is registered for "mentor".'
    });
  });

  it('gives a plain link no badge', async () => {
    const index = await createIndex();
    const carol = getPositionedRelations(index, 'Alice.md')[1];
    expect(getLinkBadge(index, ensureNonNullable(carol))).toBeNull();
  });
});

describe('isRelationInText', () => {
  it('trusts a cached offset only while the text there is still the link', async () => {
    const index = await createIndex();
    const dan = ensureNonNullable(getPositionedRelations(index, 'Alice.md')[0]);
    expect(isRelationInText(ALICE_CONTENT, dan)).toBe(true);
    expect(isRelationInText(`x${ALICE_CONTENT}`, dan)).toBe(false);
  });
});

describe('createLinkBadgeEl', () => {
  it('shows the label, with the tooltip as its accessible name', () => {
    const badgeEl = createLinkBadgeEl({ label: 'spouse', tooltip: 'one\ntwo' });
    expect(badgeEl.className).toBe(LINK_BADGE_CLASS);
    expect(badgeEl.textContent).toBe('spouse');
    expect(badgeEl.getAttribute('aria-label')).toBe('one\ntwo');
  });
});

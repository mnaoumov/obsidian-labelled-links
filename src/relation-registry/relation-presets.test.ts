import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { RelationIndexComponent } from '../relation-index/relation-index-component.ts';
import {
  FAMILY_PRESET,
  getIncludedPresetLines,
  getOverriddenPresetLines,
  RELATION_PRESETS,
  togglePreset
} from './relation-presets.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

const FAMILY_FILES = {
  'Alice.md': '---\ngender: female\nparent: "[[Gran]]"\n---\n',
  'Bob.md': '---\ngender: male\nparent: "[[Gran]]"\n---\n',
  'Carol.md': '---\ngender: female\nparent: "[[Alice]]"\n---\n',
  'Dan.md': '---\ngender: male\n---\n',
  'Ed.md': '---\ngender: male\ndeathDate: 1990-01-01\n---\n',
  'Fay.md': '---\ngender: female\n---\n',
  'Gran.md': '---\ngender: female\n---\n',
  'Gran and Ed.md': '---\npartner:\n  - "[[Gran]]"\n  - "[[Ed]]"\n---\n',
  'Hal.md': '---\ngender: male\n---\n',
  'Hal and Ivy.md': '---\npartner:\n  - "[[Hal]]"\n  - "[[Ivy]]"\n---\n',
  'Ivy.md': '---\ngender: female\n---\n',
  'Jo.md': '---\nparent:\n  - "[[Hal]]"\n  - "[[Ivy]]"\n---\n',
  'Kid.md': '---\nparent: "[[Bob]]"\n---\n',
  'Split.md': '---\npartner:\n  - "[[Bob]]"\n  - "[[Fay]]"\ndivorceDate: 2010-05-06\n---\n',
  'Wedding.md': '---\npartner:\n  - "[[Alice]]"\n  - "[[Dan]]"\nmarriageDate: 2001-02-03\n---\n'
};

async function createFamilyIndex(): Promise<RelationIndexComponent> {
  const app = App.createConfigured__({ files: FAMILY_FILES });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  const { definitions, labelVariants, rules, subLabels } = parseRelationDefinitions(getIncludedPresetLines(['family']));
  index.setRegistry(new RelationRegistry(definitions, rules, subLabels, labelVariants));
  await index.rebuild();
  return index;
}

function summarizeShown(index: RelationIndexComponent, path: string): string[] {
  return index.getDerivedRelations(path).map((relation) => `${relation.targetPath} ${index.getShownLabel(relation.label, relation.targetPath)}`);
}

describe('FAMILY_PRESET', () => {
  it('is bundled, and every line of it is valid', () => {
    expect(RELATION_PRESETS).toContain(FAMILY_PRESET);
    expect(parseRelationDefinitions(FAMILY_PRESET.lines).errors).toStrictEqual([]);
  });

  it('derives the relatives and shows each by the gender of the note it describes', async () => {
    const index = await createFamilyIndex();
    expect(summarizeShown(index, 'Alice.md')).toStrictEqual(['Dan.md husband', 'Bob.md brother', 'Kid.md nieceOrNephew']);
    expect(summarizeShown(index, 'Dan.md')).toStrictEqual(['Alice.md wife', 'Carol.md stepDaughter', 'Gran.md motherInLaw', 'Bob.md brotherInLaw']);
    expect(summarizeShown(index, 'Carol.md')).toStrictEqual(['Dan.md stepFather', 'Gran.md grandmother', 'Bob.md uncle', 'Kid.md cousin']);
    expect(summarizeShown(index, 'Gran.md')).toStrictEqual(['Ed.md lateHusband', 'Carol.md granddaughter', 'Kid.md grandchild', 'Dan.md sonInLaw']);
  });

  it('tells current, ex and late spouses apart, and leaves a step-parent who is a parent out', async () => {
    const index = await createFamilyIndex();
    expect(summarizeShown(index, 'Bob.md')).toContain('Fay.md exWife');
    expect(summarizeShown(index, 'Fay.md')).toStrictEqual(['Bob.md exHusband']);
    expect(summarizeShown(index, 'Ed.md')).toContain('Gran.md wife');
    expect(summarizeShown(index, 'Gran.md')).toContain('Ed.md lateHusband');
    expect(summarizeShown(index, 'Gran.md')).not.toContain('Ed.md husband');
    expect(summarizeShown(index, 'Jo.md')).toStrictEqual([]);
    expect(summarizeShown(index, 'Hal.md')).toStrictEqual(['Ivy.md wife']);
  });

  it('shows a stored relation by the gender of the note it describes', async () => {
    const index = await createFamilyIndex();
    const [relation] = index.getRelations('Carol.md', { label: 'parent' });
    expect(index.getShownLabel('parent', relation?.targetPath ?? '')).toBe('mother');
    expect(index.getShownLabel('child', 'Carol.md')).toBe('daughter');
    expect(index.getShownLabel('child', 'Kid.md')).toBe('child');
    expect(index.getShownLabel('child', 'Nobody.md')).toBe('child');
  });
});

describe('getIncludedPresetLines', () => {
  it('reads the lines of the included presets, ignoring an unknown id', () => {
    expect(getIncludedPresetLines(['unknown', 'family'])).toStrictEqual(FAMILY_PRESET.lines);
    expect(getIncludedPresetLines([])).toStrictEqual([]);
  });
});

describe('getOverriddenPresetLines', () => {
  it('names the preset lines defining a label the user\'s lines define', () => {
    expect(getOverriddenPresetLines(['parent <-> kid', 'sibling = parent -> kid', 'spouse @ sex: f -> wife', 'bad <->'], FAMILY_PRESET)).toStrictEqual([
      'parent <-> child',
      'sibling = parent -> child',
      'spouse @ gender: female -> wife, male -> husband'
    ]);
    expect(getOverriddenPresetLines([], FAMILY_PRESET)).toStrictEqual([]);
  });
});

describe('togglePreset', () => {
  it('adds a preset id once and removes it', () => {
    expect(togglePreset(['a'], 'family', true)).toStrictEqual(['a', 'family']);
    expect(togglePreset(['family', 'a'], 'family', true)).toStrictEqual(['a', 'family']);
    expect(togglePreset(['family', 'a'], 'family', false)).toStrictEqual(['a']);
  });
});

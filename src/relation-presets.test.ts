import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { RelationIndexComponent } from './relation-index-component.ts';
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
  'Gran.md': '---\ngender: female\n---\n',
  'Kid.md': '---\nparent: "[[Bob]]"\n---\n',
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
    expect(summarizeShown(index, 'Dan.md')).toStrictEqual(['Alice.md wife', 'Gran.md motherInLaw', 'Bob.md brotherInLaw']);
    expect(summarizeShown(index, 'Carol.md')).toStrictEqual(['Gran.md grandmother', 'Bob.md uncle', 'Kid.md cousin']);
    expect(summarizeShown(index, 'Gran.md')).toStrictEqual(['Carol.md granddaughter', 'Kid.md grandchild', 'Dan.md sonInLaw']);
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

import { parseRelationDefinitions } from './relation-registry.ts';

/**
 * A named, versioned bundle of registry lines a user includes from the settings with one click.
 *
 * Its lines are read after the user's own, so a user's line that defines the same label wins.
 */
export interface RelationPreset {
  /**
   * What the preset models, for the settings.
   */
  readonly description: string;

  /**
   * The id the settings store when the preset is included. It never changes.
   */
  readonly id: string;

  /**
   * The registry lines, in the syntax the relation registry setting takes.
   */
  readonly lines: readonly string[];

  /**
   * The name shown in the settings.
   */
  readonly name: string;

  /**
   * The preset's version, raised whenever its lines change.
   */
  readonly version: string;
}

/**
 * Kinship: parents and children (a birth parent is a kind of parent), partners joined by a partnership note, and
 * the relatives derived from them, each shown as its gendered variant by the `gender` property. Labels follow
 * Google Contacts' relation labels where one exists.
 */
export const FAMILY_PRESET: RelationPreset = {
  description: 'Parents and children, birth parents, partners joined by a partnership note, and the relatives derived from them: '
    + 'spouses (current and living, ex by the partnership\'s divorceDate, late by the partner\'s deathDate), step-parents and step-children, '
    + 'siblings, grandparents, aunts and uncles, nieces and nephews, cousins and in-laws, '
    + 'each shown as mother or father, wife or husband and so on by the gender property of the note it describes.',
  id: 'family',
  lines: [
    'parent <-> child',
    'birthParent <-> birthChild',
    'birthParent < parent',
    'partner <-> partnership',
    'spouse <-> spouse',
    'spouse = partnership[!divorceDate] -> partner[!deathDate]',
    'exSpouse <-> exSpouse',
    'exSpouse = partnership[divorceDate] -> partner',
    'lateSpouse = partnership[!divorceDate] -> partner[deathDate]',
    'stepParent <-> stepChild',
    'stepParent = parent -> spouse except parent',
    'stepChild = spouse -> child except child',
    'sibling <-> sibling',
    'sibling = parent -> child',
    'grandparent <-> grandchild',
    'grandparent = parent -> parent',
    'grandchild = child -> child',
    'auntOrUncle <-> nieceOrNephew',
    'auntOrUncle = parent -> sibling',
    'nieceOrNephew = sibling -> child',
    'cousin <-> cousin',
    'cousin = parent -> sibling -> child',
    'parentInLaw <-> childInLaw',
    'parentInLaw = spouse -> parent',
    'childInLaw = child -> spouse',
    'siblingInLaw <-> siblingInLaw',
    'siblingInLaw = spouse -> sibling | sibling -> spouse',
    'parent @ gender: female -> mother, male -> father',
    'child @ gender: female -> daughter, male -> son',
    'birthParent @ gender: female -> birthMother, male -> birthFather',
    'birthChild @ gender: female -> birthDaughter, male -> birthSon',
    'spouse @ gender: female -> wife, male -> husband',
    'exSpouse @ gender: female -> exWife, male -> exHusband',
    'lateSpouse @ gender: female -> lateWife, male -> lateHusband',
    'stepParent @ gender: female -> stepMother, male -> stepFather',
    'stepChild @ gender: female -> stepDaughter, male -> stepSon',
    'sibling @ gender: female -> sister, male -> brother',
    'grandparent @ gender: female -> grandmother, male -> grandfather',
    'grandchild @ gender: female -> granddaughter, male -> grandson',
    'auntOrUncle @ gender: female -> aunt, male -> uncle',
    'nieceOrNephew @ gender: female -> niece, male -> nephew',
    'parentInLaw @ gender: female -> motherInLaw, male -> fatherInLaw',
    'childInLaw @ gender: female -> daughterInLaw, male -> sonInLaw',
    'siblingInLaw @ gender: female -> sisterInLaw, male -> brotherInLaw'
  ],
  name: 'Family',
  version: '1.1.0'
};

/**
 * Every preset the plugin bundles, in the order the settings list them.
 */
export const RELATION_PRESETS: readonly RelationPreset[] = [FAMILY_PRESET];

/**
 * Gets the registry lines of the included presets, in the order the plugin bundles them. An id no bundled preset
 * has is ignored.
 *
 * @param presetIds - The ids of the included presets.
 * @returns The lines.
 */
export function getIncludedPresetLines(presetIds: readonly string[]): string[] {
  return RELATION_PRESETS.filter((preset) => presetIds.includes(preset.id)).flatMap((preset) => preset.lines);
}

/**
 * Gets the lines of a preset that the user's own registry lines override: each one defines a label a user's line
 * already defines, so the user's line is used.
 *
 * @param userLines - The user's registry lines.
 * @param preset - The preset.
 * @returns The overridden lines, as the preset writes them.
 */
export function getOverriddenPresetLines(userLines: readonly string[], preset: RelationPreset): string[] {
  const userErrorCount = parseRelationDefinitions(userLines).errors.length;
  return preset.lines.filter((line) => parseRelationDefinitions([...userLines, line]).errors.length > userErrorCount + parseRelationDefinitions([line]).errors.length);
}

/**
 * Includes a preset in, or removes it from, the included preset ids.
 *
 * @param presetIds - The ids of the included presets.
 * @param presetId - The preset's id.
 * @param isIncluded - Whether the preset is to be included.
 * @returns The new ids.
 */
export function togglePreset(presetIds: readonly string[], presetId: string, isIncluded: boolean): string[] {
  const otherIds = presetIds.filter((id) => id !== presetId);
  return isIncluded ? [...otherIds, presetId] : otherIds;
}

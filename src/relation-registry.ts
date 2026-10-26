import {
  getMandatoryNamedGroup,
  getOptionalNamedGroup
} from '@mnaoumov/typescript-lib/reg-exp';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';

/**
 * A composition rule: a derived label defined as one or more chains of labels, `aunt = parent -> sibling`.
 *
 * Each step is a label as seen from the note the step starts at, so `parent` follows a written `parent` link
 * and an incoming `child` link alike when the registry pairs them. A step may name another rule, and may keep only
 * the notes whose properties pass its filters: `spouse = partnership[!divorceDate] -> partner`. An `except` list
 * leaves out the notes the start note already reaches by other labels: `stepParent = parent -> spouse except parent`.
 */
export interface CompositionRule {
  /**
   * The alternative chains, each a list of steps: `a = b -> c | d` has the steps `b` and `c`, then `d`.
   */
  readonly chains: readonly (readonly RuleStep[])[];

  /**
   * The labels whose notes the rule leaves out, as seen from the note it starts at: `except parent, child`.
   */
  readonly exclusions: readonly string[];

  /**
   * The derived label, as written in the rule.
   */
  readonly label: string;
}

/**
 * One choice of a {@link LabelVariants} line: `female -> mother`.
 */
export interface LabelVariant {
  /**
   * The label shown when the property holds {@link LabelVariant.value}.
   */
  readonly label: string;

  /**
   * The property value that picks this variant, compared ignoring case.
   */
  readonly value: string;
}

/**
 * A `label @ property: value -> variant, ...` line of the registry: `parent @ gender: female -> mother, male ->
 * father` shows a `parent` relation as `mother` or `father`, by the `gender` property of the note the label
 * describes.
 */
export interface LabelVariants {
  /**
   * The label the variants replace.
   */
  readonly label: string;

  /**
   * The property of the described note that picks the variant.
   */
  readonly propertyName: string;

  /**
   * The variants, in the order the line writes them.
   */
  readonly variants: readonly LabelVariant[];
}

/**
 * The result of {@link parseRelationDefinitions}.
 */
export interface ParseRelationDefinitionsResult {
  /**
   * The definitions parsed from the valid lines, blank lines skipped.
   */
  readonly definitions: RelationDefinition[];

  /**
   * One message per line that could not be used, empty when every line is valid.
   */
  readonly errors: string[];

  /**
   * The label variants parsed from the valid `label @ property: value -> variant` lines.
   */
  readonly labelVariants: LabelVariants[];

  /**
   * The composition rules parsed from the valid rule lines.
   */
  readonly rules: CompositionRule[];

  /**
   * The sub-labels parsed from the valid `sub < super` lines.
   */
  readonly subLabels: SubLabelDefinition[];
}

/**
 * A condition a rule step puts on the notes it reaches, by one of their properties: `[deathDate]` keeps the notes
 * where it is set, `[!deathDate]` the notes where it is not, and `[status: retired]` the notes where it holds the
 * value.
 */
export interface PropertyFilter {
  /**
   * Whether the condition is negated, `[!deathDate]`.
   */
  readonly isNegated: boolean;

  /**
   * The property, compared ignoring case.
   */
  readonly propertyName: string;

  /**
   * The value the property has to hold, compared ignoring case, or `null` when any value counts.
   */
  readonly value: null | string;
}

/**
 * One line of the registry: a pair (`employee <-> employer`), a symmetric label (`spouse <-> spouse`) or a
 * label with no inverse (`mentions`).
 */
export interface RelationDefinition {
  /**
   * The label the same relation carries when it is seen from the other end, or `null` when it has none.
   */
  readonly inverseLabel: null | string;

  /**
   * The label as it is written in the notes.
   */
  readonly label: string;
}

/**
 * One step of a composition rule's chain: a label, and the filters the notes it reaches have to pass.
 */
export interface RuleStep {
  /**
   * The filters, all of which a reached note has to pass.
   */
  readonly filters: readonly PropertyFilter[];

  /**
   * The step's label, as seen from the note the step starts at.
   */
  readonly label: string;
}

/**
 * A `sub < super` line of the registry: `birthMother < mother` makes every `birthMother` link a kind of `mother`
 * link, which a query includes when it asks for the wide meaning of `mother`.
 */
export interface SubLabelDefinition {
  /**
   * The narrower label.
   */
  readonly label: string;

  /**
   * The wider label it is a kind of.
   */
  readonly superLabel: string;
}

/**
 * The most links a rule may chain once the rules it names are expanded, which bounds every walk over the notes.
 */
export const MAX_RULE_LENGTH = 8;

const PAIR_SEPARATOR = '<->';

const PAIR_REG_EXP = /^(?<label>.+?)\s*<->\s*(?<inverseLabel>.+)$/u;

const RULE_SEPARATOR = '=';

const RULE_REG_EXP = /^(?<label>[^=]+?)\s*=\s*(?<chains>[^=]+)$/u;

const SUB_LABEL_SEPARATOR = '<';

const SUB_LABEL_REG_EXP = /^(?<label>[^<]+?)\s*<\s*(?<superLabel>[^<]+)$/u;

const CHAIN_SEPARATOR = '|';

const STEP_SEPARATOR = '->';

const STEP_REG_EXP = /^(?<label>[^[\]]+?)\s*(?<filters>(?:\[[^[\]]*\]\s*)*)$/u;

const FILTER_REG_EXP = /\[(?<filter>[^[\]]*)\]/gu;

const FILTER_CONTENT_REG_EXP = /^(?<negation>!?)\s*(?<propertyName>[^:!]+?)\s*(?::\s*(?<value>.+?))?$/u;

const EXCLUSION_REG_EXP = /\s+except(?:\s+|$)/u;

const EXCLUSION_SEPARATOR = ',';

const VARIANTS_SEPARATOR = '@';

const VARIANTS_REG_EXP = /^(?<label>[^@]+?)\s*@\s*(?<propertyName>[^:@]+?)\s*:\s*(?<variants>[^@]+)$/u;

const VARIANT_SEPARATOR = ',';

const VARIANT_REG_EXP = /^(?<value>.+?)\s*->\s*(?<label>.+)$/u;

/**
 * The relation registry: which label is the inverse of which, which labels are derived by composition rules,
 * which labels are kinds of other labels, and which labels are shown as variants by a property. Lookups ignore
 * case, the way Obsidian treats property names.
 */
export class RelationRegistry {
  /**
   * Whether the registry holds any label variants.
   *
   * @returns Whether it does.
   */
  public get hasLabelVariants(): boolean {
    return this.labelVariants.size > 0;
  }

  /**
   * Whether the registry holds any composition rule.
   *
   * @returns Whether it does.
   */
  public get hasRules(): boolean {
    return this.rules.size > 0;
  }

  private readonly inverseLabels = new Map<string, null | string>();
  private readonly labelVariants = new Map<string, LabelVariants>();
  private readonly rules = new Map<string, CompositionRule>();
  private readonly superLabels = new Map<string, string[]>();

  /**
   * Creates a registry from parsed definitions. A pair registers both directions, so `employee <-> employer`
   * also answers `employer`.
   *
   * A sub-label with no pair of its own takes the inverse of its nearest superset that has one, and when both
   * have pairs the inverse sub-label is implied: `birthMother < mother` with `birthMother <-> birthChild` and
   * `mother <-> child` also makes `birthChild` a kind of `child`.
   *
   * @param definitions - The definitions, as {@link parseRelationDefinitions} returns them.
   * @param rules - The composition rules, as {@link parseRelationDefinitions} returns them.
   * @param subLabels - The sub-labels, as {@link parseRelationDefinitions} returns them.
   * @param labelVariants - The label variants, as {@link parseRelationDefinitions} returns them.
   */
  public constructor(
    definitions: readonly RelationDefinition[],
    rules: readonly CompositionRule[] = [],
    subLabels: readonly SubLabelDefinition[] = [],
    labelVariants: readonly LabelVariants[] = []
  ) {
    for (const variants of labelVariants) {
      this.labelVariants.set(normalizeLabel(variants.label), variants);
    }

    for (const definition of definitions) {
      this.register(definition.label, definition.inverseLabel);
      if (definition.inverseLabel !== null) {
        this.register(definition.inverseLabel, definition.label);
      }
    }

    for (const rule of rules) {
      this.rules.set(normalizeLabel(rule.label), rule);
    }

    for (const subLabel of subLabels) {
      this.addSuperLabel(subLabel.label, subLabel.superLabel);
    }

    for (const subLabel of subLabels) {
      const inverseLabel = this.getInverseLabel(subLabel.label);
      const inverseSuperLabel = this.getInverseLabel(subLabel.superLabel);
      if (inverseLabel !== null && inverseSuperLabel !== null && !this.isLabelOrSubLabel(inverseSuperLabel, inverseLabel)) {
        this.addSuperLabel(inverseLabel, inverseSuperLabel);
      }
    }

    for (const subLabel of subLabels) {
      const key = normalizeLabel(subLabel.label);
      if (!this.inverseLabels.has(key)) {
        this.inverseLabels.set(key, this.findInheritedInverseLabel(ensureNonNullable(this.superLabels.get(key))));
      }
    }
  }

  /**
   * Gets the label a relation carries when it is seen from its target.
   *
   * @param label - The label written in the source note.
   * @returns The inverse label, or `null` when the label is not registered or is registered with no inverse.
   */
  public getInverseLabel(label: string): null | string {
    return this.inverseLabels.get(normalizeLabel(label)) ?? null;
  }

  /**
   * Gets the variants a label is shown as.
   *
   * @param label - The label.
   * @returns The variants, or `null` when the label has none.
   */
  public getLabelVariants(label: string): LabelVariants | null {
    return this.labelVariants.get(normalizeLabel(label)) ?? null;
  }

  /**
   * Gets the widest labels a label is a kind of, following its superset labels up to the labels that have none.
   *
   * @param label - The label.
   * @returns The top superset labels, as their lines write them, or the label itself when it has no superset.
   */
  public getRootLabels(label: string): string[] {
    const roots = new Map<string, string>();
    const visited = new Set<string>();
    const pending = [label];
    for (let current = pending.shift(); current !== undefined; current = pending.shift()) {
      const key = normalizeLabel(current);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const superLabels = this.superLabels.get(key);
      if (superLabels) {
        pending.push(...superLabels);
      } else {
        roots.set(key, current);
      }
    }
    return [...roots.values()];
  }

  /**
   * Gets the composition rule that derives a label.
   *
   * @param label - The label.
   * @returns The rule, or `null` when no rule derives the label.
   */
  public getRule(label: string): CompositionRule | null {
    return this.rules.get(normalizeLabel(label)) ?? null;
  }

  /**
   * Gets every composition rule, in the order they were defined.
   *
   * @returns The rules.
   */
  public getRules(): CompositionRule[] {
    return [...this.rules.values()];
  }

  /**
   * Gets the label to show for a relation: the variant the described note's property picks, or the label itself.
   *
   * @param label - The label.
   * @param frontmatter - The frontmatter of the note the label describes, `Bob` in `Bob is Alice's parent`.
   * @returns The variant, or the label when it has no variants or none matches the property.
   */
  public getShownLabel(label: string, frontmatter: null | Readonly<Record<string, unknown>> | undefined): string {
    const labelVariants = this.getLabelVariants(label);
    if (!labelVariants || !frontmatter) {
      return label;
    }

    const values = new Set(getPropertyItems(frontmatter, labelVariants.propertyName).filter((item) => typeof item === 'string').map((item) => normalizeLabel(item)));
    return labelVariants.variants.find((variant) => values.has(normalizeLabel(variant.value)))?.label ?? label;
  }

  /**
   * Checks whether a label is another label, ignoring case, or a kind of it through one or more `sub < super`
   * lines.
   *
   * @param label - The label to check.
   * @param superLabel - The wider label.
   * @returns Whether it is.
   */
  public isLabelOrSubLabel(label: string, superLabel: string): boolean {
    const superKey = normalizeLabel(superLabel);
    const visited = new Set<string>();
    const pending = [normalizeLabel(label)];
    for (let key = pending.shift(); key !== undefined; key = pending.shift()) {
      if (key === superKey) {
        return true;
      }
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      pending.push(...(this.superLabels.get(key) ?? []).map((nextSuperLabel) => normalizeLabel(nextSuperLabel)));
    }
    return false;
  }

  private addSuperLabel(label: string, superLabel: string): void {
    const key = normalizeLabel(label);
    let superLabels = this.superLabels.get(key);
    if (!superLabels) {
      superLabels = [];
      this.superLabels.set(key, superLabels);
    }
    if (superLabels.every((existing) => normalizeLabel(existing) !== normalizeLabel(superLabel))) {
      superLabels.push(superLabel);
    }
  }

  private findInheritedInverseLabel(superLabels: readonly string[]): null | string {
    const visited = new Set<string>();
    const pending = [...superLabels];
    for (let current = pending.shift(); current !== undefined; current = pending.shift()) {
      const currentKey = normalizeLabel(current);
      if (visited.has(currentKey)) {
        continue;
      }
      visited.add(currentKey);
      const inverseLabel = this.inverseLabels.get(currentKey);
      if (inverseLabel !== undefined && inverseLabel !== null) {
        return inverseLabel;
      }
      pending.push(...this.superLabels.get(currentKey) ?? []);
    }
    return null;
  }

  private register(label: string, inverseLabel: null | string): void {
    const key = normalizeLabel(label);
    if (!this.inverseLabels.has(key)) {
      this.inverseLabels.set(key, inverseLabel);
    }
  }
}

/**
 * Checks whether a note passes the filters of a rule step.
 *
 * A property is set when it holds a value other than an empty string or an empty list. A value filter matches a
 * string, number or boolean ignoring case, and any item of a list.
 *
 * @param filters - The filters.
 * @param frontmatter - The frontmatter of the note, or `null` when it has none or does not exist.
 * @returns Whether the note passes every filter.
 */
export function doesPassPropertyFilters(filters: readonly PropertyFilter[], frontmatter: null | Readonly<Record<string, unknown>> | undefined): boolean {
  return filters.every((filter) => {
    const items = getPropertyItems(frontmatter, filter.propertyName).filter((item) => item !== null && item !== '');
    const filterValue = filter.value;
    const isMatch = filterValue === null
      ? items.length > 0
      : items.some((item) => (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') && normalizeLabel(String(item)) === normalizeLabel(filterValue));
    return isMatch !== filter.isNegated;
  });
}

/**
 * Normalizes a label for comparison: trimmed and lowercased.
 *
 * @param label - The label.
 * @returns The normalized label.
 */
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Parses the registry lines stored in the settings.
 *
 * @param lines - One definition per line: `label <-> inverse`, `label <-> label` for a symmetric label, a
 * lone `label` for a label with no inverse, `label = step -> step[!property] | step except label` for a
 * composition rule with its step filters and exclusions, or
 * `label < superLabel` for a label that is a kind of another, or `label @ property: value -> variant, ...` for
 * the variants a label is shown as.
 * @returns The definitions, rules, sub-labels and label variants, and a message for each line that is malformed,
 * redefines a label, is a rule that reaches itself or chains too many links, or makes a label a kind of itself.
 * A line that redefines a label loses to the earlier line, so lines put after the user's own can never override
 * them.
 */
export function parseRelationDefinitions(lines: readonly string[]): ParseRelationDefinitionsResult {
  const definitions: RelationDefinition[] = [];
  const errors: string[] = [];
  const definedLabels = new Set<string>();
  const labelVariants = new Map<string, LabelVariants>();
  const ruleLines = new Map<string, string>();
  const rules = new Map<string, CompositionRule>();
  const subLabels: SubLabelDefinition[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      continue;
    }

    if (line.includes(VARIANTS_SEPARATOR)) {
      const variants = parseVariantsLine(line);
      if (variants === null) {
        errors.push(`"${line}" is not a label variant line. Write "label @ property: value -> variant, value -> variant".`);
        continue;
      }

      const key = normalizeLabel(variants.label);
      if (labelVariants.has(key)) {
        errors.push(`"${line}" defines the variants of "${variants.label}" again. Each label's variants can be defined once.`);
        continue;
      }

      labelVariants.set(key, variants);
      continue;
    }

    if (line.includes(RULE_SEPARATOR)) {
      const rule = parseRuleLine(line);
      if (rule === null) {
        errors.push(
          `"${line}" is not a rule. Write "label = step -> step", with "|" between alternative chains, `
            + '"[property]" or "[!property]" after a step to filter the notes it reaches, and "except label, label" at the end.'
        );
        continue;
      }

      const key = normalizeLabel(rule.label);
      if (rules.has(key)) {
        errors.push(`"${line}" defines the rule "${rule.label}" again. Each rule can be defined once.`);
        continue;
      }

      rules.set(key, rule);
      ruleLines.set(key, line);
      continue;
    }

    if (!line.includes(PAIR_SEPARATOR) && line.includes(SUB_LABEL_SEPARATOR)) {
      const error = addSubLabel(line, subLabels);
      if (error !== null) {
        errors.push(error);
      }
      continue;
    }

    const definition = parseLine(line);
    if (definition === null) {
      errors.push(`"${line}" is not a definition. Write "label <-> inverse", "label <-> label" or a lone "label".`);
      continue;
    }

    const labels = [definition.label];
    if (definition.inverseLabel !== null && normalizeLabel(definition.inverseLabel) !== normalizeLabel(definition.label)) {
      labels.push(definition.inverseLabel);
    }

    const redefinedLabel = labels.find((label) => definedLabels.has(normalizeLabel(label)));
    if (redefinedLabel !== undefined) {
      errors.push(`"${line}" defines "${redefinedLabel}" again. Each label can be defined once.`);
      continue;
    }

    for (const label of labels) {
      definedLabels.add(normalizeLabel(label));
    }
    definitions.push(definition);
  }

  return {
    definitions,
    errors: [...errors, ...validateRules(rules, ruleLines)],
    labelVariants: [...labelVariants.values()],
    rules: [...rules.values()],
    subLabels
  };
}

/**
 * Parses a `sub < super` line and adds it to the sub-labels parsed so far, unless it repeats one or makes a label
 * a kind of itself.
 *
 * @param line - The trimmed line.
 * @param subLabels - The sub-labels parsed so far. The new one is pushed to it.
 * @returns A message when the line cannot be used, or `null` when it was added.
 */
function addSubLabel(line: string, subLabels: SubLabelDefinition[]): null | string {
  const match = SUB_LABEL_REG_EXP.exec(line);
  const label = match ? getMandatoryNamedGroup(match, 'label') : '';
  const superLabel = match ? getMandatoryNamedGroup(match, 'superLabel') : '';
  if (!isValidRuleLabel(label) || !isValidRuleLabel(superLabel)) {
    return `"${line}" is not a sub-label. Write "label < superLabel".`;
  }

  if (subLabels.some((subLabel) => normalizeLabel(subLabel.label) === normalizeLabel(label) && normalizeLabel(subLabel.superLabel) === normalizeLabel(superLabel))) {
    return `"${line}" makes "${label}" a kind of "${superLabel}" again.`;
  }

  const registry = new RelationRegistry([], [], subLabels);
  if (registry.isLabelOrSubLabel(superLabel, label)) {
    return `"${line}" makes "${label}" a kind of itself. A label cannot be its own superset, directly or through other labels.`;
  }

  subLabels.push({ label, superLabel });
  return null;
}

/**
 * Gets the items of a property, finding its key ignoring case.
 *
 * @param frontmatter - The frontmatter, or `null` when there is none.
 * @param propertyName - The property.
 * @returns The list's items, the lone value as one item, or nothing when the property is missing or `null`.
 */
function getPropertyItems(frontmatter: null | Readonly<Record<string, unknown>> | undefined, propertyName: string): unknown[] {
  if (!frontmatter) {
    return [];
  }

  const propertyKey = normalizeLabel(propertyName);
  const key = Object.keys(frontmatter).find((candidate) => normalizeLabel(candidate) === propertyKey);
  const value: unknown = key === undefined ? undefined : frontmatter[key];
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value as unknown[] : [value];
}

/**
 * Gets how many links a rule chains once the rules it names are expanded: its longest chain, where a step that
 * names a rule counts as that rule's length.
 *
 * @param key - The normalized label of the rule.
 * @param rules - Every rule, by normalized label.
 * @param path - The normalized labels of the rules being expanded, outermost first.
 * @returns The length, or the path closed into a cycle when the rule reaches itself.
 */
function getRuleLength(key: string, rules: ReadonlyMap<string, CompositionRule>, path: readonly string[]): number | string[] {
  if (path.includes(key)) {
    return [...path.slice(path.indexOf(key)), key];
  }

  const rule = rules.get(key);
  if (!rule) {
    return 1;
  }

  let maxLength = 0;
  for (const chain of rule.chains) {
    let length = 0;
    for (const step of chain) {
      const stepLength = getRuleLength(normalizeLabel(step.label), rules, [...path, key]);
      if (typeof stepLength !== 'number') {
        return stepLength;
      }
      length += stepLength;
    }
    maxLength = Math.max(maxLength, length);
  }

  // An exclusion is walked from the rule's start too, so it bounds the walk and can close a cycle like a chain.
  for (const exclusion of rule.exclusions) {
    const exclusionLength = getRuleLength(normalizeLabel(exclusion), rules, [...path, key]);
    if (typeof exclusionLength !== 'number') {
      return exclusionLength;
    }
    maxLength = Math.max(maxLength, exclusionLength);
  }
  return maxLength;
}

function isValidLabel(label: string): boolean {
  return !/[<>:]/u.test(label);
}

function isValidRuleLabel(label: string): boolean {
  return label !== '' && isValidLabel(label) && !/[|[\]]/u.test(label);
}

function parseLine(line: string): null | RelationDefinition {
  if (!line.includes(PAIR_SEPARATOR)) {
    return isValidLabel(line) ? { inverseLabel: null, label: line } : null;
  }

  const match = PAIR_REG_EXP.exec(line);
  if (!match) {
    return null;
  }

  const label = getMandatoryNamedGroup(match, 'label');
  const inverseLabel = getMandatoryNamedGroup(match, 'inverseLabel');
  return !isValidLabel(label) || !isValidLabel(inverseLabel) ? null : { inverseLabel, label };
}

function parseRuleLine(line: string): CompositionRule | null {
  const match = RULE_REG_EXP.exec(line);
  if (!match) {
    return null;
  }

  const label = getMandatoryNamedGroup(match, 'label');
  const [chainsText = '', exclusionsText, ...rest] = getMandatoryNamedGroup(match, 'chains').split(EXCLUSION_REG_EXP);
  if (rest.length > 0) {
    return null;
  }

  const chains: RuleStep[][] = [];
  for (const chainText of chainsText.split(CHAIN_SEPARATOR)) {
    const chain: RuleStep[] = [];
    for (const stepText of chainText.split(STEP_SEPARATOR)) {
      const step = parseRuleStep(stepText.trim());
      if (step === null) {
        return null;
      }
      chain.push(step);
    }
    chains.push(chain);
  }

  const exclusions = exclusionsText === undefined ? [] : exclusionsText.split(EXCLUSION_SEPARATOR).map((exclusion) => exclusion.trim());
  return isValidRuleLabel(label) && exclusions.every((exclusion) => isValidRuleLabel(exclusion)) ? { chains, exclusions, label } : null;
}

function parseRuleStep(stepText: string): null | RuleStep {
  const match = STEP_REG_EXP.exec(stepText);
  if (!match) {
    return null;
  }

  const label = getMandatoryNamedGroup(match, 'label');
  const filters: PropertyFilter[] = [];
  for (const filterMatch of getMandatoryNamedGroup(match, 'filters').matchAll(FILTER_REG_EXP)) {
    const contentMatch = FILTER_CONTENT_REG_EXP.exec(getMandatoryNamedGroup(filterMatch, 'filter').trim());
    if (!contentMatch) {
      return null;
    }
    filters.push({
      isNegated: getOptionalNamedGroup(contentMatch, 'negation') === '!',
      propertyName: getMandatoryNamedGroup(contentMatch, 'propertyName'),
      value: getOptionalNamedGroup(contentMatch, 'value')
    });
  }

  return isValidRuleLabel(label) ? { filters, label } : null;
}

function parseVariantsLine(line: string): LabelVariants | null {
  const match = VARIANTS_REG_EXP.exec(line);
  if (!match) {
    return null;
  }

  const label = getMandatoryNamedGroup(match, 'label');
  const propertyName = getMandatoryNamedGroup(match, 'propertyName').trim();
  const variants: LabelVariant[] = [];
  for (const part of getMandatoryNamedGroup(match, 'variants').split(VARIANT_SEPARATOR)) {
    const variantMatch = VARIANT_REG_EXP.exec(part.trim());
    const value = variantMatch ? getMandatoryNamedGroup(variantMatch, 'value') : '';
    const variantLabel = variantMatch ? getMandatoryNamedGroup(variantMatch, 'label') : '';
    if (!isValidRuleLabel(value) || !isValidRuleLabel(variantLabel) || variants.some((variant) => normalizeLabel(variant.value) === normalizeLabel(value))) {
      return null;
    }
    variants.push({ label: variantLabel, value });
  }

  return isValidRuleLabel(label) && propertyName !== '' ? { label, propertyName, variants } : null;
}

/**
 * Rejects the rules that reach their own label, directly or through other rules, and the rules longer than
 * {@link MAX_RULE_LENGTH} once expanded. A rejected rule is removed, so the rules naming it fail in turn.
 *
 * @param rules - Every parsed rule, by normalized label. Rejected rules are deleted from it.
 * @param ruleLines - The line each rule was parsed from, by normalized label.
 * @returns A message per rejected rule.
 */
function validateRules(rules: Map<string, CompositionRule>, ruleLines: ReadonlyMap<string, string>): string[] {
  const errors: string[] = [];
  const lengths = new Map<string, number | string[]>();
  const labels = new Map<string, string>();
  for (const [key, rule] of rules) {
    lengths.set(key, getRuleLength(key, rules, []));
    labels.set(key, rule.label);
  }

  for (const [key, length] of lengths) {
    const line = ruleLines.get(key);
    if (typeof length !== 'number') {
      const cycle = length.map((cycleKey) => ensureNonNullable(labels.get(cycleKey))).join(' -> ');
      errors.push(
        length.includes(key)
          ? `"${String(line)}" reaches its own label: ${cycle}. A rule cannot name itself, directly or through another rule.`
          : `"${String(line)}" names a rule that reaches its own label: ${cycle}.`
      );
    } else if (length > MAX_RULE_LENGTH) {
      errors.push(`"${String(line)}" chains ${String(length)} links once its rules are expanded. A rule can chain at most ${String(MAX_RULE_LENGTH)}.`);
    } else {
      continue;
    }
    rules.delete(key);
  }

  return errors;
}

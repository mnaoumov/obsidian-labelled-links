import { getMandatoryNamedGroup } from '@mnaoumov/typescript-lib/reg-exp';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';

/**
 * A composition rule: a derived label defined as one or more chains of labels, `aunt = parent -> sibling`.
 *
 * Each step is a label as seen from the note the step starts at, so `parent` follows a written `parent` link
 * and an incoming `child` link alike when the registry pairs them. A step may name another rule.
 */
export interface CompositionRule {
  /**
   * The alternative chains, each a list of step labels: `a = b -> c | d` has `[['b', 'c'], ['d']]`.
   */
  readonly chains: readonly (readonly string[])[];

  /**
   * The derived label, as written in the rule.
   */
  readonly label: string;
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
   * The composition rules parsed from the valid rule lines.
   */
  readonly rules: CompositionRule[];
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
 * The most links a rule may chain once the rules it names are expanded, which bounds every walk over the notes.
 */
export const MAX_RULE_LENGTH = 8;

const PAIR_SEPARATOR = '<->';

const PAIR_REG_EXP = /^(?<label>.+?)\s*<->\s*(?<inverseLabel>.+)$/u;

const RULE_SEPARATOR = '=';

const RULE_REG_EXP = /^(?<label>[^=]+?)\s*=\s*(?<chains>[^=]+)$/u;

const CHAIN_SEPARATOR = '|';

const STEP_SEPARATOR = '->';

/**
 * The relation registry: which label is the inverse of which, and which labels are derived by composition rules.
 * Lookups ignore case, the way Obsidian treats property names.
 */
export class RelationRegistry {
  /**
   * Whether the registry holds any composition rule.
   *
   * @returns Whether it does.
   */
  public get hasRules(): boolean {
    return this.rules.size > 0;
  }

  private readonly inverseLabels = new Map<string, null | string>();
  private readonly rules = new Map<string, CompositionRule>();

  /**
   * Creates a registry from parsed definitions. A pair registers both directions, so `employee <-> employer`
   * also answers `employer`.
   *
   * @param definitions - The definitions, as {@link parseRelationDefinitions} returns them.
   * @param rules - The composition rules, as {@link parseRelationDefinitions} returns them.
   */
  public constructor(definitions: readonly RelationDefinition[], rules: readonly CompositionRule[] = []) {
    for (const definition of definitions) {
      this.register(definition.label, definition.inverseLabel);
      if (definition.inverseLabel !== null) {
        this.register(definition.inverseLabel, definition.label);
      }
    }

    for (const rule of rules) {
      this.rules.set(normalizeLabel(rule.label), rule);
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

  private register(label: string, inverseLabel: null | string): void {
    const key = normalizeLabel(label);
    if (!this.inverseLabels.has(key)) {
      this.inverseLabels.set(key, inverseLabel);
    }
  }
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
 * lone `label` for a label with no inverse, or `label = step -> step | step` for a composition rule.
 * @returns The definitions and rules, and a message for each line that is malformed, redefines a label, or is
 * a rule that reaches itself or chains too many links.
 */
export function parseRelationDefinitions(lines: readonly string[]): ParseRelationDefinitionsResult {
  const definitions: RelationDefinition[] = [];
  const errors: string[] = [];
  const definedLabels = new Set<string>();
  const ruleLines = new Map<string, string>();
  const rules = new Map<string, CompositionRule>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      continue;
    }

    if (line.includes(RULE_SEPARATOR)) {
      const rule = parseRuleLine(line);
      if (rule === null) {
        errors.push(`"${line}" is not a rule. Write "label = step -> step", with "|" between alternative chains.`);
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

  return { definitions, errors: [...errors, ...validateRules(rules, ruleLines)], rules: [...rules.values()] };
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
      const stepLength = getRuleLength(normalizeLabel(step), rules, [...path, key]);
      if (typeof stepLength !== 'number') {
        return stepLength;
      }
      length += stepLength;
    }
    maxLength = Math.max(maxLength, length);
  }
  return maxLength;
}

function isValidLabel(label: string): boolean {
  return !/[<>:]/u.test(label);
}

function isValidRuleLabel(label: string): boolean {
  return label !== '' && isValidLabel(label) && !label.includes(CHAIN_SEPARATOR);
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
  const chains = getMandatoryNamedGroup(match, 'chains')
    .split(CHAIN_SEPARATOR)
    .map((chain) => chain.split(STEP_SEPARATOR).map((step) => step.trim()));
  const isValid = isValidRuleLabel(label) && chains.every((chain) => chain.every((step) => isValidRuleLabel(step)));
  return isValid ? { chains, label } : null;
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

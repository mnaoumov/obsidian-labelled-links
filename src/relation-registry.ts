import { getMandatoryNamedGroup } from '@mnaoumov/typescript-lib/reg-exp';

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

const PAIR_SEPARATOR = '<->';

const PAIR_REG_EXP = /^(?<label>.+?)\s*<->\s*(?<inverseLabel>.+)$/u;

/**
 * The relation registry: which label is the inverse of which. Lookups ignore case, the way Obsidian treats
 * property names.
 */
export class RelationRegistry {
  private readonly inverseLabels = new Map<string, null | string>();

  /**
   * Creates a registry from parsed definitions. A pair registers both directions, so `employee <-> employer`
   * also answers `employer`.
   *
   * @param definitions - The definitions, as {@link parseRelationDefinitions} returns them.
   */
  public constructor(definitions: readonly RelationDefinition[]) {
    for (const definition of definitions) {
      this.register(definition.label, definition.inverseLabel);
      if (definition.inverseLabel !== null) {
        this.register(definition.inverseLabel, definition.label);
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
 * @param lines - One definition per line: `label <-> inverse`, `label <-> label` for a symmetric label, or a
 * lone `label` for a label with no inverse.
 * @returns The definitions, and a message for each line that is malformed or redefines a label.
 */
export function parseRelationDefinitions(lines: readonly string[]): ParseRelationDefinitionsResult {
  const definitions: RelationDefinition[] = [];
  const errors: string[] = [];
  const definedLabels = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
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

  return { definitions, errors };
}

function isValidLabel(label: string): boolean {
  return !/[<>:]/u.test(label);
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

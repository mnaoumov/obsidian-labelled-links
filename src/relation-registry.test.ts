import {
  describe,
  expect,
  it
} from 'vitest';

import {
  normalizeLabel,
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

describe('parseRelationDefinitions', () => {
  it('parses a pair, a symmetric label and a label with no inverse, skipping blank lines', () => {
    expect(parseRelationDefinitions(['employee <-> employer', '', '  spouse<->spouse  ', 'mentions'])).toStrictEqual({
      definitions: [
        { inverseLabel: 'employer', label: 'employee' },
        { inverseLabel: 'spouse', label: 'spouse' },
        { inverseLabel: null, label: 'mentions' }
      ],
      errors: []
    });
  });

  it.each([
    ['employee <->'],
    ['<-> employer'],
    ['a <-> b <-> c'],
    ['employee: <-> employer'],
    ['employee <-> employer:'],
    ['employee:']
  ])('rejects the malformed line %j', (line) => {
    const result = parseRelationDefinitions([line]);
    expect(result.definitions).toStrictEqual([]);
    expect(result.errors).toStrictEqual([
      `"${line}" is not a definition. Write "label <-> inverse", "label <-> label" or a lone "label".`
    ]);
  });

  it('rejects a line that defines a label a previous line already defined, ignoring case', () => {
    const result = parseRelationDefinitions(['employee <-> employer', 'Employer <-> staff', 'boss <-> EMPLOYEE', 'spouse <-> spouse', 'spouse']);
    expect(result.definitions).toStrictEqual([
      { inverseLabel: 'employer', label: 'employee' },
      { inverseLabel: 'spouse', label: 'spouse' }
    ]);
    expect(result.errors).toStrictEqual([
      '"Employer <-> staff" defines "Employer" again. Each label can be defined once.',
      '"boss <-> EMPLOYEE" defines "EMPLOYEE" again. Each label can be defined once.',
      '"spouse" defines "spouse" again. Each label can be defined once.'
    ]);
  });
});

describe('RelationRegistry', () => {
  const registry = new RelationRegistry(parseRelationDefinitions(['employee <-> employer', 'spouse <-> spouse', 'mentions']).definitions);

  it('answers both directions of a pair, ignoring case', () => {
    expect(registry.getInverseLabel('employee')).toBe('employer');
    expect(registry.getInverseLabel(' Employer ')).toBe('employee');
  });

  it('answers a symmetric label with itself', () => {
    expect(registry.getInverseLabel('spouse')).toBe('spouse');
  });

  it('answers null for a label with no inverse and for an unknown label', () => {
    expect(registry.getInverseLabel('mentions')).toBeNull();
    expect(registry.getInverseLabel('unknown')).toBeNull();
  });

  it('keeps the first definition when hand-built definitions repeat a label', () => {
    const repeated = new RelationRegistry([
      { inverseLabel: 'employer', label: 'employee' },
      { inverseLabel: 'staff', label: 'employer' }
    ]);
    expect(repeated.getInverseLabel('employer')).toBe('employee');
  });
});

describe('normalizeLabel', () => {
  it('trims and lowercases', () => {
    expect(normalizeLabel('  Employee ')).toBe('employee');
  });
});

import {
  describe,
  expect,
  it
} from 'vitest';

import {
  MAX_RULE_LENGTH,
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
      errors: [],
      rules: []
    });
  });

  it('parses a composition rule with alternative chains, beside a pair defining the same label', () => {
    expect(parseRelationDefinitions(['sibling <-> sibling', 'sibling = parent -> child', 'in-law = spouse -> sibling | sibling->spouse'])).toStrictEqual({
      definitions: [{ inverseLabel: 'sibling', label: 'sibling' }],
      errors: [],
      rules: [
        { chains: [['parent', 'child']], label: 'sibling' },
        { chains: [['spouse', 'sibling'], ['sibling', 'spouse']], label: 'in-law' }
      ]
    });
  });

  it.each([
    ['aunt ='],
    ['= parent'],
    ['aunt = parent ->'],
    ['aunt = parent |'],
    ['aunt = = parent'],
    ['aunt: = parent'],
    ['aunt = parent <- sibling'],
    ['aunt|uncle = parent -> sibling']
  ])('rejects the malformed rule %j', (line) => {
    const result = parseRelationDefinitions([line]);
    expect(result.rules).toStrictEqual([]);
    expect(result.errors).toStrictEqual([`"${line}" is not a rule. Write "label = step -> step", with "|" between alternative chains.`]);
  });

  it('rejects a rule defined twice, ignoring case', () => {
    const result = parseRelationDefinitions(['aunt = parent -> sibling', 'Aunt = mother -> sister']);
    expect(result.rules).toStrictEqual([{ chains: [['parent', 'sibling']], label: 'aunt' }]);
    expect(result.errors).toStrictEqual(['"Aunt = mother -> sister" defines the rule "Aunt" again. Each rule can be defined once.']);
  });

  it('rejects a rule that reaches its own label, and a rule naming one', () => {
    const result = parseRelationDefinitions(['a = b -> c', 'b = A', 'd = x | b', 'e = e', 'f = c']);
    expect(result.rules).toStrictEqual([{ chains: [['c']], label: 'f' }]);
    expect(result.errors).toStrictEqual([
      '"a = b -> c" reaches its own label: a -> b -> a. A rule cannot name itself, directly or through another rule.',
      '"b = A" reaches its own label: b -> a -> b. A rule cannot name itself, directly or through another rule.',
      '"d = x | b" names a rule that reaches its own label: b -> a -> b.',
      '"e = e" reaches its own label: e -> e. A rule cannot name itself, directly or through another rule.'
    ]);
  });

  it(`rejects a rule longer than ${String(MAX_RULE_LENGTH)} links once the rules it names are expanded`, () => {
    const result = parseRelationDefinitions(['two = x -> x | x', 'eight = two -> two -> two -> two', 'nine = eight -> x']);
    expect(result.rules.map((rule) => rule.label)).toStrictEqual(['two', 'eight']);
    expect(result.errors).toStrictEqual(['"nine = eight -> x" chains 9 links once its rules are expanded. A rule can chain at most 8.']);
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

  it('answers the rule deriving a label, ignoring case, and lists every rule', () => {
    const { definitions, rules } = parseRelationDefinitions(['parent <-> child', 'aunt = parent -> sibling', 'cousin = aunt -> child']);
    const withRules = new RelationRegistry(definitions, rules);
    expect(withRules.hasRules).toBe(true);
    expect(withRules.getRule(' Aunt ')).toStrictEqual({ chains: [['parent', 'sibling']], label: 'aunt' });
    expect(withRules.getRule('parent')).toBeNull();
    expect(withRules.getRules().map((rule) => rule.label)).toStrictEqual(['aunt', 'cousin']);
    expect(registry.hasRules).toBe(false);
  });
});

describe('normalizeLabel', () => {
  it('trims and lowercases', () => {
    expect(normalizeLabel('  Employee ')).toBe('employee');
  });
});

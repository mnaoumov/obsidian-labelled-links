import {
  describe,
  expect,
  it
} from 'vitest';

import type { CompositionRule } from './relation-registry.ts';

import {
  doesPassPropertyFilters,
  MAX_RULE_LENGTH,
  normalizeLabel,
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

const RULE_ERROR_SUFFIX = 'is not a rule. Write "label = step -> step", with "|" between alternative chains, '
  + '"[property]" or "[!property]" after a step to filter the notes it reaches, and "except label, label" at the end.';

function createRule(label: string, chains: readonly (readonly string[])[], exclusions: readonly string[] = []): CompositionRule {
  return { chains: chains.map((chain) => chain.map((step) => ({ filters: [], label: step }))), exclusions, label };
}

describe('parseRelationDefinitions', () => {
  it('parses a pair, a symmetric label and a label with no inverse, skipping blank lines', () => {
    expect(parseRelationDefinitions(['employee <-> employer', '', '  spouse<->spouse  ', 'mentions'])).toStrictEqual({
      definitions: [
        { inverseLabel: 'employer', label: 'employee' },
        { inverseLabel: 'spouse', label: 'spouse' },
        { inverseLabel: null, label: 'mentions' }
      ],
      errors: [],
      labelVariants: [],
      rules: [],
      subLabels: []
    });
  });

  it('parses a composition rule with alternative chains, beside a pair defining the same label', () => {
    expect(parseRelationDefinitions(['sibling <-> sibling', 'sibling = parent -> child', 'in-law = spouse -> sibling | sibling->spouse'])).toStrictEqual({
      definitions: [{ inverseLabel: 'sibling', label: 'sibling' }],
      errors: [],
      labelVariants: [],
      rules: [
        createRule('sibling', [['parent', 'child']]),
        createRule('in-law', [['spouse', 'sibling'], ['sibling', 'spouse']])
      ],
      subLabels: []
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
    ['aunt|uncle = parent -> sibling'],
    ['aunt = parent[] -> sibling'],
    ['aunt = parent[!] -> sibling'],
    ['aunt = parent[x] y -> sibling'],
    ['aunt = parent[x -> sibling'],
    ['aunt = [x] -> sibling'],
    ['aunt[x] = parent'],
    ['aunt = parent except'],
    ['aunt = parent except a,'],
    ['aunt = parent except a except b'],
    ['aunt = parent except a[x]']
  ])('rejects the malformed rule %j', (line) => {
    const result = parseRelationDefinitions([line]);
    expect(result.rules).toStrictEqual([]);
    expect(result.errors).toStrictEqual([`"${line}" ${RULE_ERROR_SUFFIX}`]);
  });

  it('parses step filters and an except list', () => {
    const result = parseRelationDefinitions([
      'spouse = partnership[ !divorceDate ] -> partner[deathDate][Status :  retired ][!x:y]',
      'stepParent = parent -> spouse  except parent ,  guardian'
    ]);
    expect(result.errors).toStrictEqual([]);
    expect(result.rules).toStrictEqual([
      {
        chains: [[
          { filters: [{ isNegated: true, propertyName: 'divorceDate', value: null }], label: 'partnership' },
          {
            filters: [
              { isNegated: false, propertyName: 'deathDate', value: null },
              { isNegated: false, propertyName: 'Status', value: 'retired' },
              { isNegated: true, propertyName: 'x', value: 'y' }
            ],
            label: 'partner'
          }
        ]],
        exclusions: [],
        label: 'spouse'
      },
      createRule('stepParent', [['parent', 'spouse']], ['parent', 'guardian'])
    ]);
  });

  it('rejects a rule whose except list reaches its own label, and counts an except rule in its length', () => {
    const result = parseRelationDefinitions(['a = x except b', 'b = y except a', 'long = x except eight', 'eight = x -> x -> x -> x -> x -> x -> x -> x', 'nine = x except long -> x']);
    expect(result.rules.map((rule) => rule.label)).toStrictEqual(['long', 'eight']);
    expect(result.errors).toStrictEqual([
      `"nine = x except long -> x" ${RULE_ERROR_SUFFIX}`,
      '"a = x except b" reaches its own label: a -> b -> a. A rule cannot name itself, directly or through another rule.',
      '"b = y except a" reaches its own label: b -> a -> b. A rule cannot name itself, directly or through another rule.'
    ]);
    expect(parseRelationDefinitions(['nine = eight -> x', 'eight = x -> x -> x -> x -> x -> x -> x -> x', 'short = x except nine']).errors).toStrictEqual([
      '"nine = eight -> x" chains 9 links once its rules are expanded. A rule can chain at most 8.',
      '"short = x except nine" chains 9 links once its rules are expanded. A rule can chain at most 8.'
    ]);
  });

  it('rejects a rule defined twice, ignoring case', () => {
    const result = parseRelationDefinitions(['aunt = parent -> sibling', 'Aunt = mother -> sister']);
    expect(result.rules).toStrictEqual([createRule('aunt', [['parent', 'sibling']])]);
    expect(result.errors).toStrictEqual(['"Aunt = mother -> sister" defines the rule "Aunt" again. Each rule can be defined once.']);
  });

  it('rejects a rule that reaches its own label, and a rule naming one', () => {
    const result = parseRelationDefinitions(['a = b -> c', 'b = A', 'd = x | b', 'e = e', 'f = c']);
    expect(result.rules).toStrictEqual([createRule('f', [['c']])]);
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

describe('parseRelationDefinitions sub-labels', () => {
  it('parses sub-label lines beside pairs and rules', () => {
    expect(parseRelationDefinitions(['mother <-> child', ' birthMother<mother ', 'grandmother = parent -> mother', 'birthMother < parent'])).toStrictEqual({
      definitions: [{ inverseLabel: 'child', label: 'mother' }],
      errors: [],
      labelVariants: [],
      rules: [createRule('grandmother', [['parent', 'mother']])],
      subLabels: [
        { label: 'birthMother', superLabel: 'mother' },
        { label: 'birthMother', superLabel: 'parent' }
      ]
    });
  });

  it.each([
    ['< mother'],
    ['birthMother <'],
    ['a < b < c'],
    ['a | b < c']
  ])('rejects the malformed sub-label line %j', (line) => {
    const result = parseRelationDefinitions([line]);
    expect(result.subLabels).toStrictEqual([]);
    expect(result.errors).toStrictEqual([`"${line}" is not a sub-label. Write "label < superLabel".`]);
  });

  it('rejects a repeated sub-label line, ignoring case', () => {
    const result = parseRelationDefinitions(['birthMother < mother', 'BirthMother < Mother']);
    expect(result.subLabels).toStrictEqual([{ label: 'birthMother', superLabel: 'mother' }]);
    expect(result.errors).toStrictEqual(['"BirthMother < Mother" makes "BirthMother" a kind of "Mother" again.']);
  });

  it('rejects a line that makes a label a kind of itself, directly or through other labels', () => {
    const result = parseRelationDefinitions(['a < a', 'a < b', 'b < c', 'c < A']);
    expect(result.subLabels).toStrictEqual([{ label: 'a', superLabel: 'b' }, { label: 'b', superLabel: 'c' }]);
    expect(result.errors).toStrictEqual([
      '"a < a" makes "a" a kind of itself. A label cannot be its own superset, directly or through other labels.',
      '"c < A" makes "c" a kind of itself. A label cannot be its own superset, directly or through other labels.'
    ]);
  });
});

describe('RelationRegistry sub-labels', () => {
  function createRegistry(lines: readonly string[]): RelationRegistry {
    const { definitions, rules, subLabels } = parseRelationDefinitions(lines);
    return new RelationRegistry(definitions, rules, subLabels);
  }

  it('matches a label, ignoring case, and its sub-labels at every level, but not its superset labels', () => {
    const registry = createRegistry(['birthMother < mother', 'mother < parent', 'coAuthor < author']);
    expect(registry.isLabelOrSubLabel('Mother', ' mother ')).toBe(true);
    expect(registry.isLabelOrSubLabel('birthMother', 'mother')).toBe(true);
    expect(registry.isLabelOrSubLabel(' BirthMother ', 'parent')).toBe(true);
    expect(registry.isLabelOrSubLabel('parent', 'mother')).toBe(false);
    expect(registry.isLabelOrSubLabel('coAuthor', 'parent')).toBe(false);
  });

  it('answers the widest superset labels of a label, each once, or the label itself', () => {
    const registry = createRegistry(['birthMother < mother', 'birthMother < guardian', 'mother < parent', 'guardian < Parent', 'stepMother < mother']);
    expect(registry.getRootLabels('birthMother')).toStrictEqual(['parent']);
    expect(registry.getRootLabels('guardian')).toStrictEqual(['Parent']);
    expect(registry.getRootLabels('Spouse')).toStrictEqual(['Spouse']);
    expect(createRegistry(['coAuthor < author', 'coAuthor < contributor']).getRootLabels('coAuthor')).toStrictEqual(['author', 'contributor']);
  });

  it('gives a sub-label with no pair the inverse of its nearest superset that has one', () => {
    const registry = createRegistry(['parent <-> child', 'birthMother < mother', 'mother < parent', 'mentor', 'coMentor < mentor']);
    expect(registry.getInverseLabel('birthMother')).toBe('child');
    expect(registry.getInverseLabel('mother')).toBe('child');
    expect(registry.getInverseLabel('coMentor')).toBeNull();
  });

  it('keeps a sub-label\'s own pair, and implies the inverse sub-label when both have pairs', () => {
    const registry = createRegistry(['mother <-> child', 'birthMother <-> birthChild', 'birthMother < mother', 'spouse <-> spouse', 'wife <-> husband', 'wife < spouse']);
    expect(registry.getInverseLabel('birthMother')).toBe('birthChild');
    expect(registry.isLabelOrSubLabel('birthChild', 'child')).toBe(true);
    expect(registry.isLabelOrSubLabel('husband', 'spouse')).toBe(true);
    expect(registry.isLabelOrSubLabel('child', 'birthChild')).toBe(false);
  });

  it('walks a label reached by two paths once', () => {
    const registry = createRegistry(['a < b', 'a < c', 'b < d', 'c < d', 'd < e', 'e <-> f']);
    expect(registry.isLabelOrSubLabel('a', 'x')).toBe(false);
    expect(registry.getRootLabels('a')).toStrictEqual(['e']);
    expect(registry.getInverseLabel('a')).toBe('f');
    expect(createRegistry(['a < b', 'a < c', 'b < d', 'c < d']).getInverseLabel('a')).toBeNull();
  });

  it('keeps one copy of an implied inverse sub-label that is also written', () => {
    const registry = createRegistry(['mother <-> child', 'birthMother <-> birthChild', 'birthMother < mother', 'birthChild < child']);
    expect(registry.getRootLabels('birthChild')).toStrictEqual(['child']);
  });

  it('implies no inverse sub-label that would make a label a kind of itself', () => {
    const registry = createRegistry(['manager <-> report', 'manager < report']);
    expect(registry.isLabelOrSubLabel('manager', 'report')).toBe(true);
    expect(registry.isLabelOrSubLabel('report', 'manager')).toBe(false);
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
    expect(withRules.getRule(' Aunt ')).toStrictEqual(createRule('aunt', [['parent', 'sibling']]));
    expect(withRules.getRule('parent')).toBeNull();
    expect(withRules.getRules().map((rule) => rule.label)).toStrictEqual(['aunt', 'cousin']);
    expect(registry.hasRules).toBe(false);
  });
});

describe('parseRelationDefinitions label variants', () => {
  it('parses a variant line beside a pair defining the same label', () => {
    const result = parseRelationDefinitions(['parent <-> child', ' parent@ gender :female->mother,  male -> father ']);
    expect(result.errors).toStrictEqual([]);
    expect(result.labelVariants).toStrictEqual([
      { label: 'parent', propertyName: 'gender', variants: [{ label: 'mother', value: 'female' }, { label: 'father', value: 'male' }] }
    ]);
  });

  it.each([
    ['parent @ gender'],
    ['parent @ : female -> mother'],
    ['@ gender: female -> mother'],
    ['parent @ gender: female'],
    ['parent @ gender: female -> mother,'],
    ['parent @ gender: -> mother'],
    ['parent @ gender: female -> mother, female -> mum'],
    ['parent @ gender: female -> mother:x'],
    ['par<ent @ gender: female -> mother'],
    ['parent @ gen@der: female -> mother']
  ])('rejects the malformed variant line %j', (line) => {
    const result = parseRelationDefinitions([line]);
    expect(result.labelVariants).toStrictEqual([]);
    expect(result.errors).toStrictEqual([`"${line}" is not a label variant line. Write "label @ property: value -> variant, value -> variant".`]);
  });

  it('rejects the variants of a label defined twice, ignoring case, keeping the first line', () => {
    const result = parseRelationDefinitions(['parent @ gender: female -> mother', 'Parent @ sex: f -> mum']);
    expect(result.labelVariants.map((variants) => variants.propertyName)).toStrictEqual(['gender']);
    expect(result.errors).toStrictEqual(['"Parent @ sex: f -> mum" defines the variants of "Parent" again. Each label\'s variants can be defined once.']);
  });
});

describe('RelationRegistry label variants', () => {
  const { definitions, labelVariants } = parseRelationDefinitions(['parent <-> child', 'parent @ Gender: Female -> mother, male -> father']);
  const registry = new RelationRegistry(definitions, [], [], labelVariants);

  it('says whether it holds variants, and answers a label\'s variants ignoring case', () => {
    expect(registry.hasLabelVariants).toBe(true);
    expect(new RelationRegistry(definitions).hasLabelVariants).toBe(false);
    expect(registry.getLabelVariants(' PARENT ')?.propertyName).toBe('Gender');
    expect(registry.getLabelVariants('child')).toBeNull();
  });

  it.each([
    [{ gender: 'female' }, 'mother'],
    [{ GENDER: 'MALE' }, 'father'],
    [{ gender: ['other', 'male'] }, 'father'],
    [{ gender: 'other' }, 'parent'],
    [{ gender: 1 }, 'parent'],
    [{ sex: 'female' }, 'parent'],
    [null, 'parent'],
    [undefined, 'parent']
  ])('shows a parent described by %j as %j', (frontmatter, shownLabel) => {
    expect(registry.getShownLabel('Parent', frontmatter)).toBe(shownLabel === 'parent' ? 'Parent' : shownLabel);
  });

  it('shows a label with no variants as itself', () => {
    expect(registry.getShownLabel('child', { gender: 'female' })).toBe('child');
  });
});

describe('doesPassPropertyFilters', () => {
  const [rule] = parseRelationDefinitions(['r = a[deathDate] -> b[!deathDate] -> c[status: Retired] -> d[!status: retired]']).rules;
  const [isSet, isNotSet, hasValue, lacksValue] = (rule?.chains[0] ?? []).map((step) => step.filters);

  it.each([
    [{ deathDate: '2001-02-03' }, true],
    [{ DeathDate: 2001 }, true],
    [{ deathDate: ['2001'] }, true],
    [{ deathDate: '' }, false],
    [{ deathDate: null }, false],
    [{ deathDate: [] }, false],
    [{ deathDate: [null, ''] }, false],
    [{}, false],
    [null, false],
    [undefined, false]
  ])('says whether %j has the property set', (frontmatter, expected) => {
    expect(doesPassPropertyFilters(isSet ?? [], frontmatter)).toBe(expected);
    expect(doesPassPropertyFilters(isNotSet ?? [], frontmatter)).toBe(!expected);
  });

  it.each([
    [{ status: 'retired' }, true],
    [{ Status: 'RETIRED' }, true],
    [{ status: ['active', 'Retired'] }, true],
    [{ status: 'active' }, false],
    [{ status: { retired: true } }, false],
    [null, false]
  ])('says whether %j holds the value', (frontmatter, expected) => {
    expect(doesPassPropertyFilters(hasValue ?? [], frontmatter)).toBe(expected);
    expect(doesPassPropertyFilters(lacksValue ?? [], frontmatter)).toBe(!expected);
  });

  it('matches a number or a boolean by its text, and passes every note with no filters', () => {
    const [numberRule] = parseRelationDefinitions(['r = a[age: 42][alive: TRUE]']).rules;
    expect(doesPassPropertyFilters(numberRule?.chains[0]?.[0]?.filters ?? [], { age: 42, alive: true })).toBe(true);
    expect(doesPassPropertyFilters([], null)).toBe(true);
  });
});

describe('normalizeLabel', () => {
  it('trims and lowercases', () => {
    expect(normalizeLabel('  Employee ')).toBe('employee');
  });
});

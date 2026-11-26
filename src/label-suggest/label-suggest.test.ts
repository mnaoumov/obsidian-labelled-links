import type {
  Editor,
  EditorPosition,
  EditorSuggestContext
} from 'obsidian';
import type { EditorSuggest } from 'obsidian-test-mocks/obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  parseRelationDefinitions,
  RelationRegistry
} from '../relation-registry/relation-registry.ts';
import { LabelSuggest } from './label-suggest.ts';

interface EditorFixture {
  readonly editor: Editor;
  readonly lines: string[];
}

function createEditor(line: string): EditorFixture {
  const lines = [line];
  const editor = castTo<Editor>({
    getLine(lineIndex: number): string {
      return ensureNonNullable(lines[lineIndex]);
    },
    replaceRange(text: string, from: EditorPosition, to: EditorPosition): void {
      const current = ensureNonNullable(lines[0]);
      lines[0] = current.slice(0, from.ch) + text + current.slice(to.ch);
    },
    setCursor: vi.fn()
  });
  return { editor, lines };
}

function createRegistry(lines: readonly string[]): RelationRegistry {
  const parsed = parseRelationDefinitions(lines);
  return new RelationRegistry(parsed.definitions, parsed.rules, parsed.subLabels, parsed.labelVariants);
}

function createSuggest(registry: RelationRegistry): LabelSuggest {
  return new LabelSuggest({
    app: App.createConfigured__().asOriginalType__(),
    getRegistry(): RelationRegistry {
      return registry;
    },
    pluginName: 'Labelled Links'
  });
}

function pick(suggest: LabelSuggest, fixture: EditorFixture, cursorCh: number, label: string): void {
  const triggerInfo = ensureNonNullable(suggest.onTrigger({ ch: cursorCh, line: 0 }, fixture.editor));
  suggest.context = castTo<EditorSuggestContext>({ ...triggerInfo, editor: fixture.editor, file: null });
  suggest.selectSuggestion(label);
}

describe('LabelSuggest', () => {
  const registry = createRegistry(['employee <-> employer', 'mentions', 'coworker = employer -> employee', 'Employment < mentions']);

  it('names the plugin in its instruction line', () => {
    const suggest = createSuggest(registry);
    expect(castTo<EditorSuggest<string>>(suggest).instructions__).toStrictEqual([{ command: 'Labelled Links', purpose: 'Relation registry labels' }]);
  });

  it('offers the labels starting with the typed part first, then those containing it, ignoring case', () => {
    const suggest = createSuggest(registry);
    expect(suggest.getSuggestions(castTo<EditorSuggestContext>({ query: 'EMP' }))).toStrictEqual(['employee', 'employer', 'Employment']);
    expect(suggest.getSuggestions(castTo<EditorSuggestContext>({ query: 'men' }))).toStrictEqual(['mentions', 'Employment']);
    expect(suggest.getSuggestions(castTo<EditorSuggestContext>({ query: 'xyz' }))).toStrictEqual([]);
    expect(suggest.getSuggestions(castTo<EditorSuggestContext>({ query: '' }))).toStrictEqual(['employee', 'employer', 'mentions', 'coworker', 'Employment']);
  });

  it('opens on a field key with the range and query to replace', () => {
    const suggest = createSuggest(registry);
    const { editor } = createEditor('emp::');
    expect(suggest.onTrigger({ ch: 5, line: 0 }, editor)).toStrictEqual({
      end: { ch: 5, line: 0 },
      query: 'emp',
      start: { ch: 0, line: 0 }
    });
  });

  it('stays closed where no label is read, and while the registry is empty', () => {
    expect(createSuggest(registry).onTrigger({ ch: 3, line: 0 }, createEditor('emp').editor)).toBeNull();
    expect(createSuggest(createRegistry([])).onTrigger({ ch: 5, line: 0 }, createEditor('emp::').editor)).toBeNull();
  });

  it('writes the chosen label with the field separator and moves the cursor after it', () => {
    const suggest = createSuggest(registry);
    const fixture = createEditor('emp::');
    pick(suggest, fixture, 5, 'employee');
    expect(fixture.lines[0]).toBe('employee:: ');
    expect(fixture.editor.setCursor).toHaveBeenCalledWith({ ch: 11, line: 0 });
  });

  it('closes the hidden label comment it completes', () => {
    const suggest = createSuggest(registry);
    const fixture = createEditor('[[B]]%%:emp');
    pick(suggest, fixture, 11, 'employer');
    expect(fixture.lines[0]).toBe('[[B]]%%:employer%%');
  });

  it('does nothing when it has no context', () => {
    const suggest = createSuggest(registry);
    suggest.context = null;
    expect(() => {
      suggest.selectSuggestion('employee');
    }).not.toThrow();
  });

  it('renders a label with its inverse, and a label with no inverse alone', () => {
    const suggest = createSuggest(registry);
    const pairEl = createDiv();
    suggest.renderSuggestion('employee', pairEl);
    expect(pairEl.hasClass('mod-complex')).toBe(true);
    expect(pairEl.find('.suggestion-title').textContent).toBe('employee');
    expect(pairEl.find('.suggestion-note').textContent).toBe('Inverse: employer');

    const loneEl = createDiv();
    suggest.renderSuggestion('mentions', loneEl);
    expect(loneEl.find('.suggestion-title').textContent).toBe('mentions');
    expect(loneEl.querySelector('.suggestion-note')).toBeNull();
  });
});

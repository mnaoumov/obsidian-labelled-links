import type {
  MarkdownPostProcessorContext,
  MarkdownSectionInformation
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App,
  MarkdownView
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { LinkBadgeReadingViewComponent } from './link-badge-reading-view-component.ts';
import { RelationIndexComponent } from './relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from './relation-registry.ts';

const ALICE_CONTENT = 'spouse:: [[Dan]]\nSee [[Dan]], [[Carol]] and [mentor:: [[Carol]]].\n';

interface ComponentFixture {
  readonly app: App;
  readonly component: LinkBadgeReadingViewComponent;
  readonly index: RelationIndexComponent;
}

function createContext(sectionInfo: MarkdownSectionInformation | null): MarkdownPostProcessorContext {
  return strictProxy<MarkdownPostProcessorContext>({
    getSectionInfo: () => sectionInfo,
    sourcePath: 'Alice.md'
  });
}

async function createFixture(): Promise<ComponentFixture> {
  const app = App.createConfigured__({
    files: { 'Alice.md': ALICE_CONTENT, 'Carol.md': '# Carol\n', 'Dan.md': '# Dan\n' }
  });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  index.setRegistry(new RelationRegistry(parseRelationDefinitions(['spouse <-> spouse']).definitions));
  await index.rebuild();
  const component = new LinkBadgeReadingViewComponent({ app: app.asOriginalType__(), relationIndex: index });
  component.load();
  return { app, component, index };
}

function createLinkEl(parentEl: HTMLElement, href: string): HTMLElement {
  return parentEl.createEl('a', { attr: { 'data-href': href }, cls: 'internal-link', text: href });
}

async function openInReadingView(app: App): Promise<MarkdownView> {
  const leaf = app.asOriginalType__().workspace.getLeaf(true);
  await leaf.openFile(ensureNonNullable(app.asOriginalType__().vault.getFileByPath('Alice.md')));
  expect(leaf.view).toBeInstanceOf(MarkdownView);
  const view = castTo<MarkdownView>(leaf.view);
  vi.spyOn(view, 'getMode').mockReturnValue('preview');
  return view;
}

function readBadges(el: HTMLElement): string[] {
  return [...el.querySelectorAll('.labelled-links-badge')].map((badgeEl) => `${badgeEl.previousElementSibling?.textContent ?? ''}: ${badgeEl.textContent}`);
}

// Longer than the delay a burst of index changes is collected for.
const RERENDER_WAIT_IN_MILLISECONDS = 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe('LinkBadgeReadingViewComponent', () => {
  it('puts a badge after each labelled link of a section, pairing links with references in order', async () => {
    const { component } = await createFixture();
    const el = createDiv();
    const paragraphEl = el.createEl('p');
    createLinkEl(paragraphEl, 'Dan');
    createLinkEl(paragraphEl, 'Dan');
    createLinkEl(paragraphEl.createSpan({ cls: 'internal-embed' }), 'Carol');
    createLinkEl(paragraphEl, 'Carol');
    createLinkEl(paragraphEl, 'Carol');
    createLinkEl(paragraphEl, 'Nowhere');

    component.postProcess(el, createContext({ lineEnd: 1, lineStart: 0, text: ALICE_CONTENT }));
    expect(readBadges(el)).toEqual(['Dan: spouse', 'Carol: mentor']);
  });

  it('only pairs the references of the lines the section was rendered from, while the text still holds them', async () => {
    const { component } = await createFixture();
    const firstLineEl = createDiv();
    createLinkEl(firstLineEl, 'Dan');
    component.postProcess(firstLineEl, createContext({ lineEnd: 0, lineStart: 0, text: ALICE_CONTENT }));
    expect(readBadges(firstLineEl)).toEqual(['Dan: spouse']);

    const secondLineEl = createDiv();
    createLinkEl(secondLineEl, 'Dan');
    component.postProcess(secondLineEl, createContext({ lineEnd: 1, lineStart: 1, text: ALICE_CONTENT }));
    expect(readBadges(secondLineEl)).toEqual([]);

    const editedEl = createDiv();
    createLinkEl(editedEl, 'Dan');
    component.postProcess(editedEl, createContext({ lineEnd: 1, lineStart: 0, text: `x${ALICE_CONTENT}` }));
    expect(readBadges(editedEl)).toEqual([]);
  });

  it('leaves a section with no source lines alone', async () => {
    const { component } = await createFixture();
    const el = createDiv();
    createLinkEl(el, 'Dan');
    component.postProcess(el, createContext(null));
    expect(readBadges(el)).toEqual([]);
  });

  it('renders a reading view again once its note\'s badges differ from the ones it was rendered with', async () => {
    const { app, component, index } = await createFixture();
    const view = await openInReadingView(app);
    const rerenderSpy = vi.spyOn(view.previewMode, 'rerender');
    component.postProcess(createDiv(), createContext({ lineEnd: 1, lineStart: 0, text: ALICE_CONTENT }));
    vi.useFakeTimers();

    index.setRegistry(new RelationRegistry(parseRelationDefinitions(['spouse <-> spouse']).definitions));
    await vi.advanceTimersByTimeAsync(RERENDER_WAIT_IN_MILLISECONDS);
    expect(rerenderSpy).not.toHaveBeenCalled();

    index.setRegistry(new RelationRegistry([]));
    await vi.advanceTimersByTimeAsync(RERENDER_WAIT_IN_MILLISECONDS);
    expect(rerenderSpy).toHaveBeenCalledExactlyOnceWith(true);

    index.setRegistry(new RelationRegistry([]));
    await vi.advanceTimersByTimeAsync(RERENDER_WAIT_IN_MILLISECONDS);
    expect(rerenderSpy).toHaveBeenCalledTimes(1);
  });

  it('renders nothing again for a note open in Source mode', async () => {
    const { app, index } = await createFixture();
    const view = await openInReadingView(app);
    vi.spyOn(view, 'getMode').mockReturnValue('source');
    const rerenderSpy = vi.spyOn(view.previewMode, 'rerender');
    vi.useFakeTimers();
    index.setRegistry(new RelationRegistry([]));
    await vi.advanceTimersByTimeAsync(RERENDER_WAIT_IN_MILLISECONDS);
    expect(rerenderSpy).not.toHaveBeenCalled();
  });

  it('stops listening to the index once unloaded', async () => {
    const { component, index } = await createFixture();
    const offrefSpy = vi.spyOn(index, 'offref');
    component.unload();
    expect(offrefSpy).toHaveBeenCalledTimes(1);
  });
});

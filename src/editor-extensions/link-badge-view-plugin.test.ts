import type {
  MarkdownFileInfo,
  TFile
} from 'obsidian';

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  App,
  editorInfoField,
  editorLivePreviewField
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { RelationIndexComponent } from '../relation-index-component.ts';
import {
  parseRelationDefinitions,
  RelationRegistry
} from '../relation-registry.ts';
import { createLinkBadgeExtension } from './link-badge-view-plugin.ts';

const ALICE_CONTENT = '---\nchild: "[[Bob]]"\n---\nspouse:: [[Dan]]\nSee [[Carol]].\n';

interface CreateViewParams {
  readonly doc?: string;
  readonly hasFile?: boolean;
  readonly hasLivePreviewField?: boolean;
  readonly isLivePreview?: boolean;
}

interface ViewFixture {
  readonly app: App;
  readonly index: RelationIndexComponent;
  readonly view: EditorView;
}

const views: EditorView[] = [];

afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
});

async function createView(params: CreateViewParams = {}): Promise<ViewFixture> {
  const app = App.createConfigured__({
    files: { 'Alice.md': ALICE_CONTENT, 'Bob.md': '# Bob\n', 'Carol.md': '# Carol\n', 'Dan.md': '# Dan\n' }
  });
  const index = new RelationIndexComponent(app.asOriginalType__());
  index.load();
  index.setRegistry(new RelationRegistry(parseRelationDefinitions(['spouse <-> spouse']).definitions));
  await index.rebuild();

  const file = params.hasFile === false ? null : getFile(app, 'Alice.md');
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: params.doc ?? ALICE_CONTENT,
      extensions: [
        editorInfoField.init(() => castTo<MarkdownFileInfo>({ file })),
        params.hasLivePreviewField === false ? [] : editorLivePreviewField.init(() => params.isLivePreview ?? true),
        createLinkBadgeExtension(index)
      ]
    })
  });
  views.push(view);
  return { app, index, view };
}

function getFile(app: App, path: string): TFile {
  return ensureNonNullable(app.asOriginalType__().vault.getFileByPath(path));
}

function readBadges(view: EditorView): string[] {
  return [...view.contentDOM.querySelectorAll('.labelled-links-badge')].map((badgeEl) => `${String(view.posAtDOM(badgeEl))} ${badgeEl.getAttribute('aria-label') ?? ''}`);
}

function triggerMetadataChanged(app: App, path: string): void {
  const { metadataCache } = app.asOriginalType__();
  const file = getFile(app, path);
  metadataCache.trigger('changed', file, '', ensureNonNullable(metadataCache.getFileCache(file)));
}

const DAN_LINK_END = ALICE_CONTENT.indexOf('[[Dan]]') + '[[Dan]]'.length;

describe('createLinkBadgeExtension', () => {
  it('puts a badge after each labelled link in Live Preview', async () => {
    const { view } = await createView();
    expect(readBadges(view)).toEqual([`${String(DAN_LINK_END)} Alice --spouse--> Dan\nDan --spouse--> Alice`]);
    expect(view.contentDOM.querySelector('.labelled-links-badge')?.textContent).toBe('spouse');
  });

  it('shows nothing in Source mode or in an editor with no note', async () => {
    const sourceMode = await createView({ isLivePreview: false });
    expect(readBadges(sourceMode.view)).toEqual([]);
    const noNote = await createView({ hasFile: false });
    expect(readBadges(noNote.view)).toEqual([]);
    const notObsidian = await createView({ hasLivePreviewField: false });
    expect(readBadges(notObsidian.view)).toEqual([]);
  });

  it('skips a link the text no longer holds where the cache put it', async () => {
    const { view } = await createView({ doc: ALICE_CONTENT.replace('[[Dan]]', '[[Eve]]') });
    expect(readBadges(view)).toEqual([]);
  });

  it('moves the badges with the text while the cache catches up', async () => {
    const { view } = await createView();
    view.dispatch({ changes: { from: 0, insert: 'xx' } });
    expect(readBadges(view)).toEqual([`${String(DAN_LINK_END + 2)} Alice --spouse--> Dan\nDan --spouse--> Alice`]);
  });

  it('keeps the badges when only the selection moves', async () => {
    const { view } = await createView();
    const badgeEl = view.contentDOM.querySelector('.labelled-links-badge');
    view.dispatch({ selection: { anchor: 1 } });
    expect(view.contentDOM.querySelector('.labelled-links-badge')).toBe(badgeEl);
  });

  it('rebuilds the badges when the index changes for the note', async () => {
    const { index, view } = await createView();
    index.setRegistry(new RelationRegistry([]));
    await vi.waitFor(() => {
      expect(readBadges(view)).toEqual([`${String(DAN_LINK_END)} Alice --spouse--> Dan\nNo inverse label is registered for "spouse".`]);
    });
  });

  it('leaves the badges alone when the index changes for another note only', async () => {
    const { app, view } = await createView();
    const dispatchSpy = vi.spyOn(view, 'dispatch');
    triggerMetadataChanged(app, 'Dan.md');
    triggerMetadataChanged(app, 'Alice.md');
    await vi.waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('stops listening to the index once the editor is gone', async () => {
    const { index, view } = await createView();
    const offrefSpy = vi.spyOn(index, 'offref');
    view.destroy();
    expect(offrefSpy).toHaveBeenCalledTimes(1);
  });
});

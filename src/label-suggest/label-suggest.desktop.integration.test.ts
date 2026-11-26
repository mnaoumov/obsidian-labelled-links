import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface PickResult {
  readonly offered: string[];
  readonly text: string;
}

describe('Label suggest', () => {
  // The default registry (`parent <-> child`, `spouse <-> spouse`, `sibling <-> sibling`) is what is offered.
  it('offers registry labels in a field key typed with its `::` and in a hidden label comment, and writes the pick', async () => {
    const results = await evalInObsidian({
      async callback({ app, lib }): Promise<Record<string, PickResult>> {
        const { createNote, pressKey, typeIntoEditor, waitUntil } = lib;
        const notes = [
          await createNote({ content: '# LS Bob\n', path: 'LS Bob.md' }),
          await createNote({ content: '', path: 'LS Field.md' }),
          await createNote({ content: 'See [[LS Bob]]', path: 'LS Comment.md' })
        ];
        const [, fieldNote, commentNote] = notes;

        try {
          const leaf = app.workspace.getLeaf(true);

          async function typeAndPick(file: typeof fieldNote, text: string): Promise<PickResult> {
            if (!file) {
              throw new Error('The note was not created.');
            }
            await leaf.setViewState({ state: { file: file.path, mode: 'source', source: false }, type: 'markdown' });
            const editor = app.workspace.activeEditor?.editor;
            if (!editor) {
              throw new Error('No editor is active.');
            }

            await typeIntoEditor({ editor, text });
            let offered: string[] = [];
            await waitUntil({
              predicate: () => {
                offered = [...activeDocument.body.querySelectorAll(':scope .suggestion-container .suggestion-title')].map((el) => el.textContent);
                return offered.length > 0;
              }
            });
            await pressKey({ key: 'Enter' });
            await waitUntil({ predicate: () => editor.getValue() !== text && !editor.getValue().endsWith(text) });
            return { offered, text: editor.getValue() };
          }

          const field = await typeAndPick(fieldNote, 'chi::');
          const comment = await typeAndPick(commentNote, '%%:sp');
          leaf.detach();
          return { comment, field };
        } finally {
          // The vault is shared by every test file, and another one counts every relation in it.
          for (const file of notes) {
            await app.fileManager.trashFile(file);
          }
        }
      }
    });

    expect(results).toStrictEqual({
      comment: { offered: ['spouse'], text: 'See [[LS Bob]]%%:spouse%%' },
      field: { offered: ['child'], text: 'child:: ' }
    });
  });
});

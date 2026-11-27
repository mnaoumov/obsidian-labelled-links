import dedent from 'dedent';
import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const HOST_CONTENT = dedent`
  # CB Host

  \`\`\`labelled-links
  center: [[CB Alice]]
  hide: spouse
  \`\`\`
`;

interface CodeBlockSnapshot {
  readonly afterEdit: readonly string[];
  readonly initial: readonly string[];
}

describe('Relations code block', () => {
  it('lists the center note\'s relations in Reading view, and redraws when one of them changes', async () => {
    const snapshot = await evalInObsidian({
      async callback({ app, hostContent, lib }): Promise<CodeBlockSnapshot> {
        const { createNote, waitUntil } = lib;
        const notes = [];
        for (const name of ['CB Bob', 'CB Dan', 'CB Erin']) {
          notes.push(await createNote({ content: `# ${name}\n`, path: `${name}.md` }));
        }
        const alice = await createNote({ content: '---\nchild: "[[CB Bob]]"\n---\nspouse:: [[CB Dan]]\n', path: 'CB Alice.md' });
        const host = await createNote({ content: hostContent, path: 'CB Host.md' });
        notes.push(alice, host);

        try {
          await waitUntil({ predicate: () => (app.metadataCache.getFileCache(alice)?.links?.length ?? 0) === 1 });
          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(host, { state: { mode: 'preview' } });

          async function readRows(expectedCount: number): Promise<string[]> {
            let rows: string[] = [];
            await waitUntil({
              predicate: () => {
                const blockEl = leaf.view.containerEl.querySelector(':scope .markdown-preview-view .labelled-links-relations-code-block');
                rows = [...blockEl?.querySelectorAll('.labelled-links-relations-group') ?? []].map((groupEl) => `${groupEl.querySelector('.labelled-links-relations-group-title')?.textContent ?? ''}: ${[...groupEl.querySelectorAll('.labelled-links-relation-link')].map((el) => el.textContent).join(', ')}`);
                return rows.length === expectedCount;
              }
            });
            return rows;
          }

          const initial = await readRows(1);
          await app.vault.modify(alice, '---\nchild: "[[CB Bob]]"\n---\nspouse:: [[CB Dan]]\nmentor:: [[CB Erin]]\n');
          const afterEdit = await readRows(2);
          leaf.detach();
          return { afterEdit, initial };
        } finally {
          // The vault is shared by every test file, and another one counts every relation in it.
          for (const file of notes) {
            await app.fileManager.trashFile(file);
          }
        }
      },
      input: { hostContent: HOST_CONTENT }
    });

    expect(snapshot).toEqual({
      afterEdit: ['child: CB Bob', 'mentor: CB Erin'],
      initial: ['child: CB Bob']
    });
  });
});

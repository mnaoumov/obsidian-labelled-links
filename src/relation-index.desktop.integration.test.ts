import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const PLUGIN_ID = 'labelled-links';

// Real Obsidian, not the mocks, decides what a property and an inline field cache as, so this is where the
// Extractor's assumptions about it are checked: a list property caches one link per item, a value holding
// Several links caches one bogus link the extractor replaces, and an inline field leaves no trace in the cache.
const ALICE_CONTENT = [
  '---',
  'child:',
  '  - "[[LL Bob]]"',
  '  - "[[LL Carol]]"',
  'sibling: "[[LL Bob]], [[LL Carol]]"',
  '---',
  '',
  'spouse:: [[LL Dan]]',
  '',
  'Met [[LL Bob]] at work [mentor:: [[LL Carol]]].',
  ''
].join('\n');

describe('Relation index', () => {
  it('counts the relations real Obsidian caches for properties and inline fields', async () => {
    const noticeText = await evalInObsidian({
      async callback({ aliceContent, app, lib, pluginId }): Promise<string> {
        const { createNote, waitUntil } = lib;
        for (const name of ['LL Bob', 'LL Carol', 'LL Dan']) {
          await createNote({ content: `# ${name}\n`, path: `${name}.md` });
        }
        const alice = await createNote({ content: aliceContent, path: 'LL Alice.md' });
        await waitUntil({
          predicate: () => (app.metadataCache.getFileCache(alice)?.links?.length ?? 0) === 3
        });

        app.commands.executeCommandById(`${pluginId}:rebuild-relation-index`);

        let text = '';
        await waitUntil({
          predicate: () => {
            text = [...activeDocument.querySelectorAll('.notice')].map((notice) => notice.textContent).join('\n');
            return text.includes('Indexed');
          }
        });
        return text;
      },
      input: { aliceContent: ALICE_CONTENT, pluginId: PLUGIN_ID }
    });

    // `child` twice, `sibling` twice, `spouse` and `mentor`: the plain link to Bob is not a relation.
    expect(noticeText).toContain('Indexed 6 relation(s)');
  });
});

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const ALICE_CONTENT = [
  '---',
  'child: "[[LB Bob]]"',
  '---',
  '',
  'spouse:: [[LB Dan]]',
  '',
  'Met [[LB Carol]] at work [mentor:: [[LB Carol]]].',
  ''
].join('\n');

interface BadgeSnapshot {
  readonly label: string;
  readonly linkText: string;
  readonly tooltip: string;
}

// The plain link to Carol and the `child` property get no badge: a plain link has no label, and a property
// Already shows its label as the property name beside the link.
const EXPECTED_BADGES: BadgeSnapshot[] = [
  { label: 'spouse', linkText: 'LB Dan', tooltip: 'LB Dan is LB Alice\'s spouse\nLB Alice is LB Dan\'s spouse' },
  { label: 'mentor', linkText: 'LB Carol', tooltip: 'LB Carol is LB Alice\'s mentor\nNo inverse label is registered for "mentor".' }
];

describe('Link badges', () => {
  // The tooltip is read from the badge's `aria-label`, which is the text Obsidian's tooltip shows. A trusted hover
  // Does not raise Obsidian's tooltips in the test instance at all, not even a ribbon icon's, so hovering would
  // Assert nothing about the badge.
  it('shows the label after each labelled link in Reading view and Live Preview, with the inverse in its tooltip', async () => {
    const snapshots = await evalInObsidian({
      async callback({ aliceContent, app, lib }): Promise<Record<string, BadgeSnapshot[]>> {
        const { createNote, waitUntil } = lib;
        const notes = [];
        for (const name of ['LB Bob', 'LB Carol', 'LB Dan']) {
          notes.push(await createNote({ content: `# ${name}\n`, path: `${name}.md` }));
        }
        const alice = await createNote({ content: aliceContent, path: 'LB Alice.md' });
        notes.push(alice);

        try {
          await waitUntil({ predicate: () => (app.metadataCache.getFileCache(alice)?.links?.length ?? 0) === 3 });
          const leaf = app.workspace.getLeaf(true);

          // Live Preview keeps CodeMirror's widget buffers and the hidden `]]` between a link and its badge.
          function readLinkText(badgeEl: Element): string {
            let el = badgeEl.previousElementSibling;
            while (el && !el.matches('.internal-link, .cm-hmd-internal-link')) {
              el = el.previousElementSibling;
            }
            return el?.textContent ?? '';
          }

          async function readBadges(containerSelector: string): Promise<BadgeSnapshot[]> {
            let badges: BadgeSnapshot[] = [];
            await waitUntil({
              predicate: () => {
                const containerEl = leaf.view.containerEl.querySelector(containerSelector);
                badges = [...containerEl?.querySelectorAll('.labelled-links-badge') ?? []].map((badgeEl) => ({
                  label: badgeEl.textContent,
                  linkText: readLinkText(badgeEl),
                  tooltip: badgeEl.getAttribute('aria-label') ?? ''
                }));
                return badges.length === 2;
              }
            });
            return badges;
          }

          await leaf.openFile(alice, { state: { mode: 'preview' } });
          const readingView = await readBadges('.markdown-preview-view');

          await leaf.setViewState({ state: { file: alice.path, mode: 'source', source: false }, type: 'markdown' });
          const livePreview = await readBadges('.cm-content');

          leaf.detach();
          return { livePreview, readingView };
        } finally {
          // The vault is shared by every test file, and another one counts every relation in it.
          for (const file of notes) {
            await app.fileManager.trashFile(file);
          }
        }
      },
      input: { aliceContent: ALICE_CONTENT }
    });

    expect(snapshots).toEqual({ livePreview: EXPECTED_BADGES, readingView: EXPECTED_BADGES });
  });
});

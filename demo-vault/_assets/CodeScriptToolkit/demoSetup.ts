import type { App } from 'obsidian';

import { configureCommunityPlugin } from '@mnaoumov/obsidian-lib/community-plugins';
import { Notice } from 'obsidian';

// Shared code for every `code-button` in this vault, so each note's button stays a one-liner instead of a
// Block copy-pasted across notes.
//
// The plugin id has to match `manifest.json` exactly: commands are keyed by it, and so is `data.json`.
const PLUGIN_ID = 'labelled-links';

const DEFAULT_RELATION_DEFINITIONS = ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling'];

/**
 * Runs the plugin's `Rebuild relation index` command, which reads every note again and shows how many
 * relations it found.
 *
 * Manual equivalent: `Labelled Links: Rebuild relation index` in the Command Palette.
 */
export function rebuildRelationIndex(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:rebuild-relation-index`);
}

/**
 * Opens a note and then the plugin's relations pane beside it, so the pane shows that note's relations.
 *
 * Manual equivalent: open the note, then run `Labelled Links: Open relations pane` in the Command Palette.
 */
export async function openRelationsPane(app: App, notePath: string): Promise<void> {
  const file = app.vault.getFileByPath(notePath);
  if (!file) {
    new Notice(`${notePath} is missing from this vault.`);
    return;
  }
  await app.workspace.getLeaf(false).openFile(file);
  app.commands.executeCommandById(`${PLUGIN_ID}:open-relations-pane`);
}

/**
 * Sets the plugin's relation registry to the given definitions.
 *
 * `configureCommunityPlugin` routes through the plugin's own settings component while it is loaded, so the
 * change applies live -- no window reload, and no writing `data.json` behind a running plugin's back, which
 * it would overwrite from memory as it unloads.
 *
 * Manual equivalent: edit **Relation registry** in **Settings -> Community plugins -> Labelled Links**.
 */
export async function setRelationDefinitions(app: App, relationDefinitions: string[]): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: { relationDefinitions } });
  new Notice(`The relation registry now has ${String(relationDefinitions.length)} definition(s). It is live -- no reload needed.`);
}

/**
 * Puts the relation registry back to the definitions a fresh install starts with, so exploring the settings
 * note leaves the vault as you found it.
 *
 * Manual equivalent: restore the default lines in the same field in the settings tab.
 */
export async function resetRelationDefinitions(app: App): Promise<void> {
  await setRelationDefinitions(app, DEFAULT_RELATION_DEFINITIONS);
}
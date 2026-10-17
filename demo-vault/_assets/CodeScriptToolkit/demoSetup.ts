import type {
  App,
  TFile
} from 'obsidian';

import { configureCommunityPlugin } from '@mnaoumov/obsidian-lib/community-plugins';
import {
  MarkdownView,
  Notice
} from 'obsidian';

// Shared code for every `code-button` in this vault, so each note's button stays a one-liner instead of a
// Block copy-pasted across notes.
//
// The plugin id has to match `manifest.json` exactly: commands are keyed by it, and so is `data.json`.
const PLUGIN_ID = 'labelled-links';

const SCRATCH_NOTE_PATH = 'Materials/01 Sample commands/Scratch note.md';

const DEFAULT_TEXT_SETTING = 'defaultText';

/**
 * Runs the plugin's `Sample` command, which shows a notice.
 *
 * Manual equivalent: `Labelled Links: Sample` in the Command Palette.
 */
export function runSampleCommand(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:sample`);
}

/**
 * Opens the scratch note in editing mode and runs the plugin's `Sample editor` command against it.
 *
 * The command is an editor command, so it needs a live editor -- and this vault opens notes in reading
 * view, where there is none. Opening the scratch note in Source mode first is what a reader would do by
 * hand before running the command.
 *
 * Manual equivalent: open `Scratch note`, switch it to Source mode, put the cursor where you want the text,
 * and run `Labelled Links: Sample editor` in the Command Palette.
 */
export async function runSampleEditorCommandOnScratchNote(app: App): Promise<void> {
  const scratchNote = await ensureScratchNote(app);
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(scratchNote, { state: { mode: 'source' } });

  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) {
    new Notice('Could not open the scratch note in editing mode.');
    return;
  }

  view.editor.setCursor(view.editor.lastLine());
  app.commands.executeCommandById(`${PLUGIN_ID}:sample-editor`);
  new Notice('Ran the Sample editor command. Look at the end of the scratch note.');
}

/**
 * Sets the plugin's `textSetting` to the given value.
 *
 * `configureCommunityPlugin` routes through the plugin's own settings component while it is loaded, so the
 * change applies live -- no window reload, and no writing `data.json` behind a running plugin's back, which
 * it would overwrite from memory as it unloads.
 *
 * Manual equivalent: change the same field in **Settings -> Community plugins -> Labelled Links**.
 */
export async function setTextSetting(app: App, value: string): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: { textSetting: value } });
  new Notice(`textSetting is now "${value}". It is live -- no reload needed.`);
}

/**
 * Puts `textSetting` back to the value a fresh install starts with, so exploring this note leaves the vault
 * as you found it.
 *
 * Manual equivalent: type the default back into the same field in the settings tab.
 */
export async function resetTextSetting(app: App): Promise<void> {
  await setTextSetting(app, DEFAULT_TEXT_SETTING);
}

async function ensureScratchNote(app: App): Promise<TFile> {
  const existing = app.vault.getFileByPath(SCRATCH_NOTE_PATH);
  if (existing) {
    return existing;
  }
  return await app.vault.create(SCRATCH_NOTE_PATH, '# Scratch note\n\nRun the Sample editor command here.\n');
}

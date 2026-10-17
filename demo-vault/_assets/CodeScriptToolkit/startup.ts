// Per-vault startup script, run by the universal `Demo Vault Helper` plugin (through `CodeScript Toolkit`'s
// `require`) once `CodeScript Toolkit` is installed and enabled. This is where a demo vault does its own
// Startup setup. Here it just opens the landing note.

import type { App } from 'obsidian';

const START_NOTE_PATH = '00 Start.md';

// `CodeScript Toolkit` calls the exported `invoke` on load (its `startupScriptPath` setting, which the
// `Demo Vault Helper` points here). A top-level script with no `invoke` export throws
// `this.startupScript.invoke is not a function` the moment the vault loads.
export async function invoke(app: App): Promise<void> {
  const startNote = app.vault.getFileByPath(START_NOTE_PATH);
  if (startNote) {
    await app.workspace.getLeaf(false).openFile(startNote);
  }
}

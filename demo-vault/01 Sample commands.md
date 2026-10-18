# Sample commands

Labelled Links adds the sample commands below to the Command Palette. They are the scaffolded samples the generator gives every new plugin — replace them with your own, and rewrite this note as you do.

## Sample

A **global** command: it runs wherever you are, whether or not a note is open. This one shows a notice.

```code-button
---
caption: Run Sample
---
require('/demoSetup.ts').runSampleCommand(app);
```

Manual equivalent: open the Command Palette (`Ctrl+P` / `Cmd+P`) and run **Labelled Links: Sample**.

## Sample editor

An **editor** command: it only appears when a note is open for editing, and it acts on the cursor. This one inserts text where the cursor is.

Editor commands need a live editor, and this vault opens notes in reading view — so the button below opens the scratch note (`Materials/01 Sample commands/Scratch note.md`, created on first use) in Source mode first, puts the cursor at the end, and only then runs the command.

```code-button
---
caption: Run Sample editor on the scratch note
---
await require('/demoSetup.ts').runSampleEditorCommandOnScratchNote(app);
```

Manual equivalent: open `Scratch note`, switch it to Source mode (`Ctrl+E` / `Cmd+E`), place the cursor, and run **Labelled Links: Sample editor**.

The scratch note is gitignored, so whatever you write in it stays out of your repository.

## Where they are defined

**Sample** and **Sample editor** live in `src/plugin.ts`, registered in `onloadImpl` with `this.addCommand(...)`. The command id you see in `demoSetup.ts` is `labelled-links:sample` — Obsidian prefixes every command id with the plugin id from `manifest.json`.

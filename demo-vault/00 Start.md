# Start here

This is an [Obsidian](https://obsidian.md/) vault that documents the [Labelled Links](https://github.com/mnaoumov/obsidian-labelled-links/) plugin by demonstrating it. Every feature has a note that says what it does and why you would want it, and a button you can press to watch it happen.

Label your links: give each link a relation, show the inverse relation from the other end, and browse every relation of a note in one pane.

## Your first minute

Below this paragraph is a **code button** — a captioned rectangle. It is not a picture of a button: **clicking it runs the code**, and the result appears underneath it. The `</>` toggle beside the caption reveals the code it runs, so nothing here is a black box.

```code-button
---
caption: Rebuild the relation index
---
require('/demoSetup.ts').rebuildRelationIndex(app);
```

A notice should have appeared in the top-right corner, saying how many relations the plugin found in this vault. That is the **Labelled Links: Rebuild relation index** command running, the same thing you get from the Command Palette (`Ctrl+P` / `Cmd+P`).

Every button in this vault also states its **manual equivalent**, so you learn the real steps rather than depending on the buttons.

## Features

| Note | What it covers |
| --- | --- |
| [01 Relations](<./01 Relations.md>) | How a property or an inline field labels a link, and how the other end reads it. |
| [02 Settings](<./02 Settings.md>) | Every setting, by the key it is stored under in `data.json`. |
| [03 Relations pane](<./03 Relations pane.md>) | The pane listing every relation of a note in both directions, plus its plain links and backlinks. |

## Materials

`Materials/` holds the notes the walkthroughs operate on, so you never have to build a fixture to see a feature working.

# Relations pane

The relations pane lists every relation of the note you are looking at, in both directions, so you can see how a note connects without opening the notes around it. It follows the active note: switch notes and it redraws.

## Open it on Alice

```code-button
---
caption: Open Alice and the relations pane
---
await require('/demoSetup.ts').openRelationsPane(app, 'Materials/01 Relations/Alice.md');
```

Manual equivalent: open [Alice](<./Materials/01 Relations/Alice.md>), then open the Command Palette (`Ctrl+P` / `Cmd+P`) and run **`Labelled Links`: Open relations pane**. On mobile the pane opens in the right drawer.

The pane has up to three sections:

- **Outgoing** lists the relations written in the note, grouped by label. Alice has `child` (Bob) and `spouse` (Dan).
- **Incoming** lists the relations other notes write about this one, each under its **inverse** label. Open Bob and Alice's `child` link shows up under `parent`, because the registry in [02 Settings](<./02 Settings.md>) pairs `parent <-> child`. Beside it a faint sentence, `Bob is Alice's child`, says which end the label describes. Hover over the sentence and the tooltip shows the link as Alice wrote it, `Alice: child: "[Bob](<Bob.md>)"`, in the form her note uses: a property here, `spouse:: [Dan](<Dan.md>)` for an inline field, `[[Erin]]%%:child%%` for a hidden label. Alice's own **Incoming** section has Carol under `mentor`, with `Alice is Carol's mentor` beside it: the registry has no inverse for `mentor`, so the group carries the label Carol wrote, and the sentence tells you that Alice is the mentor, not Carol.
- **Unlabelled** holds the plain links (**Links**) and backlinks (**Backlinks**), each with the line it sits on, so you can tell why the link is there.

Click a note in the pane to open it, with `Ctrl` / `Cmd` held to open it in a new tab. Hover over it for a page preview, also with `Ctrl` / `Cmd` held.

## Unlabelled links

```code-button
---
caption: Open Bob and the relations pane
---
await require('/demoSetup.ts').openRelationsPane(app, 'Materials/01 Relations/Bob.md');
```

Manual equivalent: open [Bob](<./Materials/01 Relations/Bob.md>) with the pane already open.

Bob has an incoming `parent` from Alice and a plain link to Carol, listed under **Unlabelled → Links** with the sentence it is in. Open [Carol](<./Materials/01 Relations/Carol.md>) and the same link appears from her end, under **Backlinks**.

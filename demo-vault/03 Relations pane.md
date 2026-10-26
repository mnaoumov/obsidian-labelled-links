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

The pane has up to four sections:

- **Outgoing** lists the relations written in the note, grouped by label. Alice has `child` (Bob) and `spouse` (Dan).
- **Incoming** lists the relations other notes write about this one, each under its **inverse** label. Open Bob and Alice's `child` link shows up under `parent`, because the registry in [02 Settings](<./02 Settings.md>) pairs `parent <-> child`. Beside it a faint sentence, `Bob is Alice's child`, says which end the label describes. Hover over the sentence and the tooltip shows the link as Alice wrote it, `Alice: child: "[Bob](<Bob.md>)"`, in the form her note uses: a property here, `spouse:: [Dan](<Dan.md>)` for an inline field, `[[Erin]]%%:child%%` for a hidden label. Alice's own **Incoming** section has Carol under `mentor`, with `Alice is Carol's mentor` beside it: the registry has no inverse for `mentor`, so the group carries the label Carol wrote, and the sentence tells you that Alice is the mentor, not Carol.
- **Derived** lists the relations the registry's composition rules work out, which no note stores. It is empty until you add a rule, as below.
- **Unlabelled** holds the plain links (**Links**) and backlinks (**Backlinks**), each with the line it sits on, so you can tell why the link is there.

The **Include sub-labels** button in the pane's header switches it to the wide meaning of each label: a relation whose label the registry declares as a kind of another (`mentor < teacher`) is listed under the widest label instead, tagged with its own, and the **Derived** section follows sub-labels too. The pane remembers the choice. [02 Settings](<./02 Settings.md>) has a button that adds such a line.

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

## Derived relations

```code-button
---
caption: Add the "aunt" rule and open Erin
---
await require('/demoSetup.ts').addCompositionRules(app);
await require('/demoSetup.ts').openRelationsPane(app, 'Materials/01 Relations/Erin.md');
```

Manual equivalent: add the line `aunt = parent -> sibling` to **Relation registry** in [02 Settings](<./02 Settings.md>), then open [Erin](<./Materials/01 Relations/Erin.md>) with the pane open.

Erin's **Derived** section has Carol under `aunt`, with the sentence `Carol is Erin's aunt`. No note says so: Dan labels Erin his `child`, which reads as `parent` from Erin, and Dan lists Carol as his `sibling`. Hover over the sentence and the tooltip spells out that chain, `Carol is Erin's aunt: Erin's parent Dan's sibling`. Put the default registry back from [02 Settings](<./02 Settings.md>) when you are done.

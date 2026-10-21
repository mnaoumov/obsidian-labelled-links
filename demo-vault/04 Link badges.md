# Link badges

A labelled link carries its label on the link itself: a small badge right after it, in Live Preview and in Reading view. Hover over the badge and a tooltip names the relation in both directions, as a sentence saying which note is which, so you see how the other note reads the same link without opening it.

## See a badge in Reading view

```code-button
---
caption: Open Alice in Reading view
---
await require('/demoSetup.ts').openNoteIn(app, 'Materials/01 Relations/Alice.md', 'reading');
```

Manual equivalent: open [Alice](<./Materials/01 Relations/Alice.md>), then pick **Reading view** from the `...` menu in the note's header, or press `Ctrl+E` / `Cmd+E`.

Alice's `spouse:: Dan` line now shows a `spouse` badge after the link to Dan. Hover over it and the tooltip reads:

- `Dan is Alice's spouse`
- `Alice is Dan's spouse`

The second line is the inverse, read from the registry in [02 Settings](<./02 Settings.md>). `spouse` is its own inverse, so both lines carry the same label, each naming the other note as the spouse.

## See it in Live Preview

```code-button
---
caption: Open Alice in Live Preview
---
await require('/demoSetup.ts').openNoteIn(app, 'Materials/01 Relations/Alice.md', 'live-preview');
```

Manual equivalent: open Alice, then pick **Live Preview** from the same `...` menu.

The badge sits after the link while you edit. Type around it and it moves with the link. Source mode shows the raw text and no badges.

## Where a badge does not appear

- On a link in the **Properties** view.
  - The property name is the label, and it already sits beside the link in the same row, so a badge would print it twice. Alice's `child` property is that case. The relations pane in [03 Relations pane](<./03 Relations pane.md>) shows how Bob reads it.
- On a plain link.
  - It has no label to show.
- On an embed.
  - A badge belongs on a link you click, not on a file shown inside the note.

## A label with no inverse

A labelled link still gets its badge when the registry has no inverse for its label. Carol's `mentor` link to Alice is one.

```code-button
---
caption: Open Carol in Reading view
---
await require('/demoSetup.ts').openNoteIn(app, 'Materials/01 Relations/Carol.md', 'reading');
```

Manual equivalent: open [Carol](<./Materials/01 Relations/Carol.md>) and switch to **Reading view**.

The link to Alice shows a `mentor` badge, and its tooltip reads:

- `Alice is Carol's mentor`
- `No inverse label is registered for "mentor".`

The registry in [02 Settings](<./02 Settings.md>) does not list `mentor`, so there is no second label to show. Alice's end of the link reads as `mentor` in the relations pane.

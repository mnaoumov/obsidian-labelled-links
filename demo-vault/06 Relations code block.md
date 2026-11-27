# Relations code block

A `labelled-links` code block lists a note's relations inside a note, grouped by label like the [relations pane](<./03 Relations pane.md>), so a person note, an infobox callout or a character sheet shows them with the pane closed. It redraws by itself when a relation it lists changes.

## Alice's relations

The block below names [Alice](<./Materials/01 Relations/Alice.md>) with `center`. Without `center` it lists the note it sits in. Click into it in Live Preview to see its source.

```labelled-links
center: Materials/01 Relations/Alice
```

It shows Alice's **Outgoing** `child` (Bob) and `spouse` (Dan), and under **Incoming** Carol's `mentor` link to her. Plain links and backlinks are left out unless the block asks for them with `unlabelled: true`, because an infobox is about relations, not about every mention.

## Only some labels, in a callout

<!-- markdownlint-disable-next-line MD052 -- An Obsidian callout header, not a reference link. -->
> [!info] Bob's family
>
> ```labelled-links
> center: Materials/01 Relations/Bob
> labels: parent, child, sibling
> ```

`labels` keeps only the labels it names, and `hide` leaves out the ones it names. Labels are read as seen from the listed note, so an incoming relation matches by its inverse label, and a label with variants matches by the variant shown too, ignoring case. Here Bob's `parent`, Alice, is listed under **Incoming**.

## Options

Each line of the block is `key: value`. A line starting with `#` is a comment, and a line the block cannot read is listed in place of the relations.

| Option | Value | Default |
| --- | --- | --- |
| `center` | The note to list, as `[[Note]]` or its link text. | The note holding the block. |
| `labels` | The only labels to list, comma-separated. | Every label. |
| `hide` | Labels to leave out, comma-separated. | None. |
| `derived` | `true` or `false`: whether the **Derived** section, from the registry's composition rules, is listed. | `true` |
| `sub-labels` | `true` or `false`: whether a sub-label's relations are listed in their widest superset's group, like the pane's **Include sub-labels** button. | `false` |
| `unlabelled` | `true` or `false`: whether plain links and backlinks are listed. | `false` |

Click a note in the block to open it, with `Ctrl` / `Cmd` held to open it in a new tab, and hover over it for a page preview.

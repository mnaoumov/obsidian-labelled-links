# Relations

`Labelled Links` reads a relation out of the syntax you already write, so nothing needs setting up and a vault stays readable without the plugin. A link is a relation when it is the value of a property or of an inline field, and the property or field name is its label.

## Properties

Every link-valued property is a relation labelled with the property name, and a list property labels each of its links. [Alice](<./Materials/01 Relations/Alice.md>) has `child: "[Bob](<Bob.md>)"` in her properties, so the link from Alice to Bob is labelled `child`. A property takes a wikilink too, `child: "[[Bob]]"`, and Obsidian indexes either form as a link.

## Inline fields

A link in the value of an inline field is a relation labelled with the field key. Alice's note also has the line `spouse:: [Dan](<Dan.md>)`, so the link to [Dan](<./Materials/01 Relations/Dan.md>) is labelled `spouse`.

A field written that way takes its whole line. To put one in the middle of a sentence, wrap it in square brackets, `[key:: value]`, or in parentheses, `(key:: value)`: the closing bracket ends the value, and the sentence carries on after it. Both forms label their links the same way, and Obsidian shows them as you typed them, brackets and key included (only the `Dataview` plugin hides the key of the parenthesised form). Two notes use them:

- [Carol](<./Materials/01 Relations/Carol.md>) writes `[sibling:: [Dan](<Dan.md>)]` inside a sentence, so her link to Dan is labelled `sibling`.
- [Dan](<./Materials/01 Relations/Dan.md>) writes `(sibling:: [Carol](<Carol.md>))` inside a sentence, so his link to Carol is labelled `sibling` too.

Open either note with the relations pane showing, and the other one is listed under `sibling` twice: once as the outgoing relation the note writes, and once as the incoming relation the other note writes, which reads as `sibling` from this end because `sibling` is its own inverse.

Inline fields are not an Obsidian feature. The syntax comes from the `Dataview` plugin, and `Datacore`, a newer query plugin by the same author, reads all three forms too. Without one of them installed, this markup adds nothing beyond the relation `Labelled Links` reads from it: Obsidian shows it as typed text, and nothing else in the vault reads it. With `Dataview` or `Datacore`, the same fields also become metadata you can query. `Datacore` indexes them unless you turn off its **Inline fields** setting, and leaves them looking as you typed them.

```code-button
---
caption: Install Dataview
---
await require('/demoSetup.ts').installDataview(app);
```

```code-button
---
caption: Install Datacore
---
await require('/demoSetup.ts').installDatacore(app);
```

Manual equivalent: open **Settings → Community plugins → Browse**, search for **`Dataview`** or **`Datacore`**, then install and enable it.

## Hidden labels

Every form above puts the label in the text. To label a link in a sentence without the label showing, put a comment holding `:` and the label right after the link: `[[Erin]]%%:child%%`, or `[Erin](<Erin.md>)%%:child%%`. Reading view does not render a comment, so the sentence reads as if the link were plain, and the link badge is the only visible trace of the label. The link itself stays outside the comment, because Obsidian does not index a link inside one: it keeps its backlink, its graph edge and its rename updates. The `:` tells a label from an ordinary comment, so `[[Erin]]%%check this%%` labels nothing. Spaces are allowed between the link and the comment and inside the comment, and a hidden label wins over an inline field the link sits in.

[Dan](<./Materials/01 Relations/Dan.md>) writes `[Erin](<Erin.md>)%%:child%%` in a sentence, so his link to [Erin](<./Materials/01 Relations/Erin.md>) is labelled `child`, and reads as `parent` from Erin's end.

A property hides the label from the sentence too, by moving the link out of it: `child: "[Erin](<Erin.md>)"`.

## Inverse labels

From the other end, a relation shows its inverse label from the registry in [02 Settings](<./02 Settings.md>). Bob's incoming `child` relation from Alice reads as `parent`, and Dan's incoming `spouse` reads as `spouse`, because that label is its own inverse. The inverse is worked out in memory and never written into [Bob](<./Materials/01 Relations/Bob.md>) or Dan.

A label the registry gives no inverse reads as itself from both ends. [Carol](<./Materials/01 Relations/Carol.md>) has the line `mentor:: [Alice](<Alice.md>)`, and the registry does not list `mentor`, so Alice's incoming relation from Carol is labelled `mentor` too. You do not have to declare such a label: a lone `mentor` line in the registry behaves exactly like leaving it out, and only says on record that it has no inverse. Add `mentor <-> mentee` to the registry and Alice's end reads `mentee` instead.

A link that is neither, like the plain link to [Carol](<./Materials/01 Relations/Carol.md>) in Bob's note, is kept as an unlabelled link and backlink.

## Rebuild the index

The index updates itself as you edit, rename and delete notes. If it ever looks wrong, rebuild it: every note is read again and a notice says how many relations it found.

```code-button
---
caption: Rebuild the relation index
---
require('/demoSetup.ts').rebuildRelationIndex(app);
```

Manual equivalent: open the Command Palette (`Ctrl+P` / `Cmd+P`) and run **`Labelled Links`: Rebuild relation index**.

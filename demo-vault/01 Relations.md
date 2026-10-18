# Relations

`Labelled Links` reads a relation out of the syntax you already write, so nothing needs setting up and a vault stays readable without the plugin. A link is a relation when it is the value of a property or of an inline field, and the property or field name is its label.

## Properties

Every link-valued property is a relation labelled with the property name, and a list property labels each of its links. [Alice](<./Materials/01 Relations/Alice.md>) has `child: "[[Bob]]"` in her properties, so the link from Alice to Bob is labelled `child`.

## Inline fields

A link in the value of an inline field is a relation labelled with the field key. Alice's note also has the line `spouse:: [Dan](<Dan.md>)`, so the link to [Dan](<./Materials/01 Relations/Dan.md>) is labelled `spouse`. The bracketed forms `[spouse:: ...]` and `(spouse:: ...)` work inside a sentence too.

## Inverse labels

From the other end, a relation shows its inverse label from the registry in [02 Settings](<./02 Settings.md>). Bob's incoming `child` relation from Alice reads as `parent`, and Dan's incoming `spouse` reads as `spouse`, because that label is its own inverse. The inverse is worked out in memory and never written into [Bob](<./Materials/01 Relations/Bob.md>) or Dan.

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

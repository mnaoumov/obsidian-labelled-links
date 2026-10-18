# Settings

Every setting Labelled Links stores, listed by the **key it is written under in `data.json`** rather than by its display label — that is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → Labelled Links**.

## General

- `relationDefinitions`
  - the relation registry, shown in the settings tab as **Relation registry**, one definition per line. `employee <-> employer` is a pair: a link labelled `employee` reads as `employer` from its target. `spouse <-> spouse` is a symmetric label. A lone `mentions` has no inverse, so it reads as itself from both ends, like every label the registry does not list. A malformed line, or one that defines a label a second time, is rejected with a message naming it. The default is `parent <-> child`, `spouse <-> spouse` and `sibling <-> sibling`.

## Try it

Add a pair to the registry without leaving this note. The change applies live, so there is no reload, and the incoming relations are relabelled straight away without re-reading any note.

```code-button
---
caption: Add "employee <-> employer" to the registry
---
await require('/demoSetup.ts').setRelationDefinitions(app, ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling', 'employee <-> employer']);
```

Manual equivalent: add the line `employee <-> employer` to **Relation registry** in the settings tab.

When you are done, put the default registry back:

```code-button
---
caption: Reset the registry to its default
---
await require('/demoSetup.ts').resetRelationDefinitions(app);
```

Manual equivalent: delete the line you added.

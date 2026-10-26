# Settings

Every setting `Labelled Links` stores, listed by the **key it is written under in `data.json`** rather than by its display label — that is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → `Labelled Links`**.

## General

- `relationDefinitions`
  - the relation registry, shown in the settings tab as **Relation registry**, one definition per line. `employee <-> employer` is a pair: a link labelled `employee` reads as `employer` from its target. `spouse <-> spouse` is a symmetric label. A lone `mentions` has no inverse, so it reads as itself from both ends, like every label the registry does not list. A line with `=` is a **composition rule**: `aunt = parent -> sibling` derives a note's `aunt` as its parent's sibling, and `|` separates alternative chains, as in `sibling-in-law = spouse -> sibling | sibling -> spouse`. Each step is a label as seen from the note the step starts at, inverse labels included, and a step may name another rule. A derived relation is never written into a note, never ends at the note it starts from, and is not shown when the note already stores the same label to the same note. A malformed line, a label or rule defined a second time, a rule that reaches its own label (directly or through another rule) and a rule longer than 8 links once its rules are expanded are rejected with a message naming the line. The default is `parent <-> child`, `spouse <-> spouse` and `sibling <-> sibling`.

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

## Try a composition rule

Add two rules: `aunt`, a parent's sibling, and `sibling-in-law`, a spouse's sibling or a sibling's spouse. Nothing in the notes changes, yet [Erin](<./Materials/01 Relations/Erin.md>) now has an aunt, Carol, because Erin's parent Dan lists Carol as his sibling, and [Alice](<./Materials/01 Relations/Alice.md>) has Carol as her sibling-in-law through her spouse Dan. See them in the **Derived** section of [03 Relations pane](<./03 Relations pane.md>).

```code-button
---
caption: Add the "aunt" and "sibling-in-law" rules
---
await require('/demoSetup.ts').addCompositionRules(app);
```

Manual equivalent: add the lines `aunt = parent -> sibling` and `sibling-in-law = spouse -> sibling | sibling -> spouse` to **Relation registry**.

Use the reset button above to take them out again.

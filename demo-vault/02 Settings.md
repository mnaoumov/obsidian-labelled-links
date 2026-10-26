# Settings

Every setting `Labelled Links` stores, listed by the **key it is written under in `data.json`** rather than by its display label — that is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → `Labelled Links`**.

## General

- `relationDefinitions`
  - the relation registry, shown in the settings tab as **Relation registry**, one definition per line. `employee <-> employer` is a pair: a link labelled `employee` reads as `employer` from its target. `spouse <-> spouse` is a symmetric label. A lone `mentions` has no inverse, so it reads as itself from both ends, like every label the registry does not list. A line with `=` is a **composition rule**: `aunt = parent -> sibling` derives a note's `aunt` as its parent's sibling, and `|` separates alternative chains, as in `sibling-in-law = spouse -> sibling | sibling -> spouse`. Each step is a label as seen from the note the step starts at, inverse labels included, and a step may name another rule. Brackets after a step filter the notes it reaches by a property: `[divorceDate]` keeps the notes where it is set, `[!divorceDate]` the notes where it is empty or missing, `[status: retired]` the notes where it holds that value (ignoring case, any item of a list), and several brackets must all pass. `except` and a comma-separated list of labels at the end of a rule leave out the notes the starting note reaches by those labels, stored or derived: `stepParent = parent -> spouse except parent` does not list one's own other parent. A derived relation is never written into a note, never ends at the note it starts from, and is not shown when the note already stores the same label to the same note. A line with a single `<` declares a **sub-label**: `birthMother < mother` makes every `birthMother` link a kind of `mother` link. A query for `mother` still returns only `mother` links unless it asks for the wide meaning, through the API's `includeSubLabels` option or the **Include sub-labels** button of the relations pane. A sub-label may have sub-labels of its own and more than one superset. One with no pair of its own takes its superset's inverse, and when both have pairs the inverse is a sub-label too: with `birthMother <-> birthChild` and `mother <-> child`, `birthChild` is a kind of `child`. A rule's steps follow the narrow meaning unless the query asks for the wide one. A malformed line, a label, rule or sub-label defined a second time, a rule that reaches its own label (directly or through another rule), a rule longer than 8 links once its rules are expanded, and a sub-label line that makes a label a kind of itself are rejected with a message naming the line. A line with `@` declares **label variants**: `parent @ gender: female -> mother, male -> father` shows a `parent` relation as `mother` or `father` by the `gender` property of the note the label describes, Bob in `Bob is Alice's parent`. The value is compared ignoring case, a list property matches on any of its values, and with the property empty or unmatched the label shows as it is. Variants change only what is shown: queries and the API keep the stored label. The default is `parent <-> child`, `spouse <-> spouse` and `sibling <-> sibling`.
- `includedPresets`
  - the bundled presets included in the registry, shown in the settings tab as one toggle per preset, with its version and its lines. A preset's lines are read after the registry's, so a line of yours that defines the same label wins, and the settings tab strikes through each preset line yours overrides. The one preset bundled today is `family`. The default is none.

## The Family preset

The Family preset models kinship with nothing but the mechanisms above, so you can read it as an example as well as use it. It stores `parent` (legal parents, adoption included, of any gender) and its subset `birthParent`, and a partnership note that links both partners as `partner`, with `marriageDate` and `divorceDate` as plain properties. From those it derives spouse, ex-spouse, late spouse, step-parent and step-child, sibling, grandparent and grandchild, aunt or uncle, niece or nephew, cousin, and the in-laws. Each label shows as its gendered variant by the `gender` property: mother or father, wife or husband, sister or brother, and so on.

A spouse is a current, living partner: `spouse = partnership[!divorceDate] -> partner[!deathDate]`. A partnership with a `divorceDate` gives an `exSpouse` instead, and a partner with a `deathDate` a `lateSpouse`. A step-parent is a parent's spouse who is not one's own parent: `stepParent = parent -> spouse except parent`. Other relatives keep the deceased, since a grandparent who has died is still a grandparent.

```code-button
---
caption: Include the Family preset and open Lily
---
await require('/demoSetup.ts').includeFamilyPreset(app);
await require('/demoSetup.ts').openRelationsPane(app, 'Materials/02 Settings/Lily.md');
```

Manual equivalent: switch on **Family preset** in the settings tab, then open [Lily](<./Materials/02 Settings/Lily.md>) with the relations pane open.

Lily's parents Tom and Ann are listed under `father` and `mother`, and the **Derived** section has Rose under `grandmother`. Open [Ann](<./Materials/02 Settings/Ann.md>) and Tom is her `husband` through the partnership note [Tom and Ann](<./Materials/02 Settings/Tom and Ann.md>), with Rose as her `motherInLaw`. Use the reset button below to take the preset out again.

To write a preset of your own, put its lines in the registry. An org chart, for example:

```text
manager <-> report
colleague <-> colleague
colleague = manager -> report
```

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

Manual equivalent: delete the line you added, and switch off any preset you included.

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

## Try a sub-label

Carol names Alice as her `mentor`. Declare `mentor` a kind of `teacher`, then ask the API for Carol's teachers: the narrow query returns nothing, since no note writes `teacher`, and the wide one returns Alice.

```code-button
---
caption: Add "mentor < teacher" and ask for Carol's teachers
---
await require('/demoSetup.ts').addSubLabels(app);
require('/demoSetup.ts').showRelations(app, 'Materials/01 Relations/Carol.md', { label: 'teacher' });
require('/demoSetup.ts').showRelations(app, 'Materials/01 Relations/Carol.md', { includeSubLabels: true, label: 'teacher' });
```

Manual equivalent: add the line `mentor < teacher` to **Relation registry**, then open [Carol](<./Materials/01 Relations/Carol.md>) with the relations pane open and turn on its **Include sub-labels** button: Alice moves from the `mentor` group to a `teacher` group, tagged `mentor`.

Use the reset button above to take it out again.

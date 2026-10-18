# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Overview

`Labelled Links` labels the links between notes. A link from `A` to `B` is an arrow, and a backlink is the same arrow seen from `B`. This plugin gives that arrow a label (`A --employee--> B`) and shows the inverse label from the other end (`B --employer--> A`).

It is meant to sit **alongside** `Breadcrumbs`, the incumbent typed-links plugin, not replace it. Do not duplicate hierarchy navigation, transitive inference or diagrams. The gaps this plugin fills are the ones no existing plugin covers:

- the label shown on the link itself, in the editor and on hover;
- a typed query API with incoming queries, change events and published typings;
- one pane listing every relation of a note in both directions, with inverse labels, plus the plain links and backlinks;
- a simple registry where each label pair is declared once;
- every link-valued property read as a relation, with no setup.

## Current state

**The relation index and the registry are built; the pane, the badges and the API are not.** The repo was generated on 2026-10-17 with `create-obsidian-plugin` (preset `all-in-one`, CodeMirror editor extensions, CSS, desktop and mobile, the unofficial API subset). Its answers are in `.create-obsidian-plugin.json`, so re-running the generator in this folder updates every file not edited by hand. The generator's sample commands, settings, editor suggest and editor extensions are gone. Unit-test coverage is gated at 100%. The demo vault covers the relations and the registry only, until the full one is written.

- `src/relation-registry.ts` parses the `relationDefinitions` setting (`label <-> inverse`, `label <-> label`, a lone `label`) and answers inverse labels, ignoring case.
- `src/relation-extractor.ts` turns a note's cached metadata and text into its references, each with its label or `null`. The metadata cache does not record inline fields, so they are read from the text. Obsidian caches a property value holding several links (`"[[A]], [[B]]"`) as one link to `A]], [[B`, so such a key's cached entry is replaced by the links `parseFrontmatterLinks` finds in the value.
- `src/relation-index-component.ts` keeps every note's references, resolved, in an outgoing and an incoming map. A metadata `changed` event patches one note. A vault `create`, `rename` or `delete` only marks the resolution stale, and the next query re-resolves from memory, so a folder rename does not re-resolve once per file. Incoming labels come from the registry at query time, so a registry change re-indexes nothing. Plain links and backlinks come from the same index with a `null` label, rather than from `getBacklinksForFileOrPath`, so a relation and a plain link to the same note always agree on how the link resolved.

**No GitHub remote exists yet.** `mnaoumov/obsidian-labelled-links` has not been created, so nothing is pushed and nothing is released. The plugin id `labelled-links` was free in the community directory on 2026-10-17. An id can never change once it is published, so check it again right before the first submission.

## Design

This is the starting point the owner approved. Refine it as the build goes.

1. **Source of truth is plain syntax only.** Every link-valued property is a relation, with no setup: `employee: "[[B]]"`, and lists too. So is every `label:: [[B]]` inline field. There is no plugin-only syntax, so a vault stays readable without the plugin.
2. **A relation registry in settings.** It holds pairs (`employee` <-> `employer`, `child` <-> `parent`), symmetric labels (`spouse`, `sibling`) and labels with no inverse. Inverses are computed in memory and **never written into notes**.
3. **A relations pane.** For the active note it shows outgoing and incoming relations grouped by label, with each incoming relation listed under its inverse label. Plain links and backlinks go in an *unlabelled* group, with a context snippet.
4. **Editor and hover.** A small badge with the label sits on each labelled link, in Live Preview and in Reading view. A hover shows the relation and its inverse.
5. **API.** `getRelations(file, { label?, direction? })` plus change events, published through `@mnaoumov/obsidian-lib`'s plugin-API contract with typings, so other plugins and scripts can query relations.
6. **Index.** Build it on the metadata cache and backlinks, and update it incrementally rather than rebuilding it per query.
7. **Later.** Graph edge labels or colors, a Bases column, and an optional import of `Breadcrumbs` edge-field pairs.

## Conventions

- The name uses the British spelling **Labelled**, as the owner chose. Keep it in the id, the name, the repo and the prose.
- Gates: `npm run gate` runs format, spellcheck, markdown lint with link checks, build, lint, `find-overexposed` and unit-test coverage.

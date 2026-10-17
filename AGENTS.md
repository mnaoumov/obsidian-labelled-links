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

**Scaffolded, nothing built yet.** The repo was generated on 2026-10-17 with `create-obsidian-plugin` (preset `all-in-one`, CodeMirror editor extensions, CSS, desktop and mobile, the unofficial API subset). Its answers are in `.create-obsidian-plugin.json`, so re-running the generator in this folder updates every file not edited by hand. Everything under `src/` is still the generator's sample code, and the demo vault is still its sample vault. The coverage thresholds stay at 0 until real code replaces the samples.

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

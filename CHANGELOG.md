# CHANGELOG

## 1.2.0

- docs(readme): point bug reports at the Report a bug command
- feat: add a Report a bug command
- docs: add issue-filing instructions for AI agents
- chore(github): give the bug form the field ids bug-report links prefill
- build(deps): override re2js to ^2.9.1 for GHSA-gg6h-894w-4m9c
- build(deps): bump typescript-dev-toolkit to ^5.2.0 and apply prefer-dedent
- build(deps): bump obsidian-dev-toolkit to ^7.1.1 and typescript-dev-toolkit to ^5.1.0
- chore(deps): update fast-uri to 3.1.9
- chore: adopt readonly interface members
- test: drop obsolete text-component probe patches
- docs(readme): combine related resources and plugin comparisons
- refactor: group src into subject folders
- docs(readme): cut the README down to a landing page
- docs(readme): list similar plugins
- feat(registry): filter rule steps by property and exclude labels
- feat(registry): label variants, rule presets and a bundled Family preset
- feat(registry): declare sub-labels and query a label's wide meaning
- feat(registry): derive relations from composition rules
- test(demo-vault): floor `CodeScript Toolkit` at 15.0.0

## 1.1.0

- feat(relations): label a link without rendering the label, as `[[B]]%%:child%%`
- fix(relations-pane): show an incoming relation's original link as an arrow
- fix(relations-pane): say which end a label describes with a sentence
- fix(settings): render the registry examples as inline code
- docs(demo-vault): explain the bracketed inline-field forms and show a label with no inverse
- build(deps): move to obsidian-lib 6 and obsidian-dev-toolkit 5

## 1.0.0

- build(deps): take typescript-dev-toolkit 3.7.1 and restore the generated format script
- docs: add the desktop and mobile screenshots, captured from the demo vault
- build(deps): bump @mnaoumov/obsidian-dev-toolkit to ^3.6.0
- docs: demo-vault note for plugin developers and the README skeleton
- feat: typed relations API with change events and the plugin-API contract
- feat: link badges in Live Preview and Reading view
- feat: relations pane listing a note's relations, links and backlinks
- feat: relation index and inverse-label registry
- ci: pin Node 26 in .nvmrc
- fix(demo-vault): stop linking to the gitignored scratch note
- chore: scaffold `Labelled Links` with create-obsidian-plugin

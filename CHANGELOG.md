# CHANGELOG

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

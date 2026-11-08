# CHANGELOG

## 1.2.0

This release has 5 new features and 5 documentation changes. 9 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add a Report a bug command
- **registry:** filter rule steps by property and exclude labels
- **registry:** label variants, rule presets and a bundled Family preset
- **registry:** declare sub-labels and query a label's wide meaning
- **registry:** derive relations from composition rules

### Documentation

- **readme:** point bug reports at the Report a bug command
- add issue-filing instructions for AI agents
- **readme:** combine related resources and plugin comparisons
- **readme:** cut the README down to a landing page
- **readme:** list similar plugins

## 1.1.0

This release has 1 new feature, 3 fixes and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **relations:** label a link without rendering the label, as `[[B]]%%:child%%`

### Fixed

- **relations-pane:** show an incoming relation's original link as an arrow
- **relations-pane:** say which end a label describes with a sentence
- **settings:** render the registry examples as inline code

### Documentation

- **demo-vault:** explain the bracketed inline-field forms and show a label with no inverse

## 1.0.0

This release has 4 new features, 1 fix and 2 documentation changes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- typed relations API with change events and the plugin-API contract
- link badges in Live Preview and Reading view
- relations pane listing a note's relations, links and backlinks
- relation index and inverse-label registry

### Fixed

- **demo-vault:** stop linking to the gitignored scratch note

### Documentation

- add the desktop and mobile screenshots, captured from the demo vault
- demo-vault note for plugin developers and the README skeleton

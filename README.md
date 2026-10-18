# Labelled Links

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov) [![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-labelled-links)](https://github.com/mnaoumov/obsidian-labelled-links/releases) [![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-labelled-links/total)](https://github.com/mnaoumov/obsidian-labelled-links/releases) [![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-labelled-links)

A link in [Obsidian](https://obsidian.md/) says only that two notes are connected, never how. When `Alice` links to `Bob`, nothing tells you whether Bob is her child, her employer or a book she mentions, and from Bob's end the link is just another backlink. People write the answer down anyway, as `child: "[[Bob]]"` in the properties or `employer:: [[Acme]]` in the text, but the link itself never shows it.

`Labelled Links` reads that syntax as a **labelled relation** and shows the label where you meet the link: as a badge on the link, in a pane listing every relation of a note in both directions, and from the other end under its **inverse** label, so Alice's `child` link reads as `parent` on Bob. You declare each label pair once, in the settings, and nothing is ever written into your notes, so a vault stays readable without the plugin. Other plugins and scripts can query the same relations through a typed API.

It is meant to sit alongside [`Breadcrumbs`](https://community.obsidian.md/plugins/breadcrumbs), not replace it: Breadcrumbs builds hierarchies and their navigation, and this plugin labels the individual links.

## Demo vault

**The documentation is an interactive demo vault.** Its notes explain how a link becomes a relation and how each end reads it, with buttons that open the relations pane, show the badges, change the registry and query the API.

**[Start reading here](<./demo-vault/00 Start.md>)** — it is plain markdown, so it works on GitHub with nothing installed.

A copy of the vault ships with every release. You can access it via any of the following:

1. Running the **`Labelled Links`: Open demo vault** command.
2. Downloading `labelled-links-demo-vault.zip` from the [Releases](https://github.com/mnaoumov/obsidian-labelled-links/releases). It unzips into a single `labelled-links-demo-vault-<version>` folder.
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## What it does

- **Every link-valued property, and every link in an inline field, is a relation**, labelled with the property or field name, with no setup. [01 Relations](<./demo-vault/01 Relations.md>)
- **A relation registry** declares each label pair once: `parent <-> child`, a symmetric `spouse <-> spouse`, or a lone label with no inverse. The inverse is worked out in memory and never written into a note. [02 Settings](<./demo-vault/02 Settings.md>)
- **The relations pane** lists every relation of the active note, outgoing and incoming, grouped by label, with each incoming relation under its inverse label, plus the plain links and backlinks with the line each one sits on. [03 Relations pane](<./demo-vault/03 Relations pane.md>)
- **A badge on each labelled link** shows its label in Live Preview and in Reading view, with a tooltip naming the relation in both directions. [04 Link badges](<./demo-vault/04 Link badges.md>)
- **A typed API and a change event** let other plugins and scripts query a note's relations and hear when they change. [05 For plugin developers](<./demo-vault/05 For plugin developers.md>)

## For plugin developers

`Labelled Links` publishes an API for querying a note's relations, and an event saying when they may have changed, for other plugins and scripts. Both are declared in [`api.d.ts`](./api.d.ts), which is hand-written and imports nothing but `obsidian`, so you can depend on it without depending on anything of mine.

The event needs no API handle at all. Copy the declarations from `api.d.ts` into your own project, or hardcode the name, and subscribe:

```ts
this.registerEvent(
  this.app.workspace.on('labelled-links:relations-changed', ({ paths }) => {
    // `paths` names the notes whose relations may have changed, or is `null` when any note's may have.
    console.log(paths);
  })
);
```

For the relations themselves, take the API through the registry. The contract is **`1.0.0`** and moves independently of the plugin's own version, so ask for a range.

Beside `api.d.ts`, [`api-contract.ts`](./api-contract.ts) holds the API's contract, `LABELLED_LINKS_API_CONTRACT`: for every method, a schema over its arguments and a schema over what it returns. It is the constant this plugin publishes with the API, so copy it next to `api.d.ts` and pass it as the `contract`, and both sides check the same definition. Besides `./api.d.ts` and `obsidian` it imports from one package, [`@mnaoumov/typescript-lib`](https://www.npmjs.com/package/@mnaoumov/typescript-lib), whose `api-contract` entry point carries the contract type, the [Standard Schema](https://standardschema.dev) builders and the common guards, so add that package to your project when you copy the file. (It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.)

```ts
import { watchPluginApi } from '@mnaoumov/obsidian-lib/plugin/plugin-api';

import type { LabelledLinksApi } from './api.d.ts';

import { LABELLED_LINKS_API_CONTRACT } from './api-contract.ts';

const labelledLinksApiRef = watchPluginApi<LabelledLinksApi>({
  apiVersionRange: '^1.0.0',
  app: this.app,
  component: this,
  contract: LABELLED_LINKS_API_CONTRACT,
  pluginId: 'labelled-links'
});

// `value` is `null` while `Labelled Links` is not loaded, and becomes non-`null` on its own when it is.
const labelledLinksApi = labelledLinksApiRef.value;
if (labelledLinksApi) {
  console.log(labelledLinksApi.getRelations('People/Alice.md', { direction: 'outgoing', label: 'child' }));
  console.log(labelledLinksApi.getInverseLabel('child'));
}
```

A one-off lookup with no component to own a watch uses `findPluginApi` from the same module, with the same `apiVersionRange`, `contract` and `pluginId`. The index fills once the workspace layout is ready, so a query before that answers with no relations, and the event with `paths: null` says when it is filled. The [Cross-plugin APIs](https://mnaoumov.dev/obsidian-lib/guides/cross-plugin-apis/) guide covers the registry from the inside.

If you would rather not depend on [`@mnaoumov/obsidian-lib`](https://www.npmjs.com/package/@mnaoumov/obsidian-lib) for that, the registry is a documented wire protocol you can read with nothing but `obsidian` — see [Plugin API protocol](https://mnaoumov.dev/obsidian-lib/guides/plugin-api-protocol/).

## Installation

The plugin is not yet listed in [the official Community Plugins repository](https://community.obsidian.md/plugins). Until it is, install it as a beta release.

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://community.obsidian.md) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://community.obsidian.md/plugins/obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-labelled-links).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command in the `DevTools Console`:

```js
window.DEBUG.enable('labelled-links');
```

For more details, refer to the [documentation](https://mnaoumov.dev/obsidian-lib/guides/debugging/).

## Contributing

Contributions are welcome — see [CONTRIBUTING](./CONTRIBUTING.md) to get set up.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)

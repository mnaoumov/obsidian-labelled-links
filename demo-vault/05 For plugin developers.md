# For plugin developers

Everything the relations pane shows is also available to other plugins and scripts. `Labelled Links` publishes a small API through the `@mnaoumov/obsidian-lib` plugin registry, answering what a note's relations are right now, and an event on `app.workspace` saying when that answer may have changed.

Everything a consumer needs is declared in the plugin's repo-root `api.d.ts`, which imports nothing but `obsidian`. Copy it, or copy the few lines you use, and you depend on this plugin without depending on anything else of its author's. The buttons below run exactly the calls a consumer makes, with a copy of those declarations in this vault's `demoSetup.ts`.

## Query a note's relations

`labelledLinksApi.getRelations` hands back every relation of a note, outgoing first, as a fresh array of plain objects. Each one says its `direction`, its `label` as seen from the queried note, the `linkLabel` written in the source, and the `sourcePath` and `targetPath`.

```code-button
---
caption: Get Alice's relations
---
require('/demoSetup.ts').showRelations(app, 'Materials/01 Relations/Alice.md');
```

Manual equivalent: open [Alice](<./Materials/01 Relations/Alice.md>) with the relations pane open, as on [03 Relations pane](<./03 Relations pane.md>).

The notice lists her `child` relation to Bob and her `spouse` relation to Dan. Pass `direction` and `label` to filter, ignoring case. Bob's incoming relations carry the inverse label, so Alice's `child` link comes back as `parent`:

```code-button
---
caption: Get Bob's incoming relations
---
require('/demoSetup.ts').showRelations(app, 'Materials/01 Relations/Bob.md', { direction: 'incoming' });
```

Manual equivalent: open [Bob](<./Materials/01 Relations/Bob.md>) and read the **Incoming** section of the pane.

`label: null` keeps only the plain links and backlinks, which the API returns alongside the labelled relations, from the same index:

```code-button
---
caption: Get Bob's plain links and backlinks
---
require('/demoSetup.ts').showRelations(app, 'Materials/01 Relations/Bob.md', { label: null });
```

Manual equivalent: read the **Unlabelled** section of the pane on Bob.

## Ask for an inverse label

`labelledLinksApi.getInverseLabel` answers from the registry in [02 Settings](<./02 Settings.md>), ignoring case. It returns the label itself for a symmetric one, and `null` for a label the registry has no inverse for.

```code-button
---
caption: Get the inverse of "child"
---
require('/demoSetup.ts').showInverseLabel(app, 'child');
```

Manual equivalent: find the line `parent <-> child` in **Relation registry**.

```code-button
---
caption: Get the inverse of "mentor"
---
require('/demoSetup.ts').showInverseLabel(app, 'mentor');
```

Manual equivalent: look for `mentor` in **Relation registry**. It is not there, so the answer is `null`. `getRelations` still labels the incoming relation, with the written label itself: Alice's incoming relation from [Carol](<./Materials/01 Relations/Carol.md>) comes back as `mentor`.

```code-button
---
caption: Get Alice's incoming relations
---
require('/demoSetup.ts').showRelations(app, 'Materials/01 Relations/Alice.md', { direction: 'incoming' });
```

Manual equivalent: open [Alice](<./Materials/01 Relations/Alice.md>) and read the **Incoming** section of the pane.

## Listen for changes

The `labelled-links:relations-changed` event fires on `app.workspace` after the index has changed, so `getRelations` already reflects it by the time your callback runs. Its payload names the notes whose relations may have changed, or carries `paths: null` when any note's may have: after the index is filled or rebuilt, after a file is created, renamed or deleted, and after the registry changes.

```code-button
---
caption: Start listening for relation changes
---
require('/demoSetup.ts').startListeningToRelationsChanged(app);
```

Manual equivalent: the same `app.workspace.on(...)` call from your own plugin's `onload`.

Now edit [Alice](<./Materials/01 Relations/Alice.md>), say by changing `spouse::` to `sibling::`, and a notice names her note and the notes she links to, whose incoming relations changed with it. Or rebuild the index, and the notice says any note may have changed:

```code-button
---
caption: Rebuild the relation index
---
require('/demoSetup.ts').rebuildRelationIndex(app);
```

Manual equivalent: run **`Labelled Links`: Rebuild relation index** from the Command Palette.

When you are done, stop listening, and put Alice's line back if you changed it:

```code-button
---
caption: Stop listening for relation changes
---
require('/demoSetup.ts').stopListeningToRelationsChanged();
```

Manual equivalent: unloading the component that registered the event, which a plugin gets for free when it is disabled.

## Reaching the API from a plugin

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
```

`labelledLinksApiRef.value` is `null` while `Labelled Links` is not loaded, and becomes non-`null` on its own when it is, so a consumer never has to care about plugin load order. A one-off lookup with no component to own a watch, like the buttons above, uses `findPluginApi` with the same `apiVersionRange` and `pluginId`. The contract version is **`1.0.0`** and moves independently of the plugin's own version, which is why the range asks for `^1.0.0` rather than naming one.

Subscribing to the event needs no API handle at all:

```ts
this.registerEvent(
  this.app.workspace.on('labelled-links:relations-changed', ({ paths }) => {
    console.log(paths === null ? 'Any note may have changed' : `Changed: ${paths.join(', ')}`);
  })
);
```

The event name and the payload are a wire contract: they will not change meaning, and the payload and the relation objects only ever gain members.

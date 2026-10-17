# Settings

Every setting Labelled Links stores, listed by the **key it is written under in `data.json`** rather than by its display label — that is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → Labelled Links**.

## General

- `textSetting`
  - free text, shown in the settings tab as **Text setting name**. The scaffolded sample setting; nothing reads it yet.

## Try it

Change the setting without leaving this note. The change applies live — the plugin's settings component picks it up, so there is no reload.

```code-button
---
caption: Set textSetting to "changed by the demo"
---
await require('/demoSetup.ts').setTextSetting(app, 'changed by the demo');
```

Manual equivalent: type the same value into **Text setting name** in the settings tab.

Open the settings tab now and the field shows the new value. When you are done, put it back:

```code-button
---
caption: Reset textSetting to its default
---
await require('/demoSetup.ts').resetTextSetting(app);
```

Manual equivalent: type `defaultText` back into the field.

## Adding your own

Settings are declared as plain properties on the `PluginSettings` class in `src/plugin-settings.ts`; the property's initial value **is** its default. `src/plugin-settings-tab.ts` renders one row per setting, and `src/plugin-settings-component.ts` is where migrations and validators go.

When you add one, add it to this note too. The demo-vault coverage suite can be told to fail the build when a setting is documented nowhere — see the commented reflection spec in `src/demo-vault.no-app.integration.test.ts`.

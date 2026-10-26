import type {
  App,
  TFile
} from 'obsidian';

import {
  configureCommunityPlugin,
  installConfigureEnableCommunityPlugin
} from '@mnaoumov/obsidian-lib/community-plugins';
import { findPluginApi } from '@mnaoumov/obsidian-lib/plugin/plugin-api';
import {
  Component,
  Notice
} from 'obsidian';

/**
 * A copy of the declarations from the plugin's repo-root `api.d.ts`, cut down to what these buttons read.
 *
 * Copied rather than imported, and that is part of the lesson: this script runs inside the vault, where the
 * repo is not resolvable, and a consumer plugin is in the same position. Copying the declarations is the
 * supported route, which is why that file imports nothing but `obsidian`.
 */
interface LabelledLinksApi {
  getDerivedRelations: (pathOrFile: string | TFile, options?: LabelledLinksGetDerivedRelationsOptions) => LabelledLinksDerivedRelation[];
  getInverseLabel: (label: string) => null | string;
  getRelations: (pathOrFile: string | TFile, options?: LabelledLinksGetRelationsOptions) => LabelledLinksRelation[];
}

interface LabelledLinksDerivedRelation {
  readonly label: string;
  readonly sourcePath: string;
  readonly steps: readonly LabelledLinksRelation[];
  readonly targetPath: string;
}

interface LabelledLinksGetDerivedRelationsOptions {
  readonly label?: string;
}

interface LabelledLinksGetRelationsOptions {
  readonly direction?: 'incoming' | 'outgoing';
  readonly label?: null | string;
}

interface LabelledLinksRelation {
  readonly direction: 'incoming' | 'outgoing';
  readonly label: null | string;
  readonly linkLabel: null | string;
  readonly sourcePath: string;
  readonly targetPath: string;
}

interface RelationsChangedEventPayload {
  readonly paths: null | readonly string[];
}

// Shared code for every `code-button` in this vault, so each note's button stays a one-liner instead of a
// Block copy-pasted across notes.
//
// The plugin id has to match `manifest.json` exactly: commands are keyed by it, and so is `data.json`.
const PLUGIN_ID = 'labelled-links';
const DATACORE_PLUGIN_ID = 'datacore';
const DATAVIEW_PLUGIN_ID = 'dataview';

const DEFAULT_RELATION_DEFINITIONS = ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling'];
const COMPOSITION_RULES = ['aunt = parent -> sibling', 'sibling-in-law = spouse -> sibling | sibling -> spouse'];
const NOTICE_DURATION_IN_MILLISECONDS = 10000;
const RELATIONS_CHANGED_EVENT_NAME = 'labelled-links:relations-changed';

// The subscription the listen button creates, kept here so the stop button can find it again. A real plugin
// Registers the event on its own component and never needs a module-level handle.
let relationsChangedListeningComponent: Component | null = null;

/**
 * Asks the API for the inverse of a label, as the registry in the settings defines it.
 *
 * Manual equivalent: read **Relation registry** in **Settings -> Community plugins -> Labelled Links**.
 */
export function showInverseLabel(app: App, label: string): void {
  const labelledLinksApi = getApi(app);
  if (!labelledLinksApi) {
    return;
  }
  const inverseLabel = labelledLinksApi.getInverseLabel(label);
  new Notice(
    inverseLabel === null
      ? `getInverseLabel('${label}') returned null: the registry has no inverse for it.`
      : `getInverseLabel('${label}') returned '${inverseLabel}'.`,
    NOTICE_DURATION_IN_MILLISECONDS
  );
}

/**
 * Asks the API for a note's relations and shows one line per relation, the way the relations pane reads it.
 *
 * Manual equivalent: open the note and the relations pane, as on **03 Relations pane**.
 */
export function showRelations(app: App, notePath: string, options?: LabelledLinksGetRelationsOptions): void {
  const labelledLinksApi = getApi(app);
  if (!labelledLinksApi) {
    return;
  }
  const relations = labelledLinksApi.getRelations(notePath, options);
  const lines = relations.map((relation) => {
    const label = relation.label ?? '(plain link)';
    return relation.direction === 'outgoing'
      ? `outgoing ${label} -> ${getBaseName(relation.targetPath)}`
      : `incoming ${label} <- ${getBaseName(relation.sourcePath)}`;
  });
  new Notice(
    `getRelations('${getBaseName(notePath)}'${options ? `, ${JSON.stringify(options)}` : ''}) returned ${String(relations.length)}:\n${lines.join('\n')}`,
    NOTICE_DURATION_IN_MILLISECONDS
  );
}

/**
 * Asks the API for the relations the registry's composition rules derive for a note, and shows one line per
 * relation with the chain that produced it.
 *
 * Manual equivalent: open the note and read the **Derived** section of the relations pane, as on
 * **03 Relations pane**.
 */
export function showDerivedRelations(app: App, notePath: string, options?: LabelledLinksGetDerivedRelationsOptions): void {
  const labelledLinksApi = getApi(app);
  if (!labelledLinksApi) {
    return;
  }
  const relations = labelledLinksApi.getDerivedRelations(notePath, options);
  const lines = relations.map((relation) => {
    const chain = relation.steps.map((step) => step.label).join(' -> ');
    return `${relation.label} -> ${getBaseName(relation.targetPath)} (through ${chain})`;
  });
  new Notice(
    `getDerivedRelations('${getBaseName(notePath)}'${options ? `, ${JSON.stringify(options)}` : ''}) returned ${String(relations.length)}:\n${lines.join('\n')}`,
    NOTICE_DURATION_IN_MILLISECONDS
  );
}

/**
 * Subscribes to the `labelled-links:relations-changed` event and shows a notice each time it fires, until the
 * stop button below.
 *
 * Manual equivalent: the same `app.workspace.on(...)` call from your own plugin's `onload`.
 */
export function startListeningToRelationsChanged(app: App): void {
  if (relationsChangedListeningComponent) {
    new Notice('Already listening. Edit a note, or rebuild the relation index.');
    return;
  }

  const component = new Component();
  component.registerEvent(
    app.workspace.on(RELATIONS_CHANGED_EVENT_NAME, (payload: RelationsChangedEventPayload) => {
      new Notice(
        payload.paths === null
          ? 'Relations changed: any note may have changed.'
          : `Relations changed: ${payload.paths.map(getBaseName).join(', ')}`
      );
    })
  );
  component.load();
  relationsChangedListeningComponent = component;

  new Notice('Listening. Now edit a note, or rebuild the relation index.');
}

/**
 * Drops the subscription the listen button made.
 *
 * Manual equivalent: unloading the component that registered it, which a plugin gets for free when it is
 * disabled.
 */
export function stopListeningToRelationsChanged(): void {
  if (!relationsChangedListeningComponent) {
    new Notice('Not listening.');
    return;
  }

  relationsChangedListeningComponent.unload();
  relationsChangedListeningComponent = null;
  new Notice('Stopped listening.');
}

/**
 * Installs and enables `Datacore`, which also reads the inline fields on **01 Relations**.
 *
 * The demo vault ships only the plugin under test and the helper, so `Datacore` is installed through Obsidian's
 * own store path rather than committed to the vault.
 *
 * Manual equivalent: install and enable `Datacore` from **Settings -> Community plugins -> Browse**.
 */
export async function installDatacore(app: App): Promise<void> {
  await installCompanionPlugin(app, DATACORE_PLUGIN_ID, 'Datacore');
}

/**
 * Installs and enables `Dataview`, the plugin the inline-field syntax on **01 Relations** comes from.
 *
 * The demo vault ships only the plugin under test and the helper, so `Dataview` is installed through Obsidian's
 * own store path rather than committed to the vault.
 *
 * Manual equivalent: install and enable `Dataview` from **Settings -> Community plugins -> Browse**.
 */
export async function installDataview(app: App): Promise<void> {
  await installCompanionPlugin(app, DATAVIEW_PLUGIN_ID, 'Dataview');
}

/**
 * Runs the plugin's `Rebuild relation index` command, which reads every note again and shows how many
 * relations it found.
 *
 * Manual equivalent: `Labelled Links: Rebuild relation index` in the Command Palette.
 */
export function rebuildRelationIndex(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:rebuild-relation-index`);
}

/**
 * Opens a note and then the plugin's relations pane beside it, so the pane shows that note's relations.
 *
 * Manual equivalent: open the note, then run `Labelled Links: Open relations pane` in the Command Palette.
 */
export async function openRelationsPane(app: App, notePath: string): Promise<void> {
  const file = app.vault.getFileByPath(notePath);
  if (!file) {
    new Notice(`${notePath} is missing from this vault.`);
    return;
  }
  await app.workspace.getLeaf(false).openFile(file);
  app.commands.executeCommandById(`${PLUGIN_ID}:open-relations-pane`);
}

/**
 * Opens a note in Reading view or in Live Preview, where the plugin puts a badge with the label after each
 * labelled link.
 *
 * Manual equivalent: open the note, then pick **Reading view** or **Live Preview** from the `...` menu in the
 * note's header (or press `Ctrl+E` / `Cmd+E` to switch between reading and editing).
 */
export async function openNoteIn(app: App, notePath: string, mode: 'live-preview' | 'reading'): Promise<void> {
  const file = app.vault.getFileByPath(notePath);
  if (!file) {
    new Notice(`${notePath} is missing from this vault.`);
    return;
  }
  const state = mode === 'reading' ? { mode: 'preview' } : { mode: 'source', source: false };
  await app.workspace.getLeaf(false).openFile(file, { state });
}

/**
 * Sets the plugin's relation registry to the given definitions.
 *
 * `configureCommunityPlugin` routes through the plugin's own settings component while it is loaded, so the
 * change applies live -- no window reload, and no writing `data.json` behind a running plugin's back, which
 * it would overwrite from memory as it unloads.
 *
 * Manual equivalent: edit **Relation registry** in **Settings -> Community plugins -> Labelled Links**.
 */
export async function setRelationDefinitions(app: App, relationDefinitions: string[]): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: { relationDefinitions } });
  new Notice(`The relation registry now has ${String(relationDefinitions.length)} definition(s). It is live -- no reload needed.`);
}

/**
 * Puts the relation registry back to the definitions a fresh install starts with, so exploring the settings
 * note leaves the vault as you found it.
 *
 * Manual equivalent: restore the default lines in the same field in the settings tab.
 */
export async function resetRelationDefinitions(app: App): Promise<void> {
  await setRelationDefinitions(app, DEFAULT_RELATION_DEFINITIONS);
}

/**
 * Adds two composition rules to the default registry: `aunt` (a parent's sibling) and `sibling-in-law` (a
 * spouse's sibling, or a sibling's spouse).
 *
 * Manual equivalent: add the lines `aunt = parent -> sibling` and
 * `sibling-in-law = spouse -> sibling | sibling -> spouse` to **Relation registry** in the settings tab.
 */
export async function addCompositionRules(app: App): Promise<void> {
  await setRelationDefinitions(app, [...DEFAULT_RELATION_DEFINITIONS, ...COMPOSITION_RULES]);
}

function getApi(app: App): LabelledLinksApi | null {
  const labelledLinksApi = findPluginApi<LabelledLinksApi>({
    apiVersionRange: '^1.1.0',
    pluginId: PLUGIN_ID
  });
  if (!labelledLinksApi) {
    new Notice('The Labelled Links API is not available. Is the plugin enabled?');
  }
  return labelledLinksApi;
}

async function installCompanionPlugin(app: App, pluginId: string, pluginName: string): Promise<void> {
  new Notice(createFragment((f) => {
    f.appendText('Installing ');
    f.createEl('code', { text: pluginName });
    f.appendText('...');
  }));
  await installConfigureEnableCommunityPlugin({ app, pluginId });
  new Notice(createFragment((f) => {
    f.createEl('code', { text: pluginName });
    f.appendText(' is installed and enabled.');
  }));
}

function getBaseName(path: string): string {
  return path.split('/').pop()?.replace(/\.md$/, '') ?? path;
}

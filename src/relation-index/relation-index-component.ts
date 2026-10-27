import type { PathOrFile } from '@mnaoumov/obsidian-lib/file-system';
import type { AsyncEventRef } from '@mnaoumov/typescript-lib/async-events';
import type {
  App,
  CachedMetadata,
  Reference,
  TAbstractFile,
  TFile
} from 'obsidian';

import { LayoutReadyComponent } from '@mnaoumov/obsidian-lib/components/layout-ready-component';
import {
  getPath,
  isMarkdownFile
} from '@mnaoumov/obsidian-lib/file-system';
import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { getLinkpath } from 'obsidian';

import type { PropertyFilter } from '../relation-registry/relation-registry.ts';
import type {
  ExtractedReference,
  LabelForm
} from './relation-extractor.ts';

import {
  doesPassPropertyFilters,
  normalizeLabel,
  RelationRegistry
} from '../relation-registry/relation-registry.ts';
import { extractReferences } from './relation-extractor.ts';

/**
 * Which end of a relation the queried note is.
 */
export enum RelationDirection {
  /**
   * The relation points at the queried note: it is written in another note.
   */
  Incoming = 'incoming',

  /**
   * The relation is written in the queried note and points away from it.
   */
  Outgoing = 'outgoing'
}

/**
 * A relation a composition rule derives: `Carol is Erin's aunt` from `aunt = parent -> sibling`, through Erin's
 * parent Dan and Dan's sibling Carol. It is never written in a note.
 */
export interface DerivedRelation {
  /**
   * Whether {@link DerivedRelation.targetPath} is an existing file.
   */
  readonly isTargetResolved: boolean;

  /**
   * The derived label, as its rule writes it.
   */
  readonly label: string;

  /**
   * The path of the queried note, which the label describes the target from.
   */
  readonly sourcePath: string;

  /**
   * The stored relations the chain went through, in order. Each is seen from the note its step starts at, so the
   * first one is seen from {@link DerivedRelation.sourcePath} and the last one reaches
   * {@link DerivedRelation.targetPath}.
   */
  readonly steps: readonly Relation[];

  /**
   * The path of the note the chain ends at.
   */
  readonly targetPath: string;
}

/**
 * A link between two notes, seen from one of them.
 */
export interface Relation {
  /**
   * Whether the queried note is the source or the target.
   */
  readonly direction: RelationDirection;

  /**
   * Whether {@link Relation.targetPath} is an existing file. An unresolved link targets the path it names.
   */
  readonly isTargetResolved: boolean;

  /**
   * The label as seen from the queried note. An outgoing relation carries the label written in the source; an
   * incoming one carries the registry's inverse of that label, or the written label itself when the registry
   * has no inverse for it. `null` for a plain link or backlink.
   */
  readonly label: null | string;

  /**
   * How {@link Relation.linkLabel} is written in the source note, or `null` for a plain link.
   */
  readonly labelForm: LabelForm | null;

  /**
   * The label as written in the source note, or `null` for a plain link.
   */
  readonly linkLabel: null | string;

  /**
   * The cached reference in the source note.
   */
  readonly reference: Reference;

  /**
   * The path of the note the relation is written in.
   */
  readonly sourcePath: string;

  /**
   * The path of the note the relation points at, or the link path itself when it resolves to no file.
   */
  readonly targetPath: string;
}

/**
 * Options for {@link RelationIndexComponent.getDerivedRelations}.
 */
export interface RelationIndexComponentGetDerivedRelationsOptions {
  /**
   * Whether to take every label in the query in its wide meaning: the `label` filter also matches the
   * rules whose labels are kinds of it, and each step of a chain also follows the stored relations whose labels
   * are kinds of the step's label. `false` when omitted.
   */
  readonly includeSubLabels?: boolean;

  /**
   * Only the relations this rule label derives, compared ignoring case. All when omitted.
   */
  readonly label?: string;
}

/**
 * Options for {@link RelationIndexComponent.getRelations}.
 */
export interface RelationIndexComponentGetRelationsOptions {
  /**
   * Only the relations in this direction. Both when omitted.
   */
  readonly direction?: RelationDirection;

  /**
   * Whether the `label` filter also matches the labels the registry declares as kinds of it, so `mother`
   * also matches `birthMother` after `birthMother < mother`. `false` when omitted.
   */
  readonly includeSubLabels?: boolean;

  /**
   * Only the relations with this label as seen from the queried note, compared ignoring case; `null` for the
   * plain links and backlinks only. All when omitted.
   */
  readonly label?: null | string;
}

/**
 * The counts {@link RelationIndexComponent.getStats} returns.
 */
export interface RelationIndexStats {
  /**
   * How many notes are indexed.
   */
  readonly noteCount: number;

  /**
   * How many labelled references those notes hold.
   */
  readonly relationCount: number;
}

/**
 * A note a walk along a chain has reached, and the stored relations that reached it.
 */
interface ChainEnd {
  readonly isResolved: boolean;
  readonly path: string;
  readonly steps: readonly Relation[];
}

/**
 * A reference of a note resolved to its target.
 */
interface IndexedReference extends ExtractedReference {
  readonly isTargetResolved: boolean;
  readonly sourcePath: string;
  readonly targetPath: string;
}

/**
 * Params for {@link RelationIndexComponent.setReferences}.
 */
interface RelationIndexComponentSetReferencesParams {
  readonly content: string;
  readonly metadata: CachedMetadata;
  readonly sourcePath: string;
}

/**
 * The events {@link RelationIndexComponent.on} subscribes to.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- An event map has to be a type alias to satisfy the index-signature constraint.
type RelationIndexEventMap = {
  changed: [paths: null | readonly string[]];
};

/**
 * The relation index: every note's outgoing and incoming relations, plain links and backlinks included.
 *
 * It reads relations from plain syntax only (link-valued properties and inline fields) and keeps the
 * inverse labels out of the notes: an incoming relation is labelled from the {@link RelationRegistry} at
 * query time, so a registry change needs no re-indexing.
 *
 * The index is updated incrementally. A metadata-cache `changed` event re-extracts that one note and patches
 * both directions. Creating, renaming or deleting a file can change what OTHER notes' links resolve to, so
 * those only mark the resolution stale, and the next query re-resolves every reference from memory, without
 * reading any file.
 */
export class RelationIndexComponent extends LayoutReadyComponent {
  private readonly events = new AsyncEvents<RelationIndexEventMap>();
  private readonly incoming = new Map<string, Set<IndexedReference>>();
  private isResolutionStale = false;
  private readonly outgoing = new Map<string, IndexedReference[]>();
  private pathsChangedDuringIndexing: null | Set<string> = null;
  private registry = new RelationRegistry([]);
  private readonly sources = new Map<string, ExtractedReference[]>();

  /**
   * Creates the index. It fills itself once the workspace layout is ready.
   *
   * @param app - The Obsidian app.
   */
  public constructor(app: App) {
    super(app);
  }

  /**
   * Gets the relations the registry's composition rules derive for a note, walking each rule's chains over the
   * index at query time.
   *
   * A derived relation never ends at the queried note, and is left out when the note already has a stored
   * relation with the same label to the same note, so it shows once, as stored. Two chains reaching the same
   * note give one relation, by the first chain.
   *
   * A step follows a rule by its exact label only, even in the wide meaning, because a rule may name a superset of
   * its own label, and widening rules there would walk forever.
   *
   * @param pathOrFile - The note.
   * @param options - Filters by rule label, and the wide meaning.
   * @returns The derived relations, in rule order.
   */
  public getDerivedRelations(pathOrFile: PathOrFile, options: RelationIndexComponentGetDerivedRelationsOptions = {}): DerivedRelation[] {
    this.ensureResolved();
    const sourcePath = getPath(this.app, pathOrFile);
    const shouldIncludeSubLabels = options.includeSubLabels ?? false;
    const { label } = options;
    const rules = this.registry.getRules().filter((rule) => label === undefined || (shouldIncludeSubLabels ? this.registry.isLabelOrSubLabel(rule.label, label) : normalizeLabel(rule.label) === normalizeLabel(label)));
    const derivedRelations: DerivedRelation[] = [];

    for (const rule of rules) {
      const storedPaths = new Set(this.followStoredLabel(sourcePath, rule.label, shouldIncludeSubLabels).map((end) => end.path));
      for (const end of this.followRule(sourcePath, rule.label, shouldIncludeSubLabels)) {
        if (!storedPaths.has(end.path)) {
          derivedRelations.push({
            isTargetResolved: end.isResolved,
            label: rule.label,
            sourcePath,
            steps: end.steps,
            targetPath: end.path
          });
        }
      }
    }

    return derivedRelations;
  }

  /**
   * Gets the label a relation carries when it is seen from its target, from the current registry.
   *
   * @param label - The label written in the source note.
   * @returns The inverse label, or `null` when the registry has none for it.
   */
  public getInverseLabel(label: string): null | string {
    return this.registry.getInverseLabel(label);
  }

  /**
   * Gets the relations of a note.
   *
   * @param pathOrFile - The note, or the path an unresolved link names.
   * @param options - Filters by direction and label, and whether the label takes its wide meaning.
   * @returns The relations, outgoing first.
   */
  public getRelations(pathOrFile: PathOrFile, options: RelationIndexComponentGetRelationsOptions = {}): Relation[] {
    this.ensureResolved();
    const path = getPath(this.app, pathOrFile);
    const relations: Relation[] = [];

    if (options.direction !== RelationDirection.Incoming) {
      for (const reference of this.outgoing.get(path) ?? []) {
        relations.push(this.toRelation(reference, RelationDirection.Outgoing));
      }
    }

    if (options.direction !== RelationDirection.Outgoing) {
      for (const reference of this.incoming.get(path) ?? []) {
        relations.push(this.toRelation(reference, RelationDirection.Incoming));
      }
    }

    if (options.label === undefined) {
      return relations;
    }

    if (options.label === null) {
      return relations.filter((relation) => relation.label === null);
    }

    const { label } = options;
    return relations.filter((relation) =>
      relation.label !== null
      && (options.includeSubLabels ? this.registry.isLabelOrSubLabel(relation.label, label) : normalizeLabel(relation.label) === normalizeLabel(label))
    );
  }

  /**
   * Gets the widest labels a label is a kind of, from the current registry.
   *
   * @param label - The label.
   * @returns The top superset labels, or the label itself when it has none.
   */
  public getRootLabels(label: string): string[] {
    return this.registry.getRootLabels(label);
  }

  /**
   * Gets the label to show for a relation, from the current registry: the variant the described note's property
   * picks, or the label itself.
   *
   * @param label - The label.
   * @param describedPath - The path of the note the label describes, `Bob` in `Bob is Alice's parent`.
   * @returns The label to show.
   */
  public getShownLabel(label: string, describedPath: string): string {
    if (this.registry.getLabelVariants(label) === null) {
      return label;
    }

    const file = this.app.vault.getFileByPath(describedPath);
    return this.registry.getShownLabel(label, file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null);
  }

  /**
   * Gets how many notes and how many labelled references the index holds.
   *
   * @returns The counts.
   */
  public getStats(): RelationIndexStats {
    let relationCount = 0;
    for (const references of this.sources.values()) {
      relationCount += references.filter((reference) => reference.label !== null).length;
    }
    return { noteCount: this.sources.size, relationCount };
  }

  /**
   * Unsubscribes a handler registered with {@link RelationIndexComponent.on}.
   *
   * @param eventRef - The reference {@link RelationIndexComponent.on} returned.
   */
  public offref(eventRef: AsyncEventRef): void {
    this.events.offref(eventRef);
  }

  /**
   * Subscribes to changes of the index.
   *
   * @param name - The event name.
   * @param callback - Called with the paths of the notes whose relations may have changed, or `null` when any
   * note's may have.
   * @returns The reference to pass to {@link RelationIndexComponent.offref}.
   */
  public on(name: 'changed', callback: (paths: null | readonly string[]) => void): AsyncEventRef {
    return this.events.on(name, callback);
  }

  public override onload(): void {
    super.onload();
    this.registerEvent(this.app.metadataCache.on('changed', this.handleMetadataChanged.bind(this)));
    this.registerEvent(this.app.vault.on('create', this.markResolutionStale.bind(this)));
    this.registerEvent(this.app.vault.on('delete', this.handleDelete.bind(this)));
    this.registerEvent(this.app.vault.on('rename', this.handleRename.bind(this)));
  }

  /**
   * Reads every note again and rebuilds the index from scratch.
   */
  public async rebuild(): Promise<void> {
    this.sources.clear();
    await this.indexAllNotes();
  }

  /**
   * Replaces the registry the incoming labels are read from.
   *
   * @param registry - The new registry.
   */
  public setRegistry(registry: RelationRegistry): void {
    this.registry = registry;
    this.triggerChanged(null);
  }

  protected override async onLayoutReady(): Promise<void> {
    await this.indexAllNotes();
  }

  private addResolvedReferences(sourcePath: string, references: readonly ExtractedReference[]): IndexedReference[] {
    const indexedReferences = references.map((reference) => this.resolveReference(sourcePath, reference));
    this.outgoing.set(sourcePath, indexedReferences);
    for (const reference of indexedReferences) {
      let incomingReferences = this.incoming.get(reference.targetPath);
      if (!incomingReferences) {
        incomingReferences = new Set();
        this.incoming.set(reference.targetPath, incomingReferences);
      }
      incomingReferences.add(reference);
    }
    return indexedReferences;
  }

  private ensureResolved(): void {
    if (!this.isResolutionStale) {
      return;
    }

    this.isResolutionStale = false;
    this.outgoing.clear();
    this.incoming.clear();
    for (const [sourcePath, references] of this.sources) {
      this.addResolvedReferences(sourcePath, references);
    }
  }

  /**
   * Follows one step of a chain: the stored relations with the label, then the notes the label's rule derives, once
   * per note reached.
   *
   * @param path - The note the step starts at.
   * @param label - The step's label.
   * @param shouldIncludeSubLabels - Whether the stored relations also include the labels that are kinds of it.
   * @returns The notes the step reaches.
   */
  private followLabel(path: string, label: string, shouldIncludeSubLabels: boolean): ChainEnd[] {
    const ends = new Map<string, ChainEnd>();
    for (const end of [...this.followStoredLabel(path, label, shouldIncludeSubLabels), ...this.followRule(path, label, shouldIncludeSubLabels)]) {
      if (!ends.has(end.path)) {
        ends.set(end.path, end);
      }
    }
    return [...ends.values()];
  }

  /**
   * Walks every chain of the rule that derives a label, keeping at each step only the notes that pass its filters,
   * and leaving out the note the walk starts at and the notes it reaches by the rule's `except` labels.
   *
   * @param path - The note the walk starts at.
   * @param label - The label.
   * @param shouldIncludeSubLabels - Whether each step's stored relations also include the labels that are kinds of it.
   * @returns The notes the chains reach, once each by the first chain reaching it, with the stored relations that
   * reached them, or none when no rule derives the label.
   */
  private followRule(path: string, label: string, shouldIncludeSubLabels: boolean): ChainEnd[] {
    const rule = this.registry.getRule(label);
    if (!rule) {
      return [];
    }

    const excludedPaths = new Set([path]);
    for (const exclusion of rule.exclusions) {
      for (const end of this.followLabel(path, exclusion, shouldIncludeSubLabels)) {
        excludedPaths.add(end.path);
      }
    }

    const ends = new Map<string, ChainEnd>();
    for (const chain of rule.chains) {
      let frontier: ChainEnd[] = [{ isResolved: true, path, steps: [] }];
      for (const step of chain) {
        const nextFrontier = new Map<string, ChainEnd>();
        for (const start of frontier) {
          for (const end of this.followLabel(start.path, step.label, shouldIncludeSubLabels)) {
            if (!nextFrontier.has(end.path) && this.passesFilters(end.path, step.filters)) {
              nextFrontier.set(end.path, { ...end, steps: [...start.steps, ...end.steps] });
            }
          }
        }
        frontier = [...nextFrontier.values()];
      }
      for (const end of frontier) {
        if (!excludedPaths.has(end.path) && !ends.has(end.path)) {
          ends.set(end.path, end);
        }
      }
    }
    return [...ends.values()];
  }

  private followStoredLabel(path: string, label: string, shouldIncludeSubLabels: boolean): ChainEnd[] {
    return this.getRelations(path, { includeSubLabels: shouldIncludeSubLabels, label }).map((relation) =>
      relation.direction === RelationDirection.Outgoing
        ? { isResolved: relation.isTargetResolved, path: relation.targetPath, steps: [relation] }
        : { isResolved: true, path: relation.sourcePath, steps: [relation] }
    );
  }

  private handleDelete(file: TAbstractFile): void {
    this.sources.delete(file.path);
    this.markResolutionStale();
  }

  private handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void {
    this.setReferences({ content: data, metadata: cache, sourcePath: file.path });
  }

  private handleRename(file: TAbstractFile, oldPath: string): void {
    const references = this.sources.get(oldPath);
    if (references) {
      this.sources.delete(oldPath);
      this.sources.set(file.path, references);
    }
    this.markResolutionStale();
  }

  private async indexAllNotes(): Promise<void> {
    const pathsChangedDuringIndexing = new Set<string>();
    this.pathsChangedDuringIndexing = pathsChangedDuringIndexing;
    try {
      for (const file of this.app.vault.getMarkdownFiles()) {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata) {
          continue;
        }

        const hasBodyLinks = (metadata.links?.length ?? 0) + (metadata.embeds?.length ?? 0) > 0;
        const content = hasBodyLinks ? await this.app.vault.cachedRead(file) : '';

        // A `changed` event that arrived while this loop awaited carries newer text than the read above.
        if (pathsChangedDuringIndexing.has(file.path)) {
          continue;
        }

        this.sources.set(file.path, extractReferences({ cache: metadata, content }));
      }
    } finally {
      this.pathsChangedDuringIndexing = null;
    }
    this.markResolutionStale();
  }

  private markResolutionStale(): void {
    this.isResolutionStale = true;
    this.triggerChanged(null);
  }

  private passesFilters(path: string, filters: readonly PropertyFilter[]): boolean {
    if (filters.length === 0) {
      return true;
    }

    const file = this.app.vault.getFileByPath(path);
    return doesPassPropertyFilters(filters, file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null);
  }

  private removeResolvedReferences(sourcePath: string): IndexedReference[] {
    const references = this.outgoing.get(sourcePath) ?? [];
    this.outgoing.delete(sourcePath);
    for (const reference of references) {
      const incomingReferences = this.incoming.get(reference.targetPath);
      incomingReferences?.delete(reference);
      if (incomingReferences?.size === 0) {
        this.incoming.delete(reference.targetPath);
      }
    }
    return references;
  }

  private resolveReference(sourcePath: string, reference: ExtractedReference): IndexedReference {
    const linkpath = getLinkpath(reference.reference.link);
    if (linkpath === '') {
      return { ...reference, isTargetResolved: true, sourcePath, targetPath: sourcePath };
    }

    const target = this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    return {
      ...reference,
      isTargetResolved: target !== null,
      sourcePath,
      targetPath: target?.path ?? linkpath
    };
  }

  private setReferences(params: RelationIndexComponentSetReferencesParams): void {
    const { content, metadata, sourcePath } = params;
    const references = isMarkdownFile(sourcePath) ? extractReferences({ cache: metadata, content }) : [];
    this.sources.set(sourcePath, references);
    this.pathsChangedDuringIndexing?.add(sourcePath);

    if (this.isResolutionStale) {
      this.triggerChanged(null);
      return;
    }

    const oldReferences = this.removeResolvedReferences(sourcePath);
    const newReferences = this.addResolvedReferences(sourcePath, references);
    const changedPaths = new Set([sourcePath]);
    for (const reference of [...oldReferences, ...newReferences]) {
      changedPaths.add(reference.targetPath);
    }
    this.triggerChanged([...changedPaths]);
  }

  private toRelation(reference: IndexedReference, direction: RelationDirection): Relation {
    const linkLabel = reference.label;
    const label = direction === RelationDirection.Incoming && linkLabel !== null
      ? this.registry.getInverseLabel(linkLabel) ?? linkLabel
      : linkLabel;

    return {
      direction,
      isTargetResolved: reference.isTargetResolved,
      label,
      labelForm: reference.labelForm,
      linkLabel,
      reference: reference.reference,
      sourcePath: reference.sourcePath,
      targetPath: reference.targetPath
    };
  }

  private triggerChanged(paths: null | readonly string[]): void {
    // A derived relation can change when a note several links away changes, and a shown label when the property
    // Of the note it describes does, so with rules or variants any note's may have.
    this.events.trigger('changed', this.registry.hasRules || this.registry.hasLabelVariants ? null : paths);
  }
}

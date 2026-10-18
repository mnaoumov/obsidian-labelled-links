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

import type { ExtractedReference } from './relation-extractor.ts';

import { extractReferences } from './relation-extractor.ts';
import {
  normalizeLabel,
  RelationRegistry
} from './relation-registry.ts';

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
 * Options for {@link RelationIndexComponent.getRelations}.
 */
export interface RelationIndexComponentGetRelationsOptions {
  /**
   * Only the relations in this direction. Both when omitted.
   */
  readonly direction?: RelationDirection;

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
   * @param options - Filters by direction and label.
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

    const label = options.label === null ? null : normalizeLabel(options.label);
    return relations.filter((relation) => (relation.label === null ? null : normalizeLabel(relation.label)) === label);
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
      linkLabel,
      reference: reference.reference,
      sourcePath: reference.sourcePath,
      targetPath: reference.targetPath
    };
  }

  private triggerChanged(paths: null | readonly string[]): void {
    this.events.trigger('changed', paths);
  }
}

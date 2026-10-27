/**
 * @file
 *
 * `Labelled Links`' public surface, as a consumer sees it.
 *
 * Hand-written and self-contained on purpose: it imports from `obsidian` and nothing else, so a plugin that
 * has never heard of `@mnaoumov/obsidian-lib` can copy this file, or reference it, and depend on
 * `Labelled Links` with no build-time dependency on this repo at all.
 *
 * Two things live here. The **API** reached through the `@mnaoumov/obsidian-lib` plugin registry, which
 * answers what a note's relations are right now, and the **event** — a `Workspace.on` overload plus the
 * payload it carries — which says when that answer may have changed.
 *
 * The event NAME is a wire contract and is spelled out as a literal type rather than exported as a constant,
 * because a declaration file has no runtime values to export: a consumer hardcodes the string. The payloads
 * are plain data, because they cross between plugins that share no code.
 */

import type {
  EventRef,
  Reference,
  TFile
} from 'obsidian';

/**
 * `Labelled Links`' API, published through the `@mnaoumov/obsidian-lib` plugin registry.
 *
 * The index fills once the workspace layout is ready, so a query before that answers with no relations; the
 * `labelled-links:relations-changed` event with `paths: null` says when it is filled.
 */
export interface LabelledLinksApi {
  /**
   * Gets the relations the composition rules in the settings derive for a note: `aunt = parent -> sibling`
   * gives Erin's aunt Carol through Erin's parent Dan and Dan's sibling Carol. They are worked out at query
   * time and never written into a note.
   *
   * A derived relation never ends at the queried note, and is left out when the note already has a stored
   * relation with the same label to the same note. {@link LabelledLinksApi.getRelations} never returns one.
   *
   * A fresh array of fresh objects on each call, so writing to them changes nothing here.
   *
   * @param pathOrFile - The note, or the path an unresolved link names.
   * @param options - Filters by rule label, and whether labels take their wide meaning.
   * @returns The derived relations, in rule order.
   */
  readonly getDerivedRelations: (pathOrFile: string | TFile, options?: LabelledLinksGetDerivedRelationsOptions) => LabelledLinksDerivedRelation[];

  /**
   * Gets the label a relation carries when it is seen from its target, from the relation definitions in the
   * settings, ignoring case.
   *
   * @param label - The label written in the source note.
   * @returns The inverse label, the label itself for a symmetric one, or `null` when the definitions have no
   * inverse for it.
   */
  readonly getInverseLabel: (label: string) => null | string;

  /**
   * Gets the relations of a note: the labelled relations, the plain links and the backlinks.
   *
   * A fresh array of fresh objects on each call, so writing to them changes nothing here.
   *
   * @param pathOrFile - The note, or the path an unresolved link names.
   * @param options - Filters by direction and label, and whether the label takes its wide meaning.
   * @returns The relations, outgoing first.
   */
  readonly getRelations: (pathOrFile: string | TFile, options?: LabelledLinksGetRelationsOptions) => LabelledLinksRelation[];
}

/**
 * A relation a composition rule derives, seen from the queried note: the label describes the target, as
 * `Carol is Erin's aunt`.
 *
 * Plain data, and additive only, as {@link LabelledLinksRelation} is.
 */
export interface LabelledLinksDerivedRelation {
  /**
   * Whether {@link LabelledLinksDerivedRelation.targetPath} is an existing file.
   */
  readonly isTargetResolved: boolean;

  /**
   * The derived label, as its rule writes it.
   */
  readonly label: string;

  /**
   * The path of the queried note.
   */
  readonly sourcePath: string;

  /**
   * The stored relations the rule's chain went through, in order, each seen from the note its step starts
   * at: the first from {@link LabelledLinksDerivedRelation.sourcePath}, and the last reaching
   * {@link LabelledLinksDerivedRelation.targetPath}.
   */
  readonly steps: readonly LabelledLinksRelation[];

  /**
   * The path of the note the chain ends at.
   */
  readonly targetPath: string;
}

/**
 * Options for {@link LabelledLinksApi.getDerivedRelations}.
 */
export interface LabelledLinksGetDerivedRelationsOptions {
  /**
   * Whether to take every label in the query in its wide meaning: the `label` filter also matches the rules
   * whose labels the definitions declare as kinds of it (`label < superLabel`), and each step of a rule's chain
   * also follows the stored relations whose labels are kinds of the step's label. A step still follows another
   * rule by its exact label only. `false` when omitted, so `grandmother = parent -> mother` follows `mother`
   * links only, and with it also `birthMother` links after `birthMother < mother`.
   */
  readonly includeSubLabels?: boolean;

  /**
   * Only the relations this rule label derives, compared ignoring case. All when omitted.
   */
  readonly label?: string;
}

/**
 * Options for {@link LabelledLinksApi.getRelations}.
 */
export interface LabelledLinksGetRelationsOptions {
  /**
   * Only the relations in this direction. Both when omitted.
   */
  readonly direction?: LabelledLinksRelationDirection;

  /**
   * Whether the `label` filter also matches the labels the definitions declare as kinds of it, through one or
   * more `label < superLabel` lines: after `birthMother < mother`, a query for `mother` also returns the
   * `birthMother` relations. `false` when omitted, so a query returns the label it names and nothing else.
   */
  readonly includeSubLabels?: boolean;

  /**
   * Only the relations with this label as seen from the queried note, compared ignoring case; `null` for the
   * plain links and backlinks only. All when omitted.
   */
  readonly label?: null | string;
}

/**
 * A link between two notes, seen from one of them.
 *
 * Plain data, and additive only: a new member may be added, none may change meaning or be removed, because a
 * consumer compiled against an older copy of this file is still passed the same object.
 */
export interface LabelledLinksRelation {
  /**
   * Whether the queried note is the source or the target.
   */
  readonly direction: LabelledLinksRelationDirection;

  /**
   * Whether {@link LabelledLinksRelation.targetPath} is an existing file. An unresolved link targets the path
   * it names.
   */
  readonly isTargetResolved: boolean;

  /**
   * The label as seen from the queried note. An outgoing relation carries the label written in the source;
   * an incoming one carries the registry's inverse of that label, or the written label itself when the
   * registry has no inverse for it. `null` for a plain link or backlink.
   */
  readonly label: null | string;

  /**
   * The label as written in the source note, or `null` for a plain link.
   */
  readonly linkLabel: null | string;

  /**
   * The cached reference in the source note: a `FrontmatterLinkCache` for a property, a `ReferenceCache` for
   * a link in the body. A copy, so writing to it changes nothing in the metadata cache.
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
 * Which end of a relation the queried note is: `outgoing` when the relation is written in it, `incoming`
 * when it is written in another note and points at it.
 */
export type LabelledLinksRelationDirection = 'incoming' | 'outgoing';

/**
 * The name of the event triggered on `app.workspace` when notes' relations may have changed.
 */
export type RelationsChangedEventName = 'labelled-links:relations-changed';

/**
 * The payload of the `labelled-links:relations-changed` event.
 *
 * Plain data, and additive only, as {@link LabelledLinksRelation} is.
 */
export interface RelationsChangedEventPayload {
  /**
   * The paths of the notes whose relations may have changed, or `null` when any note's may have: after the
   * index is first filled or rebuilt, after a file is created, renamed or deleted, after the relation
   * definitions change, and after every change while the definitions hold a composition rule, since a derived
   * relation can change when a note several links away does.
   */
  readonly paths: null | readonly string[];
}

declare module 'obsidian' {
  interface Workspace {
    /**
     * Subscribes to notes' relations changing in the `Labelled Links` index.
     *
     * Triggered after the index has changed, so `getRelations` already reflects it.
     *
     * @param name - Should be `'labelled-links:relations-changed'`.
     * @param callback - The callback receiving the paths of the notes whose relations may have changed.
     * @param context - The context passed as `this` to the `callback` function.
     * @returns The event reference.
     */
    /*
     * An augmentation of an EXISTING overload set has to stay a method signature. A property member does not
     * merge into `Workspace.on`'s overloads, and the failure surfaces at every call site rather than here.
     */
    // eslint-disable-next-line @typescript-eslint/method-signature-style -- A property member does not merge into an existing overload set. See above.
    on(name: RelationsChangedEventName, callback: (payload: RelationsChangedEventPayload) => unknown, context?: unknown): EventRef;
  }
}

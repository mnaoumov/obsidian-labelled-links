/**
 * @file
 *
 * The implementation behind this plugin's public API.
 *
 * Kept apart from `labelled-links-api.ts` so that file stays a plain description of the contract a consumer
 * reads, and apart from the index so the published surface is a thin delegate rather than the component
 * itself, which would hand a consumer every internal it happens to have.
 */

import type { TFile } from 'obsidian';

import type {
  LabelledLinksApi,
  LabelledLinksDerivedRelation,
  LabelledLinksGetDerivedRelationsOptions,
  LabelledLinksGetRelationsOptions,
  LabelledLinksRelation
} from '../api.d.ts';
import type {
  DerivedRelation,
  Relation,
  RelationIndexComponent
} from './relation-index-component.ts';

import { RelationDirection } from './relation-index-component.ts';

/**
 * This plugin's API, as it is actually implemented.
 */
export class LabelledLinksApiImpl implements LabelledLinksApi {
  /**
   * Creates the API.
   *
   * @param relationIndex - The relation index the API reads.
   */
  public constructor(private readonly relationIndex: RelationIndexComponent) {}

  /**
   * Gets the relations the composition rules derive for a note, as fresh plain objects.
   *
   * @param pathOrFile - The note, or the path an unresolved link names.
   * @param options - Filters by rule label, and whether labels take their wide meaning.
   * @returns The derived relations, in rule order.
   */
  // eslint-disable-next-line typescript-dev-toolkit/params-options-name-match -- The options type is the published one from `api.d.ts`, which this class implements.
  public getDerivedRelations(pathOrFile: string | TFile, options: LabelledLinksGetDerivedRelationsOptions = {}): LabelledLinksDerivedRelation[] {
    return this.relationIndex.getDerivedRelations(pathOrFile, options).map((relation) => toPublishedDerivedRelation(relation));
  }

  /**
   * Gets the label a relation carries when it is seen from its target.
   *
   * @param label - The label written in the source note.
   * @returns The inverse label, or `null` when the definitions have none for it.
   */
  public getInverseLabel(label: string): null | string {
    return this.relationIndex.getInverseLabel(label);
  }

  /**
   * Gets the relations of a note, as fresh plain objects.
   *
   * @param pathOrFile - The note, or the path an unresolved link names.
   * @param options - Filters by direction and label, and whether the label takes its wide meaning.
   * @returns The relations, outgoing first.
   */
  // eslint-disable-next-line typescript-dev-toolkit/params-options-name-match -- The options type is the published one from `api.d.ts`, which this class implements.
  public getRelations(pathOrFile: string | TFile, options: LabelledLinksGetRelationsOptions = {}): LabelledLinksRelation[] {
    const relations = this.relationIndex.getRelations(pathOrFile, {
      ...(options.direction !== undefined && {
        direction: options.direction === 'incoming' ? RelationDirection.Incoming : RelationDirection.Outgoing
      }),
      ...(options.includeSubLabels !== undefined && { includeSubLabels: options.includeSubLabels }),
      ...(options.label !== undefined && { label: options.label })
    });
    return relations.map((relation) => toPublishedRelation(relation));
  }
}

function toPublishedDerivedRelation(relation: DerivedRelation): LabelledLinksDerivedRelation {
  return {
    isTargetResolved: relation.isTargetResolved,
    label: relation.label,
    sourcePath: relation.sourcePath,
    steps: relation.steps.map((step) => toPublishedRelation(step)),
    targetPath: relation.targetPath
  };
}

function toPublishedRelation(relation: Relation): LabelledLinksRelation {
  return {
    direction: relation.direction === RelationDirection.Incoming ? 'incoming' : 'outgoing',
    isTargetResolved: relation.isTargetResolved,
    label: relation.label,
    linkLabel: relation.linkLabel,
    // A copy, so a consumer writing to it cannot reach the metadata cache.
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- This runs in Obsidian's renderer, whose Chromium has had structuredClone far longer than Obsidian has required.
    reference: structuredClone(relation.reference),
    sourcePath: relation.sourcePath,
    targetPath: relation.targetPath
  };
}

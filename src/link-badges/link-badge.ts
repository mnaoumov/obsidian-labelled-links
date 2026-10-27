import type { ReferenceCache } from 'obsidian';

import { setTooltip } from 'obsidian';

import type {
  Relation,
  RelationIndexComponent
} from '../relation-index/relation-index-component.ts';

import {
  formatRelationSentence,
  getNoteName,
  isReferenceCache
} from '../relation-index/relation-helpers.ts';
import { RelationDirection } from '../relation-index/relation-index-component.ts';

/**
 * The class of a link badge, in Live Preview and in Reading view alike.
 */
export const LINK_BADGE_CLASS = 'labelled-links-badge';

/**
 * What a link badge shows: the label on the badge, and the relation and its inverse in its tooltip, each as a
 * sentence naming both ends (`Bob is Alice's child`).
 */
export interface LinkBadge {
  /**
   * The label written in the source note, or the variant the target note's property picks for it.
   */
  readonly label: string;

  /**
   * The tooltip text, one line per direction.
   */
  readonly tooltip: string;
}

/**
 * An outgoing relation written in the note's body, which is where a link can carry a badge.
 */
export interface PositionedRelation extends Relation {
  readonly reference: ReferenceCache;
}

/**
 * Creates the badge element shown after a labelled link.
 *
 * @param badge - The label and the tooltip.
 * @returns The element.
 */
export function createLinkBadgeEl(badge: LinkBadge): HTMLElement {
  const badgeEl = createSpan({ cls: LINK_BADGE_CLASS, text: badge.label });
  badgeEl.setAttribute('aria-label', badge.tooltip);
  setTooltip(badgeEl, badge.tooltip);
  return badgeEl;
}

/**
 * Gets the badge of a relation, or `null` when the link is unlabelled.
 *
 * @param relationIndex - The index, which knows the registry's inverse labels.
 * @param relation - An outgoing relation.
 * @returns The badge, or `null`.
 */
export function getLinkBadge(relationIndex: RelationIndexComponent, relation: Relation): LinkBadge | null {
  const label = relation.linkLabel;
  if (label === null) {
    return null;
  }

  const sourceName = getNoteName(relation.sourcePath);
  const targetName = relation.isTargetResolved ? getNoteName(relation.targetPath) : relation.targetPath;
  const shownLabel = relationIndex.getShownLabel(label, relation.targetPath);
  const inverseLabel = relationIndex.getInverseLabel(label);
  const inverseLine = inverseLabel === null
    ? `No inverse label is registered for "${label}".`
    : formatRelationSentence({ label: relationIndex.getShownLabel(inverseLabel, relation.sourcePath), sourceName: targetName, targetName: sourceName });

  return { label: shownLabel, tooltip: `${formatRelationSentence({ label: shownLabel, sourceName, targetName })}\n${inverseLine}` };
}

/**
 * Gets the outgoing relations of a note that sit in its body, labelled or not, in the order they are written.
 * Embeds are left out: a badge belongs on a link the reader clicks, not on an embedded file.
 *
 * @param relationIndex - The index.
 * @param path - The note's path.
 * @returns The relations.
 */
export function getPositionedRelations(relationIndex: RelationIndexComponent, path: string): PositionedRelation[] {
  return relationIndex.getRelations(path, { direction: RelationDirection.Outgoing })
    .filter(isPositionedRelation)
    .filter((relation) => !relation.reference.original.startsWith('!'))
    .sort((a, b) => a.reference.position.start.offset - b.reference.position.start.offset);
}

/**
 * Checks whether a note's text still holds a reference where the metadata cache put it. The cache lags behind
 * typing, so its offsets are trusted only while the text there is the reference's original text.
 *
 * @param text - The note's current text.
 * @param relation - The relation.
 * @returns Whether the reference is still there.
 */
export function isRelationInText(text: string, relation: PositionedRelation): boolean {
  const { end, start } = relation.reference.position;
  return text.slice(start.offset, end.offset) === relation.reference.original;
}

function isPositionedRelation(relation: Relation): relation is PositionedRelation {
  return isReferenceCache(relation.reference);
}

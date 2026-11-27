import type {
  App,
  HoverParent,
  TFile
} from 'obsidian';

import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  Keymap,
  setTooltip
} from 'obsidian';

import type {
  DerivedRelation,
  Relation,
  RelationIndexComponent
} from '../relation-index/relation-index-component.ts';

import {
  formatDerivation,
  formatRelationSentence,
  formatWrittenRelation,
  getNoteName,
  isReferenceCache
} from '../relation-index/relation-helpers.ts';
import { RelationDirection } from '../relation-index/relation-index-component.ts';
import { normalizeLabel } from '../relation-registry/relation-registry.ts';

/**
 * The hover source the relation lists fire `hover-link` from. The relations pane registers it under its view type.
 */
export const RELATION_LIST_HOVER_SOURCE = 'labelled-links-relations';

/**
 * Which labels a relation list shows.
 */
export interface RelationListLabelFilter {
  /**
   * The labels to leave out, compared ignoring case.
   */
  readonly hiddenLabels: readonly string[];

  /**
   * The only labels to list, compared ignoring case, or `null` for every label.
   */
  readonly shownLabels: null | readonly string[];
}

/**
 * What a relation list shows.
 */
export interface RelationListOptions extends RelationListLabelFilter {
  /**
   * Whether the relations the registry's composition rules derive are listed.
   */
  readonly shouldIncludeDerived: boolean;

  /**
   * Whether a sub-label's relations are listed in their widest superset's group.
   */
  readonly shouldIncludeSubLabels: boolean;

  /**
   * Whether the plain links and backlinks are listed.
   */
  readonly shouldIncludeUnlabelled: boolean;
}

/**
 * Params for the {@link RelationListRenderer} constructor.
 */
export interface RelationListRendererConstructorParams {
  /**
   * The Obsidian app.
   */
  readonly app: App;

  /**
   * The component a page preview raised from a row belongs to.
   */
  readonly hoverParent: HoverParent;

  /**
   * The index the list reads.
   */
  readonly relationIndex: RelationIndexComponent;
}

/**
 * Params for {@link RelationListRenderer.render}.
 */
export interface RelationListRendererRenderParams {
  /**
   * The element the list is drawn into.
   */
  readonly containerEl: HTMLElement;

  /**
   * The note whose relations are listed.
   */
  readonly file: TFile;

  /**
   * What the list shows.
   */
  readonly options: RelationListOptions;
}

interface Labelled {
  readonly label: string;
}

interface LabelledRelation extends Relation {
  readonly label: string;
}

interface RelationGroup<T = Relation> {
  readonly label: string;
  readonly relations: T[];
}

interface RelationListRendererGroupByLabelParams<T extends Labelled> {
  readonly filter: RelationListLabelFilter;
  readonly getDescribedPath: (relation: T) => string;
  readonly relations: readonly T[];
  readonly shouldIncludeSubLabels: boolean;
}

interface RelationListRendererRenderDerivedSectionParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly filter: RelationListLabelFilter;
  readonly relations: readonly DerivedRelation[];
  readonly shouldIncludeSubLabels: boolean;
}

interface RelationListRendererRenderLinkParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly isResolved: boolean;
  readonly otherPath: string;
}

interface RelationListRendererRenderRowParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly groupLabel: string;
  readonly relation: Relation;
}

interface RelationListRendererRenderSectionParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly groups: readonly RelationGroup[];
  readonly title: string;
}

/**
 * Draws a note's relations as sections of label groups: outgoing, incoming under their inverse labels, derived, and
 * the plain links and backlinks with the line each one sits on. The relations pane and the `labelled-links` code
 * block both draw with it.
 *
 * An incoming relation is listed under its inverse label, the label it carries as seen from the note, with a
 * sentence naming both ends (`Bob is Alice's child`) and, in its tooltip, the link as its source writes it. A derived
 * relation has the chain that produced it in its tooltip.
 */
export class RelationListRenderer {
  private readonly app: App;
  private readonly hoverParent: HoverParent;
  private readonly relationIndex: RelationIndexComponent;
  private renderCount = 0;

  /**
   * Creates the renderer.
   *
   * @param params - The app, the preview owner and the index.
   */
  public constructor(params: RelationListRendererConstructorParams) {
    this.app = params.app;
    this.hoverParent = params.hoverParent;
    this.relationIndex = params.relationIndex;
  }

  /**
   * Stops an earlier {@link render} still reading snippets from writing them.
   */
  public cancel(): void {
    this.renderCount++;
  }

  /**
   * Draws the relations of a note. The plain links' snippets are read after the sections are drawn; a later call
   * stops an earlier one still reading them.
   *
   * @param params - The container, the note and what to show.
   * @returns The number of sections drawn, `0` when nothing matched.
   */
  public async render(params: RelationListRendererRenderParams): Promise<number> {
    const { containerEl, file, options } = params;
    const renderCount = ++this.renderCount;

    const relations = this.relationIndex.getRelations(file);
    // A derived relation starts with a stored one, so a note with none has nothing to derive either.
    if (relations.length === 0) {
      return 0;
    }

    let sectionCount = 0;
    const labelled = relations.filter(isLabelledRelation);
    for (const [direction, title] of [[RelationDirection.Outgoing, 'Outgoing'], [RelationDirection.Incoming, 'Incoming']] as const) {
      const groups = this.groupByLabel({
        filter: options,
        getDescribedPath: getOtherPath,
        relations: labelled.filter((relation) => relation.direction === direction),
        shouldIncludeSubLabels: options.shouldIncludeSubLabels
      });
      this.renderSection({ containerEl, file, groups, title });
      if (groups.length > 0) {
        sectionCount++;
      }
    }

    if (options.shouldIncludeDerived) {
      sectionCount += this.renderDerivedSection({
        containerEl,
        file,
        filter: options,
        relations: this.relationIndex.getDerivedRelations(file, { includeSubLabels: options.shouldIncludeSubLabels }),
        shouldIncludeSubLabels: options.shouldIncludeSubLabels
      });
    }

    if (!options.shouldIncludeUnlabelled) {
      return sectionCount;
    }

    const unlabelled = relations.filter((relation) => relation.label === null);
    const groups = [
      { label: 'Links', relations: unlabelled.filter((relation) => relation.direction === RelationDirection.Outgoing) },
      { label: 'Backlinks', relations: unlabelled.filter((relation) => relation.direction === RelationDirection.Incoming) }
    ].filter((group) => group.relations.length > 0);
    const snippetEls = this.renderSection({ containerEl, file, groups, title: 'Unlabelled' });
    if (groups.length > 0) {
      sectionCount++;
    }

    for (const [relation, snippetEl] of snippetEls) {
      const snippet = await this.readSnippet(relation);
      // A newer render has replaced this one while it awaited.
      if (renderCount !== this.renderCount) {
        return sectionCount;
      }
      snippetEl.setText(snippet);
    }

    return sectionCount;
  }

  /**
   * Groups labelled relations by label, ignoring case, in label order. In the wide meaning a relation goes in the
   * group of each widest superset of its label instead. A label with variants is grouped under the variant the
   * described note picks, so `parent` splits into `mother` and `father`. A group is titled with the spelling its
   * first relation uses, or with the superset's spelling. A relation is kept only when its own label, the group's
   * label or the group's shown label passes the label filter.
   *
   * @typeParam T - The type of the relations.
   * @param params - The relations, every one with a label, how to find the note a label describes, the label filter
   *   and whether to group by the wide meaning.
   * @returns The groups.
   */
  private groupByLabel<T extends Labelled>(params: RelationListRendererGroupByLabelParams<T>): RelationGroup<T>[] {
    const { filter, getDescribedPath, relations, shouldIncludeSubLabels } = params;
    const groups = new Map<string, RelationGroup<T>>();
    for (const relation of relations) {
      const labels = shouldIncludeSubLabels ? this.relationIndex.getRootLabels(relation.label) : [relation.label];
      for (const label of labels) {
        const groupLabel = this.relationIndex.getShownLabel(label, getDescribedPath(relation));
        if (!isShown(filter, [relation.label, label, groupLabel])) {
          continue;
        }
        const key = normalizeLabel(groupLabel);
        let group = groups.get(key);
        if (!group) {
          group = { label: groupLabel, relations: [] };
          groups.set(key, group);
        }
        group.relations.push(relation);
      }
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  private async readSnippet(relation: Relation): Promise<string> {
    if (!isReferenceCache(relation.reference)) {
      return '';
    }

    const source = this.app.vault.getFileByPath(relation.sourcePath);
    if (!source) {
      return '';
    }

    const content = await this.app.vault.cachedRead(source);
    return content.split('\n')[relation.reference.position.start.line]?.trim() ?? '';
  }

  private renderDerivedSection(params: RelationListRendererRenderDerivedSectionParams): number {
    const { containerEl, file, filter, relations, shouldIncludeSubLabels } = params;
    const groups = this.groupByLabel({ filter, getDescribedPath: (relation) => relation.targetPath, relations, shouldIncludeSubLabels });
    if (groups.length === 0) {
      return 0;
    }

    const sectionEl = containerEl.createDiv({ cls: 'labelled-links-relations-section' });
    sectionEl.createDiv({ cls: 'labelled-links-relations-section-title', text: 'Derived' });

    for (const group of groups) {
      const groupEl = sectionEl.createDiv({ cls: 'labelled-links-relations-group' });
      groupEl.dataset['label'] = group.label;
      groupEl.createDiv({ cls: 'labelled-links-relations-group-title', text: group.label });
      for (const relation of group.relations) {
        const rowEl = groupEl.createDiv({ cls: ['labelled-links-relation', 'labelled-links-relation-derived'] });
        this.renderLink({ containerEl: rowEl, file, isResolved: relation.isTargetResolved, otherPath: relation.targetPath });

        const sourceName = getNoteName(relation.sourcePath);
        const sentence = formatRelationSentence({
          label: this.relationIndex.getShownLabel(relation.label, relation.targetPath),
          sourceName,
          targetName: getNoteName(relation.targetPath)
        });
        const sentenceEl = rowEl.createSpan({ cls: 'labelled-links-relation-sentence', text: sentence });
        const derivation = formatDerivation({
          sourceName,
          steps: relation.steps.map((step) => ({
            label: this.relationIndex.getShownLabel(ensureNonNullable(step.label), getOtherPath(step)),
            targetName: getNoteName(getOtherPath(step))
          }))
        });
        const tooltip = `${sentence}: ${derivation}`;
        sentenceEl.setAttribute('aria-label', tooltip);
        setTooltip(sentenceEl, tooltip);
      }
    }
    return 1;
  }

  private renderLink(params: RelationListRendererRenderLinkParams): void {
    const { containerEl, file, isResolved, otherPath } = params;
    const linkEl = containerEl.createEl('a', {
      cls: ['internal-link', 'labelled-links-relation-link'],
      text: isResolved ? getNoteName(otherPath) : otherPath
    });
    linkEl.toggleClass('is-unresolved', !isResolved);
    linkEl.addEventListener('click', (event_) => {
      event_.preventDefault();
      invokeAsyncSafely(() => this.app.workspace.openLinkText(otherPath, file.path, Keymap.isModEvent(event_)));
    });
    linkEl.addEventListener('mouseover', (event_) => {
      this.app.workspace.trigger('hover-link', {
        event: event_,
        hoverParent: this.hoverParent,
        linktext: otherPath,
        source: RELATION_LIST_HOVER_SOURCE,
        sourcePath: file.path,
        targetEl: linkEl
      });
    });
  }

  private renderRow(params: RelationListRendererRenderRowParams): HTMLElement {
    const { containerEl, file, groupLabel, relation } = params;
    const isResolved = relation.direction === RelationDirection.Incoming || relation.isTargetResolved;

    const rowEl = containerEl.createDiv({ cls: 'labelled-links-relation' });
    const otherPath = getOtherPath(relation);
    this.renderLink({ containerEl: rowEl, file, isResolved, otherPath });

    // In a superset's group, an outgoing row names its own label, which no sentence spells out.
    const shownLabel = relation.label === null ? null : this.relationIndex.getShownLabel(relation.label, otherPath);
    if (relation.direction === RelationDirection.Outgoing && shownLabel !== null && normalizeLabel(shownLabel) !== normalizeLabel(groupLabel)) {
      rowEl.createSpan({ cls: 'labelled-links-relation-sub-label', text: shownLabel });
    }

    // An incoming label describes the note the list is for, not the row's: Alice's `child:: [[Bob]]` makes Bob the
    // Child. The group title alone does not say which end it describes, so the row spells it out.
    if (relation.direction === RelationDirection.Incoming && relation.labelForm !== null) {
      const label = ensureNonNullable(relation.linkLabel);
      const sourceName = getNoteName(relation.sourcePath);
      const sentenceEl = rowEl.createSpan({
        cls: 'labelled-links-relation-sentence',
        text: formatRelationSentence({ label: this.relationIndex.getShownLabel(label, file.path), sourceName, targetName: getNoteName(file.path) })
      });
      const tooltip = formatWrittenRelation({ label, labelForm: relation.labelForm, original: relation.reference.original, sourceName });
      sentenceEl.setAttribute('aria-label', tooltip);
      setTooltip(sentenceEl, tooltip);
    }

    return rowEl;
  }

  private renderSection(params: RelationListRendererRenderSectionParams): Map<Relation, HTMLElement> {
    const { containerEl, file, groups, title } = params;
    const snippetEls = new Map<Relation, HTMLElement>();
    if (groups.length === 0) {
      return snippetEls;
    }

    const sectionEl = containerEl.createDiv({ cls: 'labelled-links-relations-section' });
    sectionEl.createDiv({ cls: 'labelled-links-relations-section-title', text: title });

    for (const group of groups) {
      const groupEl = sectionEl.createDiv({ cls: 'labelled-links-relations-group' });
      groupEl.dataset['label'] = group.label;
      groupEl.createDiv({ cls: 'labelled-links-relations-group-title', text: group.label });
      for (const relation of group.relations) {
        const rowEl = this.renderRow({ containerEl: groupEl, file, groupLabel: group.label, relation });
        if (relation.label === null) {
          snippetEls.set(relation, rowEl.createDiv({ cls: 'labelled-links-relation-snippet' }));
        }
      }
    }

    return snippetEls;
  }
}

/**
 * Gets the end of a relation that is not the note it is seen from.
 *
 * @param relation - The relation.
 * @returns The path of its other end.
 */
function getOtherPath(relation: Relation): string {
  return relation.direction === RelationDirection.Outgoing ? relation.targetPath : relation.sourcePath;
}

function isLabelledRelation(relation: Relation): relation is LabelledRelation {
  return relation.label !== null;
}

/**
 * Checks a relation's labels against a label filter: kept when none of them is hidden and, with a list of labels to
 * show, at least one of them is on it.
 *
 * @param filter - The filter.
 * @param labels - The relation's own label, its group's label and its group's shown label.
 * @returns Whether the relation is listed.
 */
function isShown(filter: RelationListLabelFilter, labels: readonly string[]): boolean {
  const keys = new Set(labels.map((label) => normalizeLabel(label)));
  const isHidden = filter.hiddenLabels.some((label) => keys.has(normalizeLabel(label)));
  return !isHidden && (filter.shownLabels === null || filter.shownLabels.some((label) => keys.has(normalizeLabel(label))));
}

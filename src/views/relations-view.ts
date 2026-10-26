import type {
  IconName,
  TFile,
  ViewStateResult,
  WorkspaceLeaf
} from 'obsidian';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '@mnaoumov/typescript-lib/async';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  ItemView,
  Keymap,
  setTooltip
} from 'obsidian';

import type {
  DerivedRelation,
  Relation,
  RelationIndexComponent
} from '../relation-index-component.ts';

import {
  formatDerivation,
  formatRelationSentence,
  formatWrittenRelation,
  getNoteName,
  isReferenceCache
} from '../relation-helpers.ts';
import { RelationDirection } from '../relation-index-component.ts';
import { normalizeLabel } from '../relation-registry.ts';

/**
 * The view type the relations pane is registered under.
 */
export const RELATIONS_VIEW_TYPE = 'labelled-links-relations';

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

interface RelationsViewConstructorParams {
  readonly leaf: WorkspaceLeaf;
  readonly relationIndex: RelationIndexComponent;
}

interface RelationsViewRenderDerivedSectionParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly relations: readonly DerivedRelation[];
}

interface RelationsViewRenderLinkParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly isResolved: boolean;
  readonly otherPath: string;
}

interface RelationsViewRenderRowParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly groupLabel: string;
  readonly relation: Relation;
}

interface RelationsViewRenderSectionParams {
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly groups: readonly RelationGroup[];
  readonly title: string;
}

/**
 * The relations pane: every relation of the active note, outgoing and incoming, grouped by label, plus its
 * plain links and backlinks with the line each one sits on.
 *
 * An incoming relation is listed under its inverse label, the label it carries as seen from the active note, with
 * a sentence naming both ends (`Bob is Alice's child`) and, in its tooltip, the link as its source writes it.
 * The relations the registry's composition rules derive follow, in a section of their own, each with the chain
 * that produced it in its tooltip. The pane follows the active note and redraws whenever the index reports a
 * change that touches it.
 *
 * A header button switches the pane to the wide meaning of each label: a relation whose label the registry declares
 * as a kind of another (`birthMother < mother`) is listed in its widest superset's group, naming its own label,
 * and the derived section follows the sub-labels too. The choice is kept in the pane's view state.
 */
export class RelationsView extends ItemView {
  private file: null | TFile = null;
  private includeSubLabelsActionEl: HTMLElement | null = null;
  private readonly relationIndex: RelationIndexComponent;
  private renderCount = 0;
  private shouldIncludeSubLabels = false;

  /**
   * Creates the pane.
   *
   * @param params - The leaf the pane lives in and the index it reads.
   */
  public constructor(params: RelationsViewConstructorParams) {
    super(params.leaf);
    this.relationIndex = params.relationIndex;
  }

  public override getDisplayText(): string {
    return 'Relations';
  }

  public override getIcon(): IconName {
    return 'arrow-right-left';
  }

  public override getState(): Record<string, unknown> {
    return { ...super.getState(), includeSubLabels: this.shouldIncludeSubLabels };
  }

  public override getViewType(): string {
    return RELATIONS_VIEW_TYPE;
  }

  /**
   * Draws the pane again for the note it shows.
   */
  public async refresh(): Promise<void> {
    const renderCount = ++this.renderCount;
    const { contentEl, file } = this;
    contentEl.empty();
    contentEl.addClass('labelled-links-relations-view');

    if (!file) {
      contentEl.createDiv({ cls: 'pane-empty', text: 'Open a note to see its relations.' });
      return;
    }

    contentEl.createDiv({ cls: 'labelled-links-relations-title', text: file.basename });

    const relations = this.relationIndex.getRelations(file);
    // A derived relation starts with a stored one, so a note with none has nothing to derive either.
    if (relations.length === 0) {
      contentEl.createDiv({ cls: 'pane-empty', text: 'This note has no relations, links or backlinks.' });
      return;
    }

    const labelled = relations.filter(isLabelledRelation);
    this.renderSection({
      containerEl: contentEl,
      file,
      groups: this.groupByLabel(labelled.filter((relation) => relation.direction === RelationDirection.Outgoing), getOtherPath),
      title: 'Outgoing'
    });
    this.renderSection({
      containerEl: contentEl,
      file,
      groups: this.groupByLabel(labelled.filter((relation) => relation.direction === RelationDirection.Incoming), getOtherPath),
      title: 'Incoming'
    });
    this.renderDerivedSection({
      containerEl: contentEl,
      file,
      relations: this.relationIndex.getDerivedRelations(file, { includeSubLabels: this.shouldIncludeSubLabels })
    });

    const unlabelled = relations.filter((relation) => relation.label === null);
    const snippetEls = this.renderSection({
      containerEl: contentEl,
      file,
      groups: [
        { label: 'Links', relations: unlabelled.filter((relation) => relation.direction === RelationDirection.Outgoing) },
        { label: 'Backlinks', relations: unlabelled.filter((relation) => relation.direction === RelationDirection.Incoming) }
      ].filter((group) => group.relations.length > 0),
      title: 'Unlabelled'
    });

    for (const [relation, snippetEl] of snippetEls) {
      const snippet = await this.readSnippet(relation);
      // A newer refresh has emptied the pane while this one awaited.
      if (renderCount !== this.renderCount) {
        return;
      }
      snippetEl.setText(snippet);
    }
  }

  /**
   * Shows the relations of another note.
   *
   * @param file - The note, or `null` to show none.
   */
  public async setFile(file: null | TFile): Promise<void> {
    this.file = file;
    await this.refresh();
  }

  /**
   * Switches the pane between the narrow and the wide meaning of each label.
   *
   * @param shouldIncludeSubLabels - Whether a sub-label's relations are listed in their widest superset's group.
   */
  public async setIncludeSubLabels(shouldIncludeSubLabels: boolean): Promise<void> {
    this.shouldIncludeSubLabels = shouldIncludeSubLabels;
    this.includeSubLabelsActionEl?.toggleClass('is-active', shouldIncludeSubLabels);
    this.includeSubLabelsActionEl?.setAttribute('aria-pressed', String(shouldIncludeSubLabels));
    await this.refresh();
  }

  public override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const shouldIncludeSubLabels = (state as null | Partial<Record<string, unknown>>)?.['includeSubLabels'];
    if (typeof shouldIncludeSubLabels === 'boolean' && shouldIncludeSubLabels !== this.shouldIncludeSubLabels) {
      await this.setIncludeSubLabels(shouldIncludeSubLabels);
    }
  }

  protected override async onOpen(): Promise<void> {
    this.includeSubLabelsActionEl = this.addAction(
      'list-tree',
      'Include sub-labels',
      convertAsyncToSync(async () => {
        await this.setIncludeSubLabels(!this.shouldIncludeSubLabels);
        this.app.workspace.requestSaveLayout();
      })
    );
    this.includeSubLabelsActionEl.setAttribute('aria-pressed', String(this.shouldIncludeSubLabels));
    this.registerEvent(this.app.workspace.on('file-open', convertAsyncToSync(this.setFile.bind(this))));
    const eventRef = this.relationIndex.on('changed', convertAsyncToSync(this.handleIndexChanged.bind(this)));
    this.register(() => {
      this.relationIndex.offref(eventRef);
    });
    await this.setFile(this.app.workspace.getActiveFile());
  }

  /**
   * Groups labelled relations by label, ignoring case, in label order. In the wide meaning a relation goes in the
   * group of each widest superset of its label instead. A label with variants is grouped under the variant the
   * described note picks, so `parent` splits into `mother` and `father`. A group is titled with the spelling its
   * first relation uses, or with the superset's spelling.
   *
   * @typeParam T - The type of the relations.
   * @param relations - The relations, every one with a label.
   * @param getDescribedPath - Gets the path of the note a relation's label describes.
   * @returns The groups.
   */
  private groupByLabel<T extends Labelled>(relations: readonly T[], getDescribedPath: (relation: T) => string): RelationGroup<T>[] {
    const groups = new Map<string, RelationGroup<T>>();
    for (const relation of relations) {
      const labels = this.shouldIncludeSubLabels ? this.relationIndex.getRootLabels(relation.label) : [relation.label];
      for (const label of labels) {
        const groupLabel = this.relationIndex.getShownLabel(label, getDescribedPath(relation));
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

  private async handleIndexChanged(paths: null | readonly string[]): Promise<void> {
    if (this.file && (paths === null || paths.includes(this.file.path))) {
      await this.refresh();
    }
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

  private renderDerivedSection(params: RelationsViewRenderDerivedSectionParams): void {
    const { containerEl, file, relations } = params;
    if (relations.length === 0) {
      return;
    }

    const sectionEl = containerEl.createDiv({ cls: 'labelled-links-relations-section' });
    sectionEl.createDiv({ cls: 'labelled-links-relations-section-title', text: 'Derived' });

    for (const group of this.groupByLabel(relations, (relation) => relation.targetPath)) {
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
  }

  private renderLink(params: RelationsViewRenderLinkParams): void {
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
        hoverParent: this,
        linktext: otherPath,
        source: RELATIONS_VIEW_TYPE,
        sourcePath: file.path,
        targetEl: linkEl
      });
    });
  }

  private renderRow(params: RelationsViewRenderRowParams): HTMLElement {
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

    // An incoming label describes the active note, not the row's: Alice's `child:: [[Bob]]` makes Bob the child.
    // The group title alone does not say which end it describes, so the row spells it out.
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

  private renderSection(params: RelationsViewRenderSectionParams): Map<Relation, HTMLElement> {
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

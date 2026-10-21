import type {
  IconName,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '@mnaoumov/typescript-lib/async';
import {
  ItemView,
  Keymap,
  setTooltip
} from 'obsidian';

import type {
  Relation,
  RelationIndexComponent
} from '../relation-index-component.ts';

import {
  getNoteName,
  isReferenceCache
} from '../relation-helpers.ts';
import { RelationDirection } from '../relation-index-component.ts';
import { normalizeLabel } from '../relation-registry.ts';

/**
 * The view type the relations pane is registered under.
 */
export const RELATIONS_VIEW_TYPE = 'labelled-links-relations';

interface LabelledRelation extends Relation {
  readonly label: string;
}

interface RelationGroup {
  readonly label: string;
  readonly relations: Relation[];
}

interface RelationsViewConstructorParams {
  readonly leaf: WorkspaceLeaf;
  readonly relationIndex: RelationIndexComponent;
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
 * An incoming relation is listed under its inverse label, the label it carries as seen from the active note.
 * The pane follows the active note and redraws whenever the index reports a change that touches it.
 */
export class RelationsView extends ItemView {
  private file: null | TFile = null;
  private readonly relationIndex: RelationIndexComponent;
  private renderCount = 0;

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
    if (relations.length === 0) {
      contentEl.createDiv({ cls: 'pane-empty', text: 'This note has no relations, links or backlinks.' });
      return;
    }

    const labelled = relations.filter(isLabelledRelation);
    this.renderSection({
      containerEl: contentEl,
      file,
      groups: groupByLabel(labelled.filter((relation) => relation.direction === RelationDirection.Outgoing)),
      title: 'Outgoing'
    });
    this.renderSection({
      containerEl: contentEl,
      file,
      groups: groupByLabel(labelled.filter((relation) => relation.direction === RelationDirection.Incoming)),
      title: 'Incoming'
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

  protected override async onOpen(): Promise<void> {
    this.registerEvent(this.app.workspace.on('file-open', convertAsyncToSync(this.setFile.bind(this))));
    const eventRef = this.relationIndex.on('changed', convertAsyncToSync(this.handleIndexChanged.bind(this)));
    this.register(() => {
      this.relationIndex.offref(eventRef);
    });
    await this.setFile(this.app.workspace.getActiveFile());
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

  private renderRow(params: RelationsViewRenderRowParams): HTMLElement {
    const { containerEl, file, groupLabel, relation } = params;
    const otherPath = relation.direction === RelationDirection.Outgoing ? relation.targetPath : relation.sourcePath;
    const isResolved = relation.direction === RelationDirection.Incoming || relation.isTargetResolved;

    const rowEl = containerEl.createDiv({ cls: 'labelled-links-relation' });
    const linkEl = rowEl.createEl('a', {
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

    if (relation.direction === RelationDirection.Incoming && relation.linkLabel !== null && relation.linkLabel !== relation.label) {
      const sourceName = getNoteName(relation.sourcePath);
      const targetName = getNoteName(file.path);
      const writtenEl = rowEl.createSpan({
        cls: 'labelled-links-relation-written-label',
        text: `${sourceName} --${relation.linkLabel}--> ${targetName}`
      });
      const tooltip = `${sourceName} links to ${targetName} with the label "${relation.linkLabel}", read from this end as "${groupLabel}".`;
      writtenEl.setAttribute('aria-label', tooltip);
      setTooltip(writtenEl, tooltip);
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
 * Groups labelled relations by label, ignoring case, in label order. A group is titled with the spelling its
 * first relation uses.
 *
 * @param relations - The relations, every one with a label.
 * @returns The groups.
 */
function groupByLabel(relations: readonly LabelledRelation[]): RelationGroup[] {
  const groups = new Map<string, RelationGroup>();
  for (const relation of relations) {
    const key = normalizeLabel(relation.label);
    let group = groups.get(key);
    if (!group) {
      group = { label: relation.label, relations: [] };
      groups.set(key, group);
    }
    group.relations.push(relation);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function isLabelledRelation(relation: Relation): relation is LabelledRelation {
  return relation.label !== null;
}

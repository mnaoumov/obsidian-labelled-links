import { WidgetType } from '@codemirror/view';

export class SampleWidget extends WidgetType {
  private readonly count: number;

  public constructor(count: number) {
    super();
    this.count = count;
  }

  public override eq(other: SampleWidget): boolean {
    return this.count === other.count;
  }

  public toDOM(): HTMLElement {
    const span = createSpan({
      cls: 'cm-sample-word-count',
      text: ` [${String(this.count)} words]`
    });
    return span;
  }
}

import type {
  Extension,
  Transaction
} from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import type { StateFieldSpec } from '@mnaoumov/obsidian-lib/codemirror/state-field-spec';

import {
  RangeSetBuilder,
  StateField
} from '@codemirror/state';
import {
  Decoration,
  EditorView
} from '@codemirror/view';

import { SampleWidget } from './sample-widget.ts';

class SampleStateField implements StateFieldSpec<DecorationSet> {
  public create(state: Transaction['state']): DecorationSet {
    return buildDecorations(state);
  }

  public provide(field: StateField<DecorationSet>): Extension {
    return EditorView.decorations.from(field);
  }

  public update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
    return transaction.docChanged ? buildDecorations(transaction.state) : oldState;
  }
}

function buildDecorations(state: Transaction['state']): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;

  for (let index = 1; index <= doc.lines; index++) {
    const line = doc.line(index);
    const words = line.text.trim().split(/\s+/).filter((w) => w.length > 0);

    if (words.length > 0) {
      builder.add(
        line.to,
        line.to,
        Decoration.widget({
          side: 1,
          widget: new SampleWidget(words.length)
        })
      );
    }
  }

  return builder.finish();
}

export const sampleStateField = StateField.define<DecorationSet>(new SampleStateField());

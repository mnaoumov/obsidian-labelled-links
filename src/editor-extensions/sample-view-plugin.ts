import type {
  DecorationSet,
  EditorView,
  PluginSpec,
  PluginValue,
  ViewUpdate
} from '@codemirror/view';

import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  ViewPlugin
} from '@codemirror/view';

import { SampleWidget } from './sample-widget.ts';

class SampleViewPlugin implements PluginValue {
  public decorations: DecorationSet;

  public constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  public update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    for (const { from, to } of view.visibleRanges) {
      const doc = view.state.doc;
      const startLine = doc.lineAt(from).number;
      const endLine = doc.lineAt(to).number;

      for (let index = startLine; index <= endLine; index++) {
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
    }

    return builder.finish();
  }
}

const pluginSpec: PluginSpec<SampleViewPlugin> = {
  decorations: (value: SampleViewPlugin) => value.decorations
};

export const sampleViewPlugin = ViewPlugin.fromClass(
  SampleViewPlugin,
  pluginSpec
);

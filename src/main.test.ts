import {
  describe,
  expect,
  it
} from 'vitest';

import Plugin from './main.ts';
import { Plugin as PluginClass } from './plugin.ts';

describe('main', () => {
  // Obsidian loads a plugin by instantiating the default export of `main.js`, so this re-export is the
  // One line of wiring the whole plugin hangs off.
  it('exports the plugin class as the default export Obsidian loads', () => {
    expect(Plugin).toBe(PluginClass);
  });
});

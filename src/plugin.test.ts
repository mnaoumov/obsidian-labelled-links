import { Plugin as ObsidianPlugin } from 'obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { Plugin } from './plugin.ts';

describe('LabelledLinks', () => {
  it('extends the Obsidian Plugin class', () => {
    expect(Plugin.prototype).toBeInstanceOf(ObsidianPlugin);
  });
});

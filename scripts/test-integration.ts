import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

// `integration-tests:desktop` and `integration-tests:android` are declared by
// `defineObsidianPluginVitestConfig` too, but they are deliberately not run here: the first drives a real
// Obsidian install and the second needs a provisioned Android emulator, so a freshly generated project
// Would fail its own `test:integration` on any machine that has neither. Add them once you have set those
// Up. Run them one at a time — the integration projects share a single Obsidian and a single device.
//
// `integration-tests:desktop-performance` is declared for every plugin as well, but it is left out for a different reason, and it stays out even once you have a desktop Obsidian set up.
// The reason is the fixture rather than the cost: a perf suite needs its own generated, populated vault, sized through env vars, and this aggregate's small temporary vault is the wrong one.
// The 600 s in their config is a timeout, not a duration — measured end to end, most perf suites finish in seconds, and only one that generates tens of thousands of notes takes minutes.
// No routine command runs them, so something else has to: run the dedicated `test:integration:desktop:performance` script on a periodic sweep, weekly for example, which is also how to reach them by hand.
// Adding them to this aggregate is drift, not a gap to close.
await wrapCliTask(async () => {
  await test({
    projects: ['integration-tests:no-app']
  });
  await test({
    projects: ['integration-tests:demo-vault']
  });
});

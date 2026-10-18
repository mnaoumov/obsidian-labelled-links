import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

// Desktop first, then Android: the Android leg boots an emulator, so running the two at once would compete for
// the machine while each one waits on a frame.
await wrapCliTask(async () => {
  await test({
    projects: ['capture-screenshots:desktop']
  });
  await test({
    projects: ['capture-screenshots:android']
  });
});

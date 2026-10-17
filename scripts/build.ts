import { build } from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { buildOptions } from './build-options.ts';

await wrapCliTask(() => build(buildOptions));

import { format } from '@mnaoumov/obsidian-dev-toolkit/formatters/dprint';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import process from 'node:process';

const [, , ...paths] = process.argv;

// TODO: Drop this filter once `@mnaoumov/typescript-dev-toolkit`'s `format` accepts an explicit path list that
// `dprint.json` excludes entirely. Today it hands the paths to `dprint fmt`, which exits with "No files found"
// For them, so the pre-commit hook refuses a commit whose only staged script is in the excluded `demo-vault/`.
const formattablePaths = paths.filter((path) => !path.replaceAll('\\', '/').startsWith('demo-vault/'));

if (paths.length === 0 || formattablePaths.length > 0) {
  await wrapCliTask(() => format({ paths: formattablePaths }));
}

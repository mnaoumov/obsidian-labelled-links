import { registerDemoVaultCoverageSuite } from '@mnaoumov/obsidian-dev-toolkit/demo-vault-coverage';
import { getRootFolder } from '@mnaoumov/typescript-dev-toolkit/root';
import process from 'node:process';

// Keeps the in-repo `demo-vault/` honest WITHOUT launching Obsidian. It enforces the authoring convention
// Every vault owes its readers: an `# H1` and a prose opener on every note, Markdown links rather than
// Wikilinks (which do not render on GitHub), no `[Docs]` line, every note reachable from `00 Start.md`,
// And an `.obsidian/app.json` that commits none of the settings obsidian-dev-toolkit injects at release time.
//
// `rootFolder` alone is enough for those. Once your settings surface settles, add a reflection spec so the
// Suite also fails when a setting is documented nowhere in the vault, or when a note names one that no
// Longer exists:
//
// registerDemoVaultCoverageSuite({
//   configInterfaces: [{ interfaceName: 'PluginSettings', sourcePath: 'src/plugin-settings.ts' }],
//   rootFolder: getRootFolder() ?? process.cwd()
// });
registerDemoVaultCoverageSuite({ rootFolder: getRootFolder() ?? process.cwd() });

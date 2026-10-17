import type { PopulateFilesParams } from 'obsidian-integration-testing';

import { CODE_SCRIPT_TOOLKIT_PLUGIN_ID } from '@mnaoumov/obsidian-dev-toolkit/demo-vault-buttons';
import { getRootFolder } from '@mnaoumov/typescript-dev-toolkit/root';
import { join } from 'node:path';
import process from 'node:process';
import { buildDemoVaultPopulate } from 'obsidian-integration-testing';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

// `CodeScript Toolkit` is what turns a ```code-button fence into a button, and its root-relative
// `require('/demoSetup.ts')` into a call. In real use the in-vault `demo-vault-helper` installs it from
// The community registry on first launch — a NETWORK step. Seeding the copy it already installed into the
// In-repo demo vault keeps this run hermetic and independent of that bootstrap, which is why the suite
// Needs `demo-vault/` opened in Obsidian once before it can run. See CONTRIBUTING.md.
const CODE_SCRIPT_TOOLKIT_SETTINGS = {
  invocableScriptsFolder: 'Invocables',
  modulesRoot: '_assets/CodeScriptToolkit',
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
};

function populate(): PopulateFilesParams {
  return buildDemoVaultPopulate({
    demoVaultPath: join(getRootFolder() ?? process.cwd(), 'demo-vault'),
    injectPlugins: [{
      data: CODE_SCRIPT_TOOLKIT_SETTINGS,
      // `demoSetup.ts` imports `@mnaoumov/obsidian-lib`, which `CodeScript Toolkit` serves only from 13.8.0, so an
      // older copy left installed in a warm checkout is re-downloaded rather than reused.
      minVersion: '13.8.0',
      pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID
    }]
  });
}

// Pre-populates the whole `demo-vault/` tree (plus the `CodeScript Toolkit` binary and its settings) before
// Obsidian opens, so the startup scan indexes every note in one pass. Used by
// `integration-tests:demo-vault`.
const { setup, teardown } = createSetup({
  enableCommunityPlugins: [CODE_SCRIPT_TOOLKIT_PLUGIN_ID],
  populate
});

export {
  setup,
  teardown
};

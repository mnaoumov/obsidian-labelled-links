import {
  getIntegrationTestPluginPopulate,
  OBSIDIAN_DEV_TOOLKIT_INTEGRATION_TEST_PLUGIN_ID
} from '@mnaoumov/obsidian-dev-toolkit/test-runners/integration-test-plugin';
import { getRootFolder } from '@mnaoumov/typescript-dev-toolkit/root';
import { join } from 'node:path';
import process from 'node:process';
import { buildDemoVaultPopulate } from 'obsidian-integration-testing';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

// The capture projects photograph the demo vault's own notes, so a re-capture shows what a reader who opens
// `demo-vault/` sees. `CodeScript Toolkit` is not injected: the shots open Alice and Bob, which carry no buttons,
// So it would add only a network step. The integration-test harness plugin is, because the registry shot sets
// The registry through `lib.configureCommunityPlugin`, as the demo vault's own button does.
const { setup, teardown } = createSetup({
  enableCommunityPlugins: [OBSIDIAN_DEV_TOOLKIT_INTEGRATION_TEST_PLUGIN_ID],
  populate: () => ({
    ...buildDemoVaultPopulate({ demoVaultPath: join(getRootFolder() ?? process.cwd(), 'demo-vault') }),
    ...getIntegrationTestPluginPopulate()
  })
});

export {
  setup,
  teardown
};

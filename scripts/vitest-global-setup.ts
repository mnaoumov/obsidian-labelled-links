/**
 * @file
 *
 * The global setup of the desktop and Android projects: `obsidian-integration-testing`'s own, plus
 * `@mnaoumov/obsidian-dev-toolkit`'s integration-test harness plugin, which makes the whole library reachable
 * as `lib.<helper>` inside an `evalInObsidian` closure. The API suite needs `lib.findPluginApi` from it, to
 * call this plugin's API through the plugin registry the way another plugin would.
 */

import {
  getIntegrationTestPluginPopulate,
  OBSIDIAN_DEV_TOOLKIT_INTEGRATION_TEST_PLUGIN_ID
} from '@mnaoumov/obsidian-dev-toolkit/test-runners/integration-test-plugin';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

export const { setup, teardown } = createSetup({
  enableCommunityPlugins: [OBSIDIAN_DEV_TOOLKIT_INTEGRATION_TEST_PLUGIN_ID],
  populate: () => getIntegrationTestPluginPopulate()
});

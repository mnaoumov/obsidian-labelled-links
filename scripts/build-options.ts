import type { ObsidianPluginDeploymentOptions } from '@mnaoumov/obsidian-dev-toolkit/bundlers/obsidian-plugin-build';
import type { ObsidianPluginFeatureOptions } from '@mnaoumov/obsidian-dev-toolkit/bundlers/obsidian-plugin-features';

/**
 * What obsidian-dev-toolkit builds this plugin with: its UI framework, how stylesheets are compiled, WebAssembly, and
 * how a development build is reloaded. Every bundler adapter takes the same options, so `build` and `dev` read this one
 * object whichever bundler runs them.
 */
export const buildOptions: ObsidianPluginDeploymentOptions & ObsidianPluginFeatureOptions = {
  reload: 'obsidian-cli',
  styles: {}
};

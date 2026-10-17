const MESSAGE = 'Single-file components are not compiled in unit tests. Render this component in an integration test instead.';

/**
 * The unit runner's stand-in for a `.svelte` / `.vue` single-file component.
 *
 * Compiling one is the bundler's job. The plugin that does it -- `esbuild-svelte`,
 * `@vitejs/plugin-vue`, `svelte-loader` and the rest -- is a dependency only of the bundler that was
 * chosen, and no unit test needs a rendered component anyway. So both test runners alias every
 * `.svelte` / `.vue` import to this module, which lets a test import the plugin's own code even when
 * that code's module graph reaches a component.
 *
 * It throws rather than returning an inert value: a test that really does try to render gets a sentence
 * saying why it cannot, instead of a component that silently does nothing.
 *
 * @throws Always.
 */
export default function frameworkComponentStub(): never {
  throw new Error(MESSAGE);
}

/**
 * Svelte's `mount`, stubbed -- see {@link unmount} for why this module stands in for the whole package
 * under jest.
 *
 * @throws Always.
 */
export function mount(): never {
  throw new Error(MESSAGE);
}

/**
 * Svelte's `unmount`, stubbed.
 *
 * Jest maps the whole `svelte` package here, not just the component: svelte reaches its own runtime
 * through Node subpath imports (`#client/constants`), and jest's ESM resolver hands back the types entry
 * for those, so every suite that loads svelte dies on "does not provide an export named 'COMMENT_NODE'".
 * Vitest resolves them correctly and gets the real package -- only the component is stubbed there.
 *
 * The two functions the generated view uses are the two that are stubbed. A view that imports something
 * else from `svelte` needs it added here, or its unit test will fail on the missing export.
 *
 * @throws Always.
 */
export function unmount(): never {
  throw new Error(MESSAGE);
}

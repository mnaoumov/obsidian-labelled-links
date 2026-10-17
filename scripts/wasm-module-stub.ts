/**
 * The unit runners' stand-in for a `.wasm` import.
 *
 * Neither runner can load one the way the bundler does, and each fails differently: vitest resolves a
 * `.wasm` through vite's own WebAssembly helper, which tries to `fetch` it from a URL that does not
 * exist outside a dev server, and jest has no transform for the extension at all. Meanwhile the emitted
 * `src/plugin.ts` reaches the module through `src/wasm/sample-command.ts`, so ANY unit test that imports
 * the plugin -- which the sample one does, deliberately -- pulls the `.wasm` into its module graph.
 *
 * So both runners send every `.wasm` import here, exactly as they send every `.svelte` / `.vue` import
 * to `framework-component-stub.ts`, and for the same reason: loading the real thing is the bundler's
 * job, and no unit test needs it.
 *
 * It throws rather than returning inert bytes. A unit test that really does want to run WebAssembly
 * should instantiate the module itself from `readFileSync`, and this sentence is what tells it so.
 *
 * @throws Always.
 */
export default function wasmModuleStub(): never {
  throw new Error('A `.wasm` import is not loaded in unit tests. Read the file and instantiate it directly if a test needs the real module.');
}

/**
 * @file
 *
 * Activates `@mnaoumov/obsidian-lib`'s augmentation of the `obsidian-integration-testing` `Lib` interface, so an
 * `evalInObsidian` closure can reach the whole library surface as `lib.<helper>`: `lib.findPluginApi`, which the
 * API suite looks this plugin's API up with, among them.
 *
 * The runtime side is registered by the `@mnaoumov/obsidian-dev-toolkit/integration-test-setup` endpoint; only the
 * types need this reference. A `compilerOptions.types` entry naming the same path does NOT work: it resolves
 * without complaint but never brings the augmentation into the program.
 */

/// <reference types="@mnaoumov/obsidian-lib/@types/obsidian-integration-testing" />

export {};

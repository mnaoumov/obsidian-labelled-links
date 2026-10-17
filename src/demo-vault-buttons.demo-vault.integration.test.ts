import { registerDemoVaultButtonSuite } from '@mnaoumov/obsidian-dev-toolkit/demo-vault-buttons';

// Clicks every `code-button` in `demo-vault/` against a real Obsidian. A button fails at CLICK time -- a
// Wrong `require('/demoSetup.ts')` path, or an API that changed shape under it -- so no other gate can
// Catch it: `lint:md` reads the markdown and the coverage suite checks the authoring conventions, and
// Neither executes anything.
//
// It needs the `CodeScript Toolkit` binary seeded into `demo-vault/.obsidian/plugins/`, which happens the
// First time you open `demo-vault/` in Obsidian. See CONTRIBUTING.md.
//
// Isolation: `npx vitest run --project integration-tests:demo-vault`.
registerDemoVaultButtonSuite();

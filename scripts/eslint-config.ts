import type { Linter } from 'eslint';

import { defineEslintConfigs } from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs(context) {
    return defineConfig(
      globalIgnores([
        // `defineEslintConfigs` ignores whatever `.gitignore` names, which already covers `main.js`,
        // `dist` and `node_modules`. These four it cannot: the three extensions are not TypeScript and so
        // Are governed by no config object of its own, and `demo-vault/` is COMMITTED, so it is in no
        // Ignore file. The demo scripts show unusual module and `require` styles on purpose; a linter that
        // "fixes" them breaks the lesson.
        '**/*.cjs',
        '**/*.js',
        '**/*.mjs',
        'demo-vault/**'
      ]),
      {
        files: context.allFiles(),
        rules: {
          // `process.env['BUILD']` is not a style choice. TypeScript's `noPropertyAccessFromIndexSignature`
          // — which `@tsconfig/strictest` turns on, and this preset inherits — REJECTS the dotted form on
          // An index signature, so the compiler and this rule disagree about the same line. The compiler
          // Wins, because its complaint is an error and this one is a preference. Biome's `useLiteralKeys`
          // Is turned off in `biome.jsonc` for exactly the same reason. The shared config sets
          // `dot-notation` only over `context.testFiles`, and only with the two class-property allowances,
          // So this clash is not handled upstream and has to be re-stated here.
          '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }]
        }
      },
      {
        // `moment` is banned for bundle size, which does not apply here: Obsidian bundles it and
        // Re-exports it, so it is imported from `'obsidian'` and the dependency exists only so
        // `moment.Duration` and friends type-check against the version the app actually runs. A no-op
        // Unless the project depends on it. Both file sets matter: the rule reads the dependency out of
        // `package.json` and the import out of the source.
        files: [...context.sourceFiles, 'package.json'],
        rules: {
          'depend/ban-dependencies': ['error', { allowed: ['moment'] }]
        }
      },
      {
        // Scoped to the source files, not to everything, because the rule comes from
        // `obsidianmd.configs.recommended` and the shared config scopes THAT to `context.sourceFiles`. A
        // Flat-config rule entry is resolved against the plugins in scope for the file it matches, so
        // Naming an obsidianmd rule over a wider set is not a wider check -- it is
        // "could not find plugin", and ESLint refuses to start.
        files: context.sourceFiles,
        rules: {
          'obsidianmd/ui/sentence-case': [
            'error',
            {
              brands: ['Labelled Links']
            }
          ]
        }
      },
      {
        // Files whose default export is dictated from outside, the way the shared config already exempts
        // The root configs and `src/main.ts`. An ambient `declare module` describes how a `.wasm`, a CSS
        // Module or a single-file component is imported, and each of those IS a default import. The two
        // Stubs stand in for such modules in the unit runners, and typesafe-i18n's generator reads each
        // Locale's default export.
        files: [
          '**/*.d.ts',
          'scripts/*-stub.ts',
          'src/i18n/*/index.ts'
        ],
        rules: {
          'import-x/no-default-export': 'off'
        }
      },
      {
        // Every rollup plugin is imported as `<name>Module` on purpose: its types describe the CommonJS
        // Shape, so `asPluginFactory` unwraps the import and the unwrapped binding takes the plugin's own
        // Name. Which plugins are imported depends on the answers, so an inline directive per import would
        // Have to be composed per answer. Named whether or not rollup was chosen, like the patterns above.
        files: ['scripts/rollup.config.ts'],
        rules: {
          'import-x/no-rename-default': 'off'
        }
      }
    );
  },
  editContext(context) {
    // The shared config's root-config list is the three a plugin built on the toolkit always has
    // (`commitlint.config.ts`, `eslint.config.mts`, `vitest.config.ts`). This project may also have a root
    // Wrapper for another runner, and a root `*.ts` that ESLint reaches but no config object matches is a
    // File linted with nothing. Named unconditionally: a glob matching no emitted file costs nothing, and
    // `tsconfig.json` includes `./*.ts` whichever of them was written.
    context.rootConfigFiles.push(
      'jest.config.ts',
      'vite.config.ts',
      'webpack.config.ts'
    );
  }
});

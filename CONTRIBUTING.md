# Contributing

Contributions are welcome! Here's how to get started.

## Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/obsidian-labelled-links/issues/new/choose), not as blank issues.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/obsidian-labelled-links/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the plugin version, the Obsidian version and your operating system.

## Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS recommended)
- npm (comes with Node.js)

## Setup

```bash
git clone https://github.com/mnaoumov/obsidian-labelled-links.git
cd obsidian-labelled-links
npm install
```

## Development Workflow

### Dev Mode

```bash
npm run dev
```

Copy `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` to your vault's `.obsidian/plugins/labelled-links/` directory, or set the `OBSIDIAN_CONFIG_FOLDER` variable in `.env` to auto-copy on build.

### Build

```bash
npm run build
```

### Available Scripts

- `npm run dev` — Build in watch mode for development
- `npm run build` — Production build
- `npm run version` — Bump version and update `manifest.json` / `versions.json`
- `npm run gate` — Run every check the release runs (format, spelling, Markdown, build, lint, tests), before committing
- `npm run lint` — Run linter
- `npm run format` — Format code
- `npm run spellcheck` — Check spelling
- `npm run lint:md` — Lint Markdown files
- `npm test` — Run tests (unit tests run against [`obsidian-test-mocks`](https://www.npmjs.com/package/obsidian-test-mocks); `.svelte` / `.vue` components are stubbed, so render them in an integration test instead)
- `npm run commit` — Commit with a guided Conventional Commits prompt

## Demo vault

`demo-vault/` is this plugin's documentation: a real Obsidian vault whose notes explain each feature and demonstrate it with `code-button`s that run TypeScript through [CodeScript Toolkit](https://github.com/mnaoumov/obsidian-codescript-toolkit). `npm run version` archives it into the GitHub release, injecting the freshly built plugin and the `demo-vault-helper` bootstrap plugin into the archived copy — so nothing plugin-related is committed under `demo-vault/.obsidian/plugins/`.

When you add a user-facing feature, add or update its note in the same change.

### One-time setup before the button suite can run

`npm run test:integration:demo-vault` opens a copy of `demo-vault/` in a real Obsidian and clicks every button in it. It needs the `CodeScript Toolkit` binary, which it copies out of your own `demo-vault/` to keep the run hermetic. Open `demo-vault/` in Obsidian once and let `demo-vault-helper` install `CodeScript Toolkit`; the installed copy is gitignored, so each machine does this for itself. Until then the suite fails with a message telling you exactly this.

### Checking the vault

- `npm run test:integration:no-app` — the coverage suite. Reads the notes without launching Obsidian and enforces the authoring rules: an `# H1` and a prose opener per note, Markdown links rather than wikilinks, no `[Docs]` line, every note reachable from `00 Start.md`.
- `npm run test:integration:demo-vault` — the button suite. A button fails at click time, so this is the only gate that can catch a broken one.

## Configuration

This project was scaffolded with [`create-obsidian-plugin`](https://github.com/mnaoumov/create-obsidian-plugin). Run `npx @mnaoumov/create-obsidian-plugin` again in the project directory to update configuration.

## Pull Requests

- Ensure the checks the project defines above still pass.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for your commit messages.

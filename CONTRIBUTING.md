# Contributing to hiperbrain

Thanks for your interest in improving hiperbrain. This guide covers local setup,
the test and lint workflow, and — importantly — how releases of the
`@hiperbrain/core` package work, so your change actually ships.

## Project layout

This is an npm-workspaces monorepo:

- **`/`** — the Next.js website + API (`app/`, `components/`, `lib/`).
- **`packages/core`** — the published, dependency-free HDC engine
  (`@hiperbrain/core`). The website imports it like any other consumer.

## Prerequisites

- **Node 20+** (matches CI) and npm 10+.

## Setup

```bash
npm install          # installs root + workspace deps and links @hiperbrain/core
cp .env.example .env.local   # then fill in your own values (see comments inside)
npm run dev          # builds the core package, then starts Next.js
```

The app runs **without** any env vars in a degraded local mode: facts are kept
in an in-memory store and the token/credits features are disabled until the
relevant vars are set. See `.env.example` for what each variable does.

## Day-to-day commands

```bash
npm run dev          # build core + run the website locally
npm run build        # production build (also builds core first)
npm run lint         # eslint across the repo
npm test             # run the website/lib test suite (vitest)
npm run test:core    # run the @hiperbrain/core test suite
npm run build:core   # build just the core package
```

Please make sure `npm run lint` and the test suites pass before opening a PR.

## Code style

- TypeScript everywhere; keep the core package **dependency-free**.
- An `.editorconfig` and a Prettier config are included — most editors pick them
  up automatically. Don't reformat unrelated lines in your diff.
- Comments should explain *why*, not narrate *what* the code does.

## Releasing `@hiperbrain/core` — you must add a changeset

Publishing is automated: on every push to `master`, the Release workflow runs
`changeset version` (bumps the version + updates the changelog) and then
`changeset publish` (publishes to npm). **If your change touches
`packages/core` and there is no changeset, nothing gets published.**

So whenever you change the published package, add a changeset:

```bash
npm run changeset
```

Pick the bump level:

- **patch** — bug fix, no API change.
- **minor** — new, backwards-compatible feature.
- **major** — a breaking change to the public API.

Commit the generated file in `.changeset/` along with your change. Changes that
only touch the website/API (not `packages/core`) do **not** need a changeset.

## Commit & PR conventions

- Use short, conventional-style prefixes in commit subjects: `feat:`, `fix:`,
  `docs:`, `chore:`, `ci:`, `refactor:`, `test:`.
- Keep PRs focused; describe the change and how you tested it (the PR template
  will prompt you).
- Link any related issue.

## Reporting bugs / requesting features

Use the issue templates under **New issue**. For anything security-related, do
**not** open a public issue — follow [`SECURITY.md`](SECURITY.md) instead.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).

---
name: tooling
description: Tooling and process conventions for Autodoc MFEs - ESLint flat config baseline, prettier settings, build scripts, package manager, locale codegen workflow, CI/branch model, and the testing gap. Use when configuring lint/format/build, adding scripts, touching CI workflows, releasing, or when the user says "configurar eslint", "prettier", "script de build", "workflow", "release", "criar branch", "rodar testes", "lint", "CI", "setup the repo".
---

# Tooling & process

## Package manager

**Yarn** (team decision). The `clean`/`cir` scripts and all CI workflows assume it; a repo on pnpm with yarn scripts is a known inconsistency to fix, not imitate.

## ESLint (flat config, ESLint 9)

**Rule:** `eslint.config.mjs` = js recommended + `tseslint.configs.recommended` + `pluginReact.configs.flat.recommended` + `eslint-config-prettier`, plus exactly these deliberate overrides:
- `'prettier/prettier': ['error', { singleQuote: true, semi: true, trailingComma: 'all', bracketSameLine: false, htmlWhitespaceSensitivity: 'ignore', endOfLine: 'auto' }]` — formatting IS a lint error; there is no separate format gate;
- `'react/self-closing-comp': ['error', { component: true, html: true }]`;
- `'react/no-children-prop': ['error', { allowFunctions: true }]` — exists FOR the TanStack Form `children={(field) => ...}` render prop; element children as a prop are still banned;
- `'react/react-in-jsx-scope': 'off'` — babel automatic JSX runtime; don't add `import React`;
- `'@typescript-eslint/no-require-imports': 'off'` — for the CommonJS codegen scripts.

**Recommended addition** (gap the references regressed on — every legacy repo has it): `eslint-plugin-react-hooks` with `exhaustive-deps: 'error'`.

Lint scripts under flat config take no `--ext` flag: `"lint": "eslint src/"` (the references carry a stale `--ext` from the eslintrc era — drop it).

## Prettier

`printWidth: 120` (team decision) in ONE `.prettierrc`; delete any duplicate `.prettierrc.json` (stale template remnant in the references). `endOfLine: 'auto'` + `.gitattributes` `* text=auto` + `.editorconfig` (LF, UTF-8, 2-space) = the Windows-first line-ending compromise: git stores LF, Windows checkouts run CRLF, prettier doesn't fight it.

## Scripts vocabulary

```json
"start": "webpack-dev-server --config config/webpack.config.js --port=<slot>",
"dev":   "(alias of start)",
"build": "webpack --config config/webpack.prod.js --mode=production",
"lint":  "eslint src/",  "lint:fix": "eslint src/ --fix",
"format": "prettier --write \"src/**/*.{js,jsx,ts,tsx,css,md}\"",
"format:file": "prettier --write",
"clean": "powershell Remove-Item -Recurse -Force .\\node_modules; Remove-Item -Force .\\yarn.lock;",
"cir":   "(clean + yarn + yarn dev)"
```
`build` MUST point at `webpack.prod.js` (a reference points at the dev config and CI ships unminified bundles — known defect). Windows-first environment: scripts shell out to PowerShell; keep generated scripts Windows-compatible.

## Production build recipe

`webpack.prod.js` = `mode: 'production'`, `devtool: 'source-map'` (external maps), `optimization: { minimize: true, minimizer: ['...', new CssMinimizerPlugin()], removeAvailableModules: true, removeEmptyChunks: true }`; `CompressionPlugin()` (default gzip) in common. Verify `css-minimizer-webpack-plugin` is actually in devDependencies. Dev config differs only in mode/devtool/topLevelAwait.

## Dates

dayjs with an explicit shared plugin bootstrap file (`utils/date/bootstrap.ts`: customParseFormat, advancedFormat, weekday, localeData, weekOfYear, weekYear + `pt-br` locale). No moment in new code (one reference bundles full moment for a single locale-sync line — dead weight; map i18n language → dayjs locale instead).

## Locale workflow

After editing the pt-Br locale JSON: run `scripts/genTranslationsType.ts` MANUALLY and commit the regenerated `src/locale/translationsKeyType.ts` (it is not a build step). New keys type-error until you do — that's the mechanism working (see `typescript-conventions`).

## Env

`.env` gitignored; `env.example` documents the contract (typically just `PUBLIC_PATH`). Webpack loads it twice on purpose: `require('dotenv').config()` at config-eval time + `new Dotenv({ safe: false })` plugin for app-code inlining.

## Git hooks

None exist in the reference setup — no husky/lint-staged; discipline = `lint:fix` + CI. Adding pre-commit hooks is a team decision, not something to bolt on silently.

## CI & branch model (recognition-level — workflows are platform templates)

Every MFE carries the same ~20-workflow set, most headed "generic — do NOT modify" (only `group_deploy` is marked adaptable). Taxonomy by prefix: `manual_new_*` (dispatch entry points that CREATE branches), `auto_*` (push/PR automation), `group_*` (orchestrators), `specific_*` (atomic units).

- Branches are created BY CI: `manual_new_feature` → `feature/<name>` off develop; `manual_new_release` → `release/<next-semver>` computed by semver-action from conventional-commit prefixes — **`feat` and `chore` are MINOR bumps; `fix`/`perf`/`refactor`/`test` are patches** — so conventional commit messages are load-bearing (no commitlint enforces them; write them correctly);
- Release/hotfix PRs are auto-mirrored to BOTH main and develop, gated by a `git merge --no-ff` simulation;
- Push to develop → staging (version suffixed `-<sha>`); push to main → production;
- PR preview environments via the `provisioning` label (terraform per-branch; teardown on close);
- Known holes (don't rely on them): no workflow creates git tags or changelogs despite the hotfix flow READING tags; `group_test.yml` is an `if: false` stub; the only live quality gate is super-linter on changed files.

## Testing — the honest gap

**The reference architecture has NO testing convention.** No test files, no jest config, CI runs zero tests; a jest+SonarCloud intent was scaffolded (2025-10) and dismantled (2026-01). Do not invent a convention and attribute it to the codebase; do not present the orphaned Sonar workflows as live CI. If asked to write tests anyway: the only in-house precedent is small RTL component unit tests in the legacy mf-projetos (jest + ts-jest + RTL, `__mocks__/` for `@apis`), which predates this stack — say so, and flag that mocking TanStack Query/zustand/PUM here has no established pattern yet.

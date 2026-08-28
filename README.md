# autodoc-frontend

Claude Code plugin carrying the frontend standards of Autodoc's micro-frontend platform, extracted from the reference repositories **mf-workforce** (`af85e4a`) and **mf-adm** (`82d4f32`) — the team's quality benchmarks. It teaches agents to write NEW code the way those repos do, without requiring anyone to have read them.

## What's inside

| Skill | Covers |
|---|---|
| `design-system` | Consuming `@autodocdev/autodoc-ui`: runtime enumeration (never assume a component exists), consume/extend/create decision rule, slot props, theme tokens, sanctioned antd escapes |
| `data-fetching` | TanStack Query 5: query-module triple export, router-loader prefetch, keys, staleTime, mutations & invalidation |
| `state-management` | State ownership: query cache / URL / zustand / useState / platform session (PUM) |
| `project-structure` | `@`-folders, aliases, layering, views colocation, models, routes skeleton, naming canon |
| `forms` | TanStack Form kit: `createFormHook`, field contract, Subscribe gating, validators, unsaved-changes guard |
| `mfe-platform` | single-spa contract: registration, `singleSpa.js`, externals, PUBLIC_PATH, session module, deploy model |
| `components` | Modal/drawer/notification contracts, Typography layer, column factories, styling boundary |
| `ux-states` | Loading levels, error taxonomy, empty states, authorization flow |
| `typescript-conventions` | Rigor split, envelope + type guard, literal unions, typed i18n, external `.d.ts` |
| `hooks` | Custom-hook conventions, effect taxonomy, memoization calibration, missing react-hooks lint |
| `tooling` | ESLint/prettier baseline, build recipe, scripts, locale codegen, CI model, testing gap |
| `feature-workflow` | Layer order for any multi-layer change (models → API → query → forms → UI → i18n → verify) |
| `create-list-view` | Full recipe: list page with URL filters, counters, table, empty states, cache updates |
| `create-detail-edit-view` | Full recipe: detail/edit shell with module nav + child form routes |
| `commit-messages` | Conventional Commits — with the CI semver mapping warning (`chore` bumps MINOR here) |
| `grill-me` | Plan stress-test interview before non-trivial features |
| `react-performance` | Curated Vercel react-best-practices (Next/SSR rules removed; house calibration wins) |

Plus `scripts/enumerate-ds.mjs` (runtime DS enumeration), `agents/pr-review` (convention-specific PR review), and `skills/data-fetching/searchcriteria-api.md` (the new workforce API contract).

v0.2 incorporates the team's `.ai/` boilerplate (mf-workforce `chore/ai-boilerplate` branch): feature workflows, the searchCriteria filter system, newer query/mutation conventions, and operational detail for icons/imports/translations. Mapping and open conflicts: `extracao/findings/06-v02-mapeamento.md` in the extraction workspace.

## Installation

The repo is private — your own GitHub credentials (`gh auth login` or SSH) are used to clone it; you need read access.

```
# Once:
/plugin marketplace add bbdiv/autodoc-frontend-plugin
# Then:
/plugin install autodoc-frontend@autodoc-plugins

# Local development / trial (no install; run from a clone of this repo)
claude --plugin-dir .
```

Note for private-repo auto-updates over HTTPS: background marketplace refresh runs without git credential helpers, so updates may fail silently — prefer SSH remotes, or run `gh auth setup-git`. Installing and manual updates work either way.

## Ground rules baked into every skill

- Patterns come from real code in the reference repos; every rule cites its origin (`repo/path:line` at extraction time).
- Where the reference repos disagreed, the recorded team decisions apply (see `extracao/findings/99-conflitos.md` and `03-consolidacao.md` §C in the extraction workspace).
- Reference commits: `mf-workforce @ af85e4a`, `mf-adm @ 82d4f32`. If those repos have moved significantly, re-validate before trusting line numbers.

## Known follow-ups

- The reference repos ship no testing convention; the `tooling` skill states that gap explicitly instead of inventing one.

## Script validation status

`scripts/enumerate-ds.mjs` smoke-tested against a REAL published install (`@autodocdev/autodoc-ui@0.2.11` in mf-projetos, 2026-08-28): 50 values + 26 types enumerated correctly. Note learned from the real dist: the published `dist/main.d.ts` is a stub (`export * from './autodoc-ui/main'`) — the script follows `export *` chains recursively. Synthetic fixtures also cover fallback 1 (parsing `main.js`, incl. Rollup local exports and star chains), fallback 2 (hard fail with the never-assume instruction) and the not-installed path.

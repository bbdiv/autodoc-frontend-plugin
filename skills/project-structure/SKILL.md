---
name: project-structure
description: Folder architecture and naming canon for Autodoc MFEs - the @-prefixed infra folders, path aliases, import layering (views to @query to @apis to @axios), views colocation, @models organization, routes skeleton. Use when creating files or folders, starting a feature, organizing imports, or when the user says "onde coloco esse arquivo", "criar uma view", "estrutura de pastas", "criar um model", "adicionar rota", "where does this file go", "create a new page/view/route/model", "project structure", "imports".
---

# Project structure

## Folder skeleton

`@`-prefixed folders = cross-cutting infrastructure; plain folders = app content:

```
src/
├── @apis/        # API layer: <backend>/<entity>/index.ts
├── @axios/       # instance factories + interceptors
├── @form/        # form kit + formFields/ (see forms skill)
├── @hook/        # custom hooks (naming canon: @hook, singular, WITH @)
├── @icons/       # the single icon barrel
├── @models/      # types per domain entity
├── @query/       # index.ts = QueryClient; queries/<backend>/; mutation/<entity>/
├── @store/       # zustand stores
├── components/   # shared UI: numbered groups + PascalCase one-offs
├── locale/       # i18n + generated translationsKeyType.ts
├── routes/       # route tree + loaders + buildRoute + ErrorBoundary + RootWrapper
├── styles/       # app-global styling only
├── utils/
├── views/        # one folder per page
├── App.tsx       # providers + session gate (naming canon: App.tsx)
└── index.tsx     # single-spa lifecycles only
```

Naming canon (team decisions, resolving reference divergences): `@hook/`, `@query/queries/`, PascalCase view folders, `App.tsx`, locale under `locale/translations/<lang>/`.

## Aliases and imports

**Rule:** One root alias to `src/` (`@<mfe>/*`, e.g. `@workforce/*`) + `@components/*` + the `@icons` FILE alias — and nothing else (the minimal set; a reference declared 14 aliases of which 9 were unused and 2 broken).

**Rule:** Every alias is declared TWICE with identical targets: tsconfig `compilerOptions.paths` (type checker) and webpack `resolve.alias` (bundler). Nothing syncs them — an alias in only one place type-checks but fails at build. Any alias change touches both files.

**Rule:** Import everything outside the current feature folder through the root alias (`@workforce/@query/...`); `./` only for colocated files; `../` only for a sibling inside the same group; never climb more than two levels.

**Rule:** No re-export barrels. The only root `index.ts` files that exist have a JOB: QueryClient singleton, form kit factory, icons barrel, API facade. Import every other module by full path.

### Import order (manual — no tooling enforces it; apply on every file you touch)

Group order, ONE blank line between groups, alphabetical by module path inside each group, no unused imports:

1. React core + ecosystem (`react`, `react-router-dom`, `react-i18next`, `@tanstack/*`)
2. External packages (`@autodocdev/autodoc-ui`, `mf-platform-utility-module`, `antd`, `lodash`)
3. `@icons`
4. Internal root-alias imports — WITH SUB-GROUPS (blank line) whenever the first segment after the root alias changes: `@workforce/@form` | `@workforce/@hook/*` | `@workforce/@query/*` | `@workforce/@models/*` | `@workforce/components/*` | `@workforce/routes/*` | ... Never one solid block, even in all-internal files.
5. Relative imports (`./`, `../`) last.

```ts
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, LayoutCard, Table } from '@autodocdev/autodoc-ui';
import { useSession } from 'mf-platform-utility-module';

import { MdAddCircleOutline } from '@icons';

import useTypedTranslation from '@workforce/@hook/useTypedTranslation';

import useGetUsers from '@workforce/@query/queries/workforce/useGetUsers';

import IUsersListFilters from '@workforce/@models/user/IUsersListFilters';

import MainLayout from '@workforce/components/Layout/MainLayout';
import NavigationBar from '@workforce/components/NavigationBar';

import { userListRoutes } from '@workforce/routes/buildRoute';

import Header from './Header';
```

## Layering (enforced by discipline — no lint checks it)

**Rule:** views/components/hooks → `@query` → `@apis` → `@axios`. UI code NEVER imports `@apis` or `@axios` directly — that bypasses the cache and the loader/hook shared-config contract. (The one reference with violations is also the one whose submit path rotted — see `data-fetching`.)

## `views/` — one folder per page, colocated everything

```
views/ListUsers/
├── index.tsx                 # the page component
├── getUsersListColumns.tsx   # column factory (see components skill)
├── ListUserLoading.tsx       # route hydrateFallbackElement skeleton
├── NoUsers.tsx               # empty state
├── CountersSection/{index.tsx, styled.ts}
└── Header/{index.tsx, styled.ts}
```

Anything only this page uses stays here; promoting single-consumer parts to `components/` obscures ownership. Nested sub-pages nest as folders (`JobFunctions/jobFunctionsEditor/`). Folder-as-component: the folder is the name, `index.tsx` is the implementation (not a barrel), `styled.ts` sits beside it when styles outgrow inline.

## `components/` — numbered groups for shared primitives

`01_modals`, `02_tooltip`, `03_notification`, `05_menu`, `06_select`, `07_drawers`, `08_popovers` — numbers are stable category IDs (04 never existed; don't renumber), one folder per concrete component inside. Singular app-level components (`NavigationBar`, `Typography`, `RootLoading`, layout) are PascalCase folders at `components/` root. Never numbered groups inside `views/`.

## `@models/` — one entity folder, one interface per file

**Rule:** `@models/<entity>/<IName>.ts`, `I`-prefixed domain types (the `I` marks "business data crossing the API boundary" — applies to type aliases too), main interface default-exported, secondary shapes as named `export type`. Full-path imports, no `@models` barrel. Single-interface domains may define directly in `<entity>/index.ts`; between model files use relative imports (`../companies`). Models are pure data shapes — never functions or logic.

```ts
// @models/user/IUser.ts
export default IUser;
export type { IUserInfo, IActionMeta, IUserAccessLevel };
```

Component props interfaces are `<Name>Props` WITHOUT the `I` (team decision — reserve `I` for domain models).

## `routes/` — five-part skeleton

```
routes/
├── index.tsx          # ONE route tree: createRoutesFromElements(<Route element={<RootWrapper/>} ErrorBoundary={ErrorBoundary} ...>)
├── buildRoute/        # route-object modules (below)
├── loaders/           # one file per loader
├── ErrorBoundary/
└── RootWrapper/       # + pageLoadersConfig.tsx (see ux-states)
```

**Rule:** For every route family export a route object from `buildRoute/`: `base` (path prefix), `match(path)` (regex for menu highlighting), and builder functions (`editor(id?)` defaulting `'new'`). ALL navigation goes through these — no path string literals at call sites. Derive everything from the single `baseRoute` constant (the MFE's shell-assigned URL prefix — see `mfe-platform`).

```ts
export const jobFunctionsRoutes = {
  base: `/${baseRoute}/${settingsRoute}/job-functions`,
  match: (path) => new RegExp(`^${jobFunctionsRoutes.base}/(?:\\d+|new)(?:/[^/]+)*$`).test(path),
  editor: (id?: string) => `${jobFunctionsRoutes.base}/${id ?? 'new'}`,
};
```

## `src/index.tsx` — single-spa entry, nothing else

Only the `singleSpaReact({...})` call and `export const { bootstrap, mount, unmount }`. Providers, session gating and `RouterProvider` live one level down in `App.tsx` (I18next → QueryClientProvider → ThemeProvider → session gate → router). See `mfe-platform` for the build-side contract.

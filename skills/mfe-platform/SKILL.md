---
name: mfe-platform
description: The single-spa platform contract for Autodoc micro frontends - registration in mf-root-config, the singleSpa.js artifact, webpack externals vs bundled deps, PUBLIC_PATH, dev ports, session/auth via mf-platform-utility-module, inter-MFE communication, deploy model. Use when creating or configuring an MFE, touching webpack config, adding a dependency that might be shared, integrating with the shell/session/auth, or when the user says "criar um MFE", "registrar no root-config", "external", "import map", "deploy do MFE", "sessão", "autenticação", "new micro frontend", "webpack", "single-spa".
---

# Micro-frontend platform contract

Two kinds of rule here: **what your MFE must do**, and **what the platform already provides — consume, don't reimplement**.

## New-MFE checklist

1. Repo skeleton + naming canon → `project-structure`; scripts/lint/prettier → `tooling`.
2. `src/index.tsx` lifecycles + webpack contract (entry `singleSpa`, UMD `register`, externals, `PUBLIC_PATH`) → this skill, below.
3. Pin exact: `react`/`react-dom` `18.2.0` (import-map version); bundle antd 5 + `@autodocdev/autodoc-ui` (exact pin, see `design-system`) + react-router-dom 7 + TanStack Query/Form + zustand + styled-components 6 + axios + i18next + dayjs.
4. `types/*.d.ts` for the externals; `App.tsx` providers (I18next → QueryClientProvider → ThemeProvider → session gate → RouterProvider).
5. Register in `mf-root-config` (3 entries, below) + claim a dev-port slot.
6. `iac/` + workflow set copied from an existing MFE; `env.example` with `PUBLIC_PATH`.

## Registration (platform-provided; the MFE only exports lifecycles)

The shell (`mf-root-config`) owns activation. A new MFE needs THREE entries there — none alone suffices:
1. Imperative registration in `registerApps.js`: `registerApplication({ name, activeWhen: (l) => l.pathname.startsWith('/<prefix>'), app: () => global.System.import(name) })`;
2. A `<route path="..."><application name="..."/></route>` in the single-spa-layout template (`index.html`) — this also controls DOM placement;
3. A local-dev import-map entry pointing at `http://localhost:<port>/singleSpa.js`.

The MFE itself only exports lifecycles from `src/index.tsx`:
```tsx
const lc = singleSpaReact({ React, ReactDOMClient, rootComponent: App,
  errorBoundary(err, info, props) { return <BrandedErrorFallback />; },  // never ship the raw err/stack
  renderType: 'createRoot' });
export const { bootstrap, mount, unmount } = lc;
```

## The build artifact: `singleSpa.js`

**Rule:** webpack entry key literally `singleSpa`, `output: { filename: '[name].js', libraryTarget: 'umd', library: 'register', publicPath: PUBLIC_PATH }`. The artifact NAME is a platform contract in three places (local import map, CloudFront `default_root_object`, the utility module's vite parity) — not a free choice.

## Externals: exactly what the import map serves

**Rule:** `externals: ['react', 'react-dom', 'single-spa', 'mf-style-guide', 'styled-components', 'mf-platform-utility-module']` — and BUNDLE everything else (antd 5, @autodocdev/autodoc-ui, react-router-dom 7, TanStack, zustand, axios, i18next, dayjs). The references deliberately shrank the externals list to escape frozen CDN versions (legacy repos externalizing antd/router are stuck on antd 4 / rrd 6).

**Rule:** Before externalizing ANYTHING, check the version the shell's import map actually serves and pin your compile-time dependency to it exactly (react `18.2.0`, no caret). A known incident: MFEs compiled against styled-components 6 while the import map served 5.3.5 — works until a v6-only API is used, then breaks at runtime with no build error. Externalizing a new shared dep is a platform decision, not a repo decision.

`mf-style-guide` is the legacy predecessor of autodoc-ui/PUM: KEEP it in externals (removing breaks legacy load order) but write NO new imports from it.

## Type the externals locally

**Rule:** Every import-map-resolved module gets a hand-written `declare module '<name>'` in repo-root `types/` (included via tsconfig `"include": ["src", "types/**/*", ...]`). PUM's package.json name is literally `"teste"` — the consumer's `.d.ts` is the only typing it gets. Also `types/global.d.ts` for shell-injected `window.autodoc` globals. (Ship the FIXED styled.d.ts theme augmentation — see `typescript-conventions`.)

## PUBLIC_PATH, ports, no standalone

- **Rule:** `output.publicPath` from `process.env.PUBLIC_PATH` (dotenv locally, CI variable in builds); document it in `env.example`. The import map delivers only `singleSpa.js`; every chunk/image resolves against publicPath — hardcoding it ships localhost URLs to production.
- **Rule:** Each MFE owns a fixed dev-port slot matching the shell's local import map (login 3001, rdo 3002, suite 3003, projetos 3007, adm 3010, PUM 3015...); the devServer sends permissive CORS headers (shell page origin ≠ MFE origin). Against a DEPLOYED shell, use import-map-overrides (localStorage key `devtools`).
- **Rule:** No standalone mode — no HtmlWebpackPlugin, no `#root` render. The MFE only runs inside the shell (externals + session only exist there).

## Route prefix

**Rule:** The shell assigns your URL prefix via `activeWhen`. Declare it ONCE (`export const baseRoute = 'adm';` in `routes/buildRoute/`) and derive every path — route tree, route objects, ErrorBoundary home, unauthorized redirect — from it. Repeated string literals are what makes a slot move expensive.

## Session & auth: `mf-platform-utility-module` (PUM) — consume, don't reimplement

PUM is a utility module (no UI) the shell imports at boot; one instance per page = every MFE sees the same login/customer switch. Surface:

- **Read:** `useSession()` → `{ userAccount, userData, selectedCustomer, selectedConstruction, isFetching*, haveInitialized }` (components); `persistor.get/getWithMeta<T>/setItem/removeItem` (IndexedDB, staleness metadata) for loaders/non-React. `useAuth()` for tokens.
- **Write (only via module functions):** `saveSelectedCustomer(customer)`, `saveSelectedConstruction(...)`, `logout()` (SSO logout + full browser-data wipe).
- **Auth token contract:** PUM writes `accessToken`/`refreshToken`/`idToken` cookies on the apex domain. Your axios request interceptor reads `getCookie('idToken')` → `Authorization: Bearer <idToken>`. 401 refresh/retry lives ONLY in PUM — delegate (call its `refreshToken`), never hand-roll; and never leave a log-only 401 handler.
- Hooks self-initialize (dedup'd `initSession`). Gate app render until session exists (see `ux-states`).

## Inter-MFE communication

**Rule:** New code communicates between MFEs ONLY through PUM (stores + persistor + service functions). Recognize but do not use: `handleTopbarInfo` CustomEvents (legacy bridge), `window.autodoc.*` globals (legacy; the shell still writes them), the shell's internal eev bus (never MFE-facing), reads of another MFE's `single-spa-application:<name>` container DOM (couples you to the shell layout — observe your OWN elements via marker classes instead).

**Cross-MFE navigation:** inside your own prefix, react-router `navigate`. To another MFE, the references do a full page load (`window.location.href = '/adm'`) — clean state reset; each MFE bundles its own router, so router navigation cannot cross apps. (`window.autodoc.navigateToUrl` soft navigation exists platform-side; the team has not adopted it for new code — flag before using.)

## Styling isolation

**Rule:** styled-components stays external (single instance page-wide). Stamp your structural DOM with kebab marker classes `mf-<name>-<part>` via `styled.div.attrs({ className: 'mf-adm-main-layout' })` — the deliberate, stable handles for ResizeObserver/e2e/cross-cutting code (hashed classnames are unstable). There is NO other CSS isolation: plain `.css` is global — don't add any that targets lib internals (see `design-system`).

## Topbar

The dedicated topbar/sidebar MFEs were removed; each MFE renders its own via the `TopbarWrapper` **shared-by-copy** component (wraps DS `TopBar` + PUM session/logout). Its header lists every repo holding a copy — edit ALL copies together, and copy only from a repo on your same DS 0.x line (TopBar was reworked in DS 0.2.11).

## Deploy & versioning (platform-provided pipeline)

Each MFE repo carries `iac/` (terraform: s3+cloudfront+r53+acm, tfvars per env) and the standard workflow set. Deploy = build → `aws s3 cp dist/` → CloudFront invalidation. The production import map is GENERATED (root-config sweeps `mf-*` distributions; the bucket/distribution name IS the registration key) — never hand-write import-map URLs. Latest-wins, no versioned URLs: rollback = redeploy an older build. Build script must point at `webpack.prod.js` (see `tooling`).

---
name: ux-states
description: Loading, error, empty and unauthorized states in Autodoc MFEs - the three loading levels, error boundary ladder, error-feedback taxonomy (notification vs helperText vs modal vs boundary), empty-state discrimination, rights/authorization flow. Use when handling loading/error/empty UI or permissions - "tela de loading", "skeleton", "tratamento de erro", "estado vazio", "empty state", "error boundary", "página não encontrada", "permissão", "unauthorized", "loading state", "error handling", "spinner".
---

# UX states: loading, errors, empty, unauthorized

## The full flow (memorize this map)

1. MFE mounts, session not hydrated → **RootLoading** full-viewport spinner.
2. Route navigation → **router-level skeletons** (`hydrateFallbackElement` + `pageLoadersConfig`).
3. Loader lacks a right → **redirect to unauthorized** before data loads.
4. Loader/render throws → **route ErrorBoundary** page.
5. Query resolves 200-with-error body → **normalized to empty data** (silent; view shows its empty state).
6. Query rejects after retries → data stays `undefined`; table renders empty via `?? []`. No toast for read failures — ever.
7. In-page refetch (filter change) → `loading={isLoading}` on the Table / skeleton fan-out on grids.
8. Mutation pending → buttons disabled (`isPending` + form `isSubmitting`).
9. Mutation settles → **named notification function** in onSuccess/onError.
10. Data empty → **empty-state discrimination** (true-empty vs filtered-empty).

## Loading — three levels, never mixed

- **App gates** (session hydration, rights query): `RootLoading` — the one centered 48px spinner component — with `style={{ height: '100vh' }}`. Used ONLY when no layout is known yet:
```tsx
if (blockApp) return <RootLoading style={{ height: '100vh' }} />;
```
- **Route transitions:** every data route pairs `loader` + `hydrateFallbackElement={<ViewLoading />}`; the RootWrapper renders a section skeleton from `pageLoadersConfig` while `useNavigation().state === 'loading'` instead of `<Outlet/>`. `shouldRevalidate` suppresses loader re-runs on same-path query-param changes.
- **In-page:** the query's `isLoading` into the Table's `loading` prop; card grids render a fixed fan-out `Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)`.

Skeletons preserve the page's shape (see `components`); the spinner appears only where no shape exists yet.

## Errors — the crash walls

**Rule:** Two boundaries, both mandatory: the `errorBoundary` option in `singleSpaReact` (last wall — branded fallback, NEVER the raw `err`), and ONE root-route `ErrorBoundary` component using the `isRouteErrorResponse` ladder:

- 404 → "page not found" copy + a single recovery button navigating to the MFE home — **derived from `baseRoute`**, never a hardcoded path;
- other status → `{status} {statusText}` + detail, no button;
- `Error` instance → friendly message; log the stack, **do not render `<pre>{error.stack}</pre>` to users** (the reference does — known defect, don't copy);
- fallback → "unknown error".

All branches render inside `MainLayout` (the shell survives the crash) and ALL strings go through i18n.

## Error-feedback taxonomy — one channel per failure class

| Failure class | Channel |
|---|---|
| Mutation failed/succeeded (user-initiated write) | named notification function in call-site `onError`/`onSuccess` + `console.error` of the raw error |
| Invalid field input | inline `visualState="error"` + `helperText` from validators — never a toast |
| About-to-do-something-impactful | conditionally mounted CONFIRMATION MODAL before the mutation fires (e.g. update touching `employee_count > 0` → open modal and `return`; the modal's `onOk` runs the mutation) |
| Read/query failure | silent: normalized empty data or the boundary; tagged console log only |
| Loader/render crash | the ErrorBoundary page |

The boundary is *who acts on it*: toasts report an action's outcome; helperText fixes input pre-submit; modals ask consent; the boundary catches the unanticipated. Reads have no user action to report on — they degrade to empty UI.

## Empty states

**Rule:** A list view has TWO empty states: view-specific `No<Entity>` (illustration + CTA to create the first entity) for true-empty, and the shared `EmptyWhenFilterTable` ("try other words / remove filters") injected as the Table's body slot (`components: { table: EmptyWhenFilterTable }`) for filtered-empty — chrome stays interactive.

**Rule:** Gate on settle: `isFetched && !isLoading && data.length === 0` — `isFetched` prevents flashing before the first response; `?? []` keeps the Table alive when the query errored.

**Rule (completes what the reference left unfinished):** the discrimination MUST also branch on whether any filters are active (read `searchParams`): filters active → filtered-empty; none → true-empty. The reference components and copy exist but its guard never checks filters — implement the check.

Gate the empty state's CTA by the same permission as the header CTA (a reference `NoUsers` shows a create button the header hides — inconsistency, don't copy).

## Authorization (candidate — one reference repo, the only idiom that exists)

Enforce a right at three independent layers, all reading the same persisted rights query and the `userRightsMap` const map via `checkRight(userRights, requiredRight)`:

1. **Loader:** `loader={withPermissionLoader(userRightsMap.ACCESS_USER, usersListLoader)}` — resolves rights (persisted cache) and returns `redirect(unauthorizedRoute)` before data loads;
2. **Element:** `<ProtectedRouteByRigth requiredRight={...} redirectToUnauthorized><Page/></ProtectedRouteByRigth>` — `<Navigate/>` on failure, or renders `null` for embedded fragments when `redirectToUnauthorized` is omitted;
3. **CTA:** `{checkRight(rights, userRightsMap.CREATE_USER) && <Button .../>}`.

Stack layers 1+2 on the same route (loader covers direct navigation; element covers client renders that skip the loader). Improvements the plugin mandates over the reference: type the map with `as const` + derive a `keyof typeof` union; derive the unauthorized path from `baseRoute`; build a real unauthorized page (the reference's is a bare `<div>` — stub, not pattern).

## Console discipline (candidate)

Logging is infrastructure-layer and TAGGED: `logApiError(error, 'fnName')` → `[api-error] [fnName]` at every API catch; `[<subsystem>]` prefixes for decision traces. Ad-hoc `console.log` in views, submit handlers and loaders is what code review removes. No telemetry/Sentry exists — console is the observability story; don't pretend otherwise.

## Known gaps (don't invent solutions silently)

No timeout UX (axios `timeout: 10000` rejects like any error), no offline UI (`refetchOnReconnect: false` is deliberate), no user-facing retry affordance beyond the 404 home button, no per-child-route boundaries. Adding any of these is a team decision.

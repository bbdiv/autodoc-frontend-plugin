---
name: state-management
description: State ownership rules for Autodoc MFEs - what goes in the TanStack Query cache, the URL, zustand, useState, or the platform session module (mf-platform-utility-module). Use when deciding where state lives, creating a store, adding filters/search/pagination, or when the user says "criar um store", "estado global", "zustand", "filtros na URL", "paginação", "sessão", "customer selecionado", "global state", "where should this state live", "add a filter".
---

# State ownership

Every kind of state has exactly one owner. Placing it elsewhere is the #1 habit to unlearn from the legacy (redux-saga) repos.

| Kind of state | Owner | Never |
|---|---|---|
| Server data (lists, entities, permissions) | TanStack Query cache, exclusively | copied into useState/zustand |
| Filters, search, pagination | The URL (compressed `q` param) | component state or a store |
| Cross-MFE session (user, customer) | `mf-platform-utility-module` (PUM) | a local store or `window.autodoc` |
| Cross-route client state inside the MFE | Small single-purpose zustand stores in `@store/` | one god-store |
| Ephemeral UI (modal flags, measurements) | Local `useState` | anything global |

**Team decision (D1):** PUM is THE session source. One reference repo predates PUM and seeds a local zustand `userStore` from `window.autodoc` events — that is the OLD pattern; the other reference deleted its local store in the same commit it adopted PUM. New code always uses PUM.

## Server state: query cache only

Render straight from the hook (`dataSource={users?.data ?? []}`). Zero `useState(queryData)` exists in the references. The legacy antipattern to refuse: fetching in sagas and `put`-ting into redux (90 saga handlers in one legacy repo), with hand-rolled per-request loading flags.

Documented narrow exception: a cross-route draft handoff may pass a fetched entity through a store (see below) — teach the boundary, don't let it become a cache-beside-the-cache.

## URL as filter state

**Rule:** Every list-screen filter, search term and pagination value lives in the URL as ONE lz-string-compressed JSON object under the `q` param, via the typed hook; loaders read the non-hook twin.

```ts
// component
const { searchParams, updateSearchParams } = useSearchParamsHook<Partial<IUsersListFilters>>();
// loader (outside React — hooks are illegal there)
const filters = getSearchParams();
```

- Implementation: `src/@hook/useUrlSearchParameters/` (hook + `utils.ts` with `getSearchParams<T>`), generic `<T extends Record<string, any>>`, `useMemo` decompress on `[searchParams]`, `updateSearchParams(filters, mergeOlderState?)` dropping empty values (`mf-workforce/src/@hook/useUrlSearchParameters/index.ts:15-76`).
- Pagination writes back to the URL, not to state: `pagination_number`/`pagination_size` entries, `onChange` → `updateSearchParams({...}, true)`.
- Search inputs: seed a local `useState` from `searchParams` (lazy initializer) for per-keystroke responsiveness, write through debounced (300ms `cron` ref — see `hooks` skill), resetting `pagination_number` to 1.

**Why URL:** survives refresh, shareable, and readable from loaders before React mounts — the loader prefetches the exact query the view renders (filters are part of the query key).

## zustand stores

**Rule:** One store per concern in `src/@store/`, plain `create` (no middleware), typed interface, one setter per field, and an explicit reset that sets EVERY field back (zustand shallow-merges — `set({})` is a no-op; that bug exists in a reference, don't copy):

```ts
const userStore = create<IUserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
export const useUserStore = userStore;
export default userStore;
```

**Rule:** In components, per-field selectors — `store((s) => s.customer?.id ?? '')`; outside React (loaders, callbacks, onSubmit) — `store.getState()`. Never select the whole state.

**Candidate — cross-route draft handoff:** when a flow starts in one route (modal collects a CNPJ) and continues in another (editor form), pass the draft through a store via `getState().set...()`, and make the TARGET route's loader reconcile: use the store value when present, fetch by URL param as fallback, `redirect(...)` out when a deep link has no draft. Reset the store (and the form) in the consumer's unmount cleanup.

## Session via `mf-platform-utility-module`

Platform-provided — consume, never reimplement (login, refresh, customer switch all live in the module):

```ts
// components
const { selectedCustomer, userData } = useSession();
// loaders / non-React
const customerId = (await persistor.getWithMeta<ICustomer>('selectedCustomer'))?.value?.id ?? '';
```

- Writers you may call: `saveSelectedCustomer(customer)`, `logout()`. Everything else is read-only.
- `getWithMeta<T>` returns `{ value, isStale, timestamp }` — decide how to treat stale data.
- Gate the app until session exists: block render with `RootLoading` until `selectedCustomer` + `userData` resolve (see `ux-states`).
- NEVER call `useSession()` inside a router loader (it's a hook; a reference does this once — it's a bug, not a pattern). Use `persistor.getWithMeta`.
- Fallback for a missing id is `?? ''` (empty string). `?? ' '` (a space) is a replicated typo — don't copy.
- Full module surface and the auth-token contract: see `mfe-platform`.

## Context

React context is a niche tool here: the only living use shares one `useSearchParamsHook` instance across a view's subtree. Do not use context for domain or session data — zustand (no provider needed) and PUM cover those.

## Local `useState`

Only what dies with the screen: `showXModal` flags, UI measurements, transient selections. Everything with a longer lifetime already has an owner above.

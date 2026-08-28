---
name: hooks
description: React hook conventions for Autodoc MFEs - where custom hooks live, object returns, hook + non-hook twins for loaders, effect taxonomy (effects never fetch), memoization calibration, debounce idiom, and the rules-of-hooks discipline the missing lint doesn't enforce. Use when writing a custom hook, useEffect, useMemo/useCallback, or debounce logic - "criar um hook", "useEffect", "memoizar", "debounce", "custom hook", "dependency array", "re-render".
---

# React hooks

## Custom hooks: tiny, shared-infrastructure-only surface

**Rule:** Reusable hooks live in `src/@hook/`, one hook per file named after it, default export; a folder (with `index.ts`) only when it carries companions (`useUrlSearchParameters/` has `utils.ts`). A hook relevant to a SINGLE view may be colocated (`src/views/<Feature>/hooks/`) — but prefer inline logic until it repeats; never hoard generic utility hooks (the legacy repo's 19 `useDebounce`/`useWindowSize`/`useOutsideClick` are the antipattern).

**Rule:** Non-trivial hooks declare explicit `Args` and `Return` types; effects inside hooks always clean up (listeners, timers, subscriptions, observers); a hook should NOT exist for one-off logic or anything that's clearer as a plain function.

**Rule:** Hooks return named-field OBJECTS, never tuples: `return { searchParams, updateSearchParams }`.

**Rule:** Hooks carrying page-specific data are generic, typed by the caller's model: `useSearchParamsHook<Partial<IUsersListFilters>>()`.

**Rule:** When a hook's read logic is also needed outside React (route loaders), export a plain-function TWIN from the same module reading the same source — `getSearchParams<T>()` beside `useSearchParamsHook`. Loaders can never call hooks (a reference has `loader={() => useSession()}` once — real bug, never copy; the non-hook path is `persistor.getWithMeta`).

## Effects: scarce, and they never fetch

The references have 23 effects across ~400 files. The complete legitimate taxonomy:
- DOM measurement/observation (ResizeObserver, ellipsis checks);
- focus management (refocus-after-refetch);
- one-time app bootstrap (session gate reading the persistor);
- unmount cleanup (form-adjacent store resets);
- syncing fetched data into form fields (CEP → `form.setFieldValue`, deps `[data, isSuccess, ...]`);
- window event subscriptions WITH remove-listener cleanup.

**Never** data fetching (loaders + queries own it), **never** derived state (compute in render or `useMemo`). Delete debug effects (`useEffect(() => console.log(x), [x])`) on sight.

## Rules-of-hooks discipline — the plugin compensates for missing lint

The reference repos do NOT install `eslint-plugin-react-hooks` (every legacy repo does — the modern repos regressed). Until it's added, enforce manually what it would:
- exhaustive, honest dependency arrays; `[]` only for genuinely mount-once work;
- no conditional hook calls (`const field = context ?? useFieldContext()` — real violation in a reference field component; restructure instead);
- no hooks inside non-component functions EXCEPT the column-factory form below;
- **never hooks inside a cell `render` callback** (executes in the Table's render — genuinely broken).

Recommendation when touching lint config: add `eslint-plugin-react-hooks` with `exhaustive-deps: error` (see `tooling`).

Column factories (`get<X>Columns({handlers})`) calling hooks at their top are the practiced, tolerated exception — they execute within the view's render. Call them unconditionally at component top level only; if hook-free, memoize the call (`useMemo(() => columns(), [])`), never a hook-calling one.

## Memoization calibration

Measured reality: 9/5/0 (`useMemo`/`useCallback`/`React.memo`) in one reference, 1/1/0 in the other — vs 69/132 in the legacy repo. Memoize exactly:
- parse/derive work inside shared hooks (decompress+parse on `[searchParams]`);
- list transformations of fetched data feeding a child (`mappedProfiles`).

Do NOT reflexively memoize handlers, wrap components in `React.memo`, or memoize JSX. Inline arrow handlers in JSX are the house style.

## Debounce idiom

**Rule:** Debounce user-driven writes with a `cron` setTimeout ref, inline at the call site (no abstraction exists — don't create one):
```tsx
const cron = useRef<ReturnType<typeof setTimeout>>();
const onChangeInput = (e) => {
  clearTimeout(cron.current);
  setInput(e.target.value);
  cron.current = setTimeout(() => {
    updateSearchParams({ search: { value: e.target.value, operation: 'like' } }, true);
  }, 300);
};
```
300ms for typing; 25-50ms for ResizeObserver bursts. Improvement over the reference: clear the pending timer in an unmount cleanup (the references never do — latent setState-after-unmount).

**Companion:** search inputs disabled during their own refetch (`disabled={isLoading}`) pair `inputRef` + a `setFocusOnInput` flag ref raised in the debounce callback, and an effect on `[isLoading]` that refocuses once and lowers the flag.

## No container/presenter split

Views own their queries, mutations, URL state and handlers directly; colocated presentation subcomponents (Header, CountersSection) RE-CALL the same hooks instead of receiving data as props — the query cache and the URL make the data globally addressable, so sibling calls are cache hits:
```tsx
// view, Header and CountersSection each call:
const { isLoading, data } = useGetUsers(customerId, searchParams);
```
Don't introduce `*Container`/`*View` pairs or logic-only wrapper components.

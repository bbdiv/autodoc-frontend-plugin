---
name: data-fetching
description: TanStack Query 5 patterns for Autodoc MFEs - query module triple export (getKey/getConfigs/useHook), router-loader prefetch with ensureQueryData, customer-scoped query keys, dynamic staleTime, thin mutation wrappers with call-site invalidation. Use when fetching or mutating server data - "adicionar uma query", "buscar dados", "criar mutation", "invalidar cache", "chamar a API", "add a query", "fetch data", "create a mutation", "loading state", "cache" - or when creating any screen that shows server data.
---

# Data fetching (TanStack Query 5 + react-router loaders)

**Step 0:** Confirm `@tanstack/react-query` is in the target repo's `package.json` before writing any of this. Absent → report it and ask; never install it or scaffold the pattern on your own.

Server data lives ONLY in the TanStack Query cache. Never mirror it into `useState` or zustand (see `state-management` skill for the one narrow exception). Never fetch in `useEffect`.

## The query module: triple export, one file per query

**Rule:** Every query lives in `@query/queries/<backend>/<useGetX>.ts` and exports three things: `get<X>Key`, `get<X>Configs`, and the default hook `use<X>` — nothing more than `useQuery(get<X>Configs(...))`.

**Why:** Route loaders (outside React) and components must fetch with the identical key and queryFn so the loader's prefetch is a cache hit for the view. The configs builder is the single source of truth.

**Example** (`mf-workforce/src/@query/queries/workforce/useGetJobFunctions.ts:7-26`):
```ts
export const getJobFunctionsKey = (customerId: string) => ['job-functions', customerId];

export const getJobFunctionsConfigs = (customerId: string, filters?: IFilter) => ({
  queryKey: getJobFunctionsKey(customerId),   // see key rule below — include filters when the fn uses them
  queryFn: async () => {
    const res = await workforceAPI.getJobFunctions(customerId, filters);
    if (isApiError(res.data)) return { ...res, data: [] };
    return res.data;
  },
  enabled: Boolean(customerId),
  staleTime: (query) => (query.state.dataUpdateCount === 0 ? 0 : 1000 * 60 * 10),
});

const useGetJobFunctions = (customerId: string, filters?: IFilter) => useQuery(getJobFunctionsConfigs(customerId, filters));
export default useGetJobFunctions;
```

Naming is standardized: `get<X>Key` / `get<X>Configs` (team decision — the references mixed `gen`/`qry`/`generate` prefixes; don't imitate that).

## Query keys

**Rule:** Key = `[entity, customerId, ...ids, genKeyFromFilter(filters)]`, built ONLY by the exported key function; never write a key literal at a call site.

- `customerId` is mandatory in every key — all backend data is customer-scoped (multi-tenant); omitting it serves one customer's cache to another after switching.
- When the queryFn accepts filters, the key MUST include `genKeyFromFilter(filters)` (an order-independent `{"field_op_value": true}` record). Known bug not to copy: a reference key omitted the filters its queryFn used, so filtered results overwrote unfiltered ones in one cache entry.

## `enabled` guards every parameterized query

**Rule:** Gate on required params: `enabled: Boolean(customerId)`, `!!customerId && !!userId`, `userId !== 'new'` (the create/edit shared-route sentinel). Session ids arrive asynchronously — without the guard the query fires with empty ids.

## staleTime & list options

**Rule:** Two staleTime patterns, chosen by data kind:
- **Dynamic** — `staleTime: (query) => (query.state.dataUpdateCount === 0 ? 0 : 1000 * 60 * N)` — fresh on first load, cached N minutes on revisits. For detail pages and volatile lists; make the comment match N.
- **Static** — `staleTime: 5 * 60 * 1000` — for reference data (profiles, access levels, catalogs).

**Rule:** Paginated lists add `placeholderData: keepPreviousData` (avoids the empty-flash between pages). Lookups where retrying doesn't help (search-by-email, CEP) set `retry: 0`.

**Optional:** a configs builder may take a trailing `configs?` param spread last, so call sites can override options without a new module.

## Which filter system? (check before writing API code)

Two coexist during the backend migration:
- **Legacy** (most repos): `IFilter` + `genFilters` → `filter[field]=op:value` query strings; keys via `genKeyFromFilter`.
- **searchCriteria** (migration target; implemented in mf-workforce's develop line): `filtersGroup` URL shape → `ISearchCriteria` → `searchCriteria[...]` query strings; keys via `genKeyFromFilterLaravel`; response pagination in `meta.total`. Full contract and recipe: [searchcriteria-api.md](searchcriteria-api.md).

## One QueryClient

**Rule:** One `QueryClient` in `src/@query/index.ts`, default-exported, imported by the provider, every loader, and every invalidation site:
```ts
new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 2 } } });
```
(`retry: 2` is the team decision.) Never re-declare these options per hook.

## Route loaders prefetch through the shared configs

**Rule:** Every data route gets a loader that resolves `customerId` from the platform session (`persistor.getWithMeta` — see `state-management`), then `queryClient.ensureQueryData(get<X>Configs(...))`; parallelize independent queries with `Promise.all`. Use `ensureQueryData` (not `getQueryData ?? fetchQuery` — older idiom).

**Example** (`mf-workforce/src/routes/loaders/usersListLoader.ts:9-19`):
```ts
const usersListLoader = async () => {
  const filters = getSearchParams();
  const customerId = (await persistor.getWithMeta<ICustomer>('selectedCustomer'))?.value?.id ?? '';
  const [users, profiles] = await Promise.all([
    queryClient.ensureQueryData(getUsersConfigs(customerId, filters)),
    queryClient.ensureQueryData(qryGetProfilesConfigs(customerId)),
  ]);
  return { users, profiles };
};
```

**Antipattern:** building an inline `{ queryKey, queryFn }` inside a loader — bypasses the module's staleTime/enabled and duplicates the fetch definition.

Route wiring pairs the loader with `hydrateFallbackElement` (skeleton) and `shouldRevalidate` tuned to ignore same-path query-param changes (filters live in the URL; the in-page query whose key includes them handles refetching):
```tsx
<Route index element={<UsersList />} loader={usersListLoader}
  hydrateFallbackElement={<LoadingUsersList />}
  shouldRevalidate={({ currentUrl }) => currentUrl.pathname !== '/adm/users'} />
```

Type loader data at the read site: `useLoaderData<IUsersListLoader>()` (team decision).

## Mutations

**Rule:** One mutation per file in `@query/mutation/<entity>/use<Verb><Entity>Mutation.ts` — a THIN wrapper: context params first (`customerId`), typed callbacks object last (`interface IUse<Hook>Props { onSuccess: (data: T) => void; onError: (error: unknown) => void; }`), kebab-case `mutationKey` (add dynamic ids when uniqueness matters: `['select-customer', userId]`), typed `mutationFn` delegating to the API layer and returning `res.data`, callbacks passed through. All UI effects live at the CALL SITE.

**Rule:** In the call-site `onSuccess`: named notification function + `queryClient.invalidateQueries({ queryKey: get<X>Key(customerId) })` (the exported key builder — prefix match invalidates every filtered variant) + navigation. Include the mutation's `isPending` in button-disable expressions.

**Example** (`mf-workforce/src/views/JobFunctions/jobFunctionsEditor/index.tsx:44-56`):
```ts
const { mutate: createJobFunction, isPending } = useCreateJobFunction(customerId, {
  onSuccess: () => {
    createJobFunctionSuccess();
    queryClient.invalidateQueries({ queryKey: getJobFunctionsKey(customerId) });
    navigate(jobFunctionsRoutes.base);
  },
  onError: (error) => { createJobFunctionError(); console.error('Error creating job function:', error); },
});
```

**Never** call the API layer directly inside a form's `onSubmit` — that path (observed once in a reference) has no cache interaction, no `isPending`, and rots (its mutation file was literally empty). Team decision: always the wrapper.

Mutation param typing: inline object literal up to 2 fields; a named interface above that (team decision).

## API layer (below the query layer — UI never imports it)

**Rule:** `@apis/<backend>/<entity>/index.ts`, one exported typed async function per endpoint; the response type goes in the axios GENERIC at the call (`instance.get<IApiReturn<IJobFunction[]> | IApiErrorReturn>(url)`), never in a cast; every function is try/catch → `logApiError(error, 'fnName')` → rethrow.

**Rule:** Axios instances are per-customer factories (team decision):
```ts
export const workforceInstance = (customerId: string, configs?: APIConfigs) => {
  const api = axios.create({
    baseURL: `${apiEnvironments.workforce.baseURL}/${configs?.version ?? 'v1'}`,
    timeout: configs?.timeout ?? 10000,
    headers: { 'Content-Type': 'application/json', 'X-Customer-Id': customerId, ...configs?.headers },
  });
  api.interceptors.request.use(requestInterceptor);   // idToken cookie → Bearer (see mfe-platform)
  api.interceptors.response.use((r) => r, responseInterceptor);
  return api;
};
```

**Rule:** Backends answer 200-with-error bodies. Type responses as the `IApiReturn<T>` envelope, narrow with the `isApiError` type guard inside the queryFn, and normalize errors to the success shape with empty data (`{ ...res, data: [] }`) — list views then render their empty state instead of crashing. Set `throwOnError: false` where relevant. (Envelope/guard definitions: see `typescript-conventions`.)

## Persisted queries (candidate — session-gating data only)

For per-user data that gates the whole app (rights/profile), wrap the queryFn in the local `createPersistor('localStorage')`: check the persisted copy first, fetch and write-through on miss. **The persisted key MUST include the userId** (`PERSISTED_KEY = (id) => \`...\_${id}\``) — a constant key serves the previous user's permissions after a user switch (real bug in a reference sibling file; don't copy).

Do NOT use `@tanstack/react-query-persist-client` / `PersistQueryClientProvider` — installed in one reference but never imported; the codebase's persistence is the hand-rolled per-query persistor.

## Optimistic updates (when instant feedback is required)

**Rule:** Snapshot-based, never blind-revert. `onMutate` saves the previous data and returns it as context; `onError` restores FROM THE CONTEXT:

```ts
onMutate: ({ customerInfo }) => {
  const originalData = queryClient.getQueryData(getMySessionKey(userId));
  queryClient.setQueryData(getMySessionKey(userId), (old) => ({ ...old, selected_customer: customerInfo }));
  return { originalData };
},
onError: (error, _vars, context) => {
  queryClient.setQueryData(getMySessionKey(userId), context?.originalData);
  onError?.(error);
},
```

**Rule:** To update a row across EVERY cached filter combination of a list, use a partial-key match:
```ts
queryClient.setQueriesData<IApiReturn<IEntity[]>>({ queryKey: ['entities'] }, (old) =>
  old ? { ...old, data: old.data.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)) } : old,
);
```
Default remains call-site invalidation; optimistic writes are for toggles that must feel instant.

## Not practiced here (don't introduce without a decision)

`useInfiniteQuery` (pagination is URL+server-side, capped at 50/page), `useSuspenseQuery`, `useQueries`, global QueryCache handlers, `select`, AbortSignal cancellation.

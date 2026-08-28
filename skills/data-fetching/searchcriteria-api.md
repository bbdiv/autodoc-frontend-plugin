# searchCriteria API contract (the NEW workforce API)

The workforce backend is migrating to a Magento-inspired query interface: all filtering, sorting, pagination and eager-loading travel in ONE `searchCriteria` query parameter. Implemented client-side in mf-workforce's develop line (`src/@apis/searchCriteria/*`, `src/@models/query/ISearchCriteria.ts`); the legacy `IFilter`/`filter[field]=op:value` system remains in repos not yet migrated. Check which system the target repo uses before writing API code.

## Server contract

Every endpoint declares what it accepts (`allowedFilters`, `allowedIncludes`, `allowedSorts`, `allowedFields`); anything else returns `400` with the allowed list. Condition types: `eq` (default), `neq`, `like` (`%` encoded `%25`), `gt`/`gte`, `lt`/`lte`, `in`/`nin` (comma-separated).

**Logic composition — the part people get wrong:**
- Filters inside the SAME `filter_groups[i]` are **OR**'d.
- Different `filter_groups` entries are **AND**'d.
- So `(status=active OR status=pending) AND role=admin` = group 0 with two status filters + group 1 with one role filter.

Other keys: `sortOrders[i][field|direction]` (prioritized fallbacks, `ASC`/`DESC`); `includes=company,orders,orders.items` (dot-nested eager loading, whitelisted); `pageSize`/`currentPage` (pagination; response carries `meta.page`/`meta.total`); `fields=id,email` (sparse fieldsets; PKs/FKs auto-appended).

Example — `(status=pending OR suspended) AND created_at > 2024-01-01`:
```
GET /api/v1/customers
?searchCriteria[filter_groups][0][filters][0][field]=status
&searchCriteria[filter_groups][0][filters][0][value]=pending
&searchCriteria[filter_groups][0][filters][1][field]=status
&searchCriteria[filter_groups][0][filters][1][value]=suspended
&searchCriteria[filter_groups][1][filters][0][field]=created_at
&searchCriteria[filter_groups][1][filters][0][value]=2024-01-01
&searchCriteria[filter_groups][1][filters][0][condition_type]=gt
```

## Client-side building blocks (mf-workforce develop line)

Types (`src/@models/query/ISearchCriteria.ts`): `ISearchCriteria<F>` (the API shape), and the compact URL shape `IUrlListSearchState<F>` = `{ filtersGroup?: Partial<Record<F, { value: string | string[]; condition?: TSearchCriteriaConditionType }>>, currentPage?, sortOrders?, pageSize?, includes?, fields? }`.

Pipeline (each layer owns one transformation — don't inline any of them):
1. **URL state** — `useUrlSearchParameters` with the UPDATER form to avoid stale writes, and `prepareOmitEmptyValueGroup({ groupKey: 'filtersGroup' })` to keep URLs clean (empty text `''`, empty multi `[]` are dropped; `currentPage: '1'` is dropped when it would be the only key):
```ts
updateSearchParams((prev) => ({
  currentPage: '1',
  filtersGroup: { ...(prev.filtersGroup ?? {}), status: { value: values, condition: 'in' } },
}), true, { prepare: prepareUrl });
```
2. **URL → API model** — `buildSearchCriteriaFromFiltersGroup({ fields, filtersGroup, defaultCondition, currentPage, sortOrders })` (`src/@apis/searchCriteria/mappers.ts`), memoized on `[searchParams]`; `defaultCondition` is a per-field function (`(f) => f === 'name' ? 'like' : 'in'`).
3. **API model → query string** — `buildSearchCriteriaQueryParts(criteria)` (`serialize.ts`), reached via `genFilterLaravel(criteria)` — serializer lives ONLY in the API layer.
4. **Query keys** — serialize filters into the key with `genKeyFromFilterLaravel` (sibling of the legacy `genKeyFromFilter`).

## Rules

- One filter model per list: `type T<X>Field = 'name' | 'status'; export type I<X>ListFilters = IUrlListSearchState<T<X>Field>;`
- UI/views never build query strings; loaders/views hand `searchParams`/criteria to hooks, hooks hand them to the API layer.
- Response envelope carries `meta` pagination (`meta.total`) — prefer it over the legacy `count`.
- A `400` naming disallowed fields means the FIELD LIST is wrong, not the encoding — fix the field union, don't fight the serializer.

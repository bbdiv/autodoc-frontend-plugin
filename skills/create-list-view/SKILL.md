---
name: create-list-view
description: Full recipe for building a list/table page in an Autodoc MFE - URL-synced filters, counters, table with pagination, empty states, cache updates. Use when creating a listing screen - "criar tela de listagem", "lista com filtros", "tabela paginada", "tela de consulta", "create a list view", "listing page", "table with filters".
---

# Create a list entity view

The composed recipe (individual rules live in the referenced skills). Two filter systems exist — check the target repo first:
- **Legacy** (`IFilter` + genFilters `filter[field]=op:value`): most repos today.
- **searchCriteria** (`filtersGroup` → Magento-style `searchCriteria[...]`): the migration target, implemented in mf-workforce's develop line. Contract: [searchcriteria-api.md](../data-fetching/searchcriteria-api.md).

## Folder

```
src/views/<EntityList>/
  index.tsx                  # page, wrapped in UrlSearchProvider
  Header/{index.tsx,styled.ts}   # filters row
  CountersSection/index.tsx      # summary cards
  get<Entity>ListColumns.tsx     # column factory
  <Entity>ListLoading.tsx        # route skeleton
  No<Entity>.tsx                 # first-time empty state
```

## Steps

### 1. Filters model

`src/@models/<entity>/I<Entity>ListFilters.ts`. searchCriteria repos extend the shared base:
```ts
import type { IUrlListSearchState } from '@workforce/@models/query/ISearchCriteria';
export type TEntityListField = 'name' | 'status' | 'type_id';
export type IEntityListFilters = IUrlListSearchState<TEntityListField>;
export default IEntityListFilters;
```
Legacy repos: `Partial<Record<Field, IFilterValues>>` per `state-management`.

### 2. Query module + loader

Triple-export query (`get<X>Key`/`get<X>Configs`/`useGet<X>`) with the filters serialized into the key; paginated lists add `placeholderData: keepPreviousData`. Route loader prefetches via `ensureQueryData`; route gets `hydrateFallbackElement` + `shouldRevalidate`. → `data-fetching`.

### 3. URL state via provider

Wrap the page in the provider so Header/Counters/Table share ONE instance:
```tsx
const EntityList = () => {
  const { searchParams, filtersCount, updateSearchParams } = useUrlSearchContext<IEntityListFilters>();
  ...
};
export default () => (<UrlSearchProvider><EntityList /></UrlSearchProvider>);
```
(`filtersCount` — number of active filters — drives the empty-state branch in step 6.)

### 4. Layout

`MainLayout $flexColumn` → `NavigationBar` (title + create CTA, permission-gated) → `CountersSection` → `LayoutCard` wrapping Header + Table. Counters use the shared `CountSection` wrapper where the repo has it, with DS `Skeleton` while loading.

### 5. Header (filters)

Each control writes through to the URL; every filter change resets page to 1; text search debounced 300ms via the `cron` ref with local echo state (→ `hooks`, `state-management`). searchCriteria repos use the updater form to avoid stale writes on rapid changes:
```ts
const prepareUrl = prepareOmitEmptyValueGroup({ groupKey: 'filtersGroup' });
updateSearchParams((prev) => ({
  currentPage: '1',
  filtersGroup: { ...(prev.filtersGroup ?? {}), status: { value: values, condition: 'in' } },
}), true, { prepare: prepareUrl });
```

### 6. Empty states — the settled two-branch form

```tsx
{isFetched && !isLoading && data?.data.length === 0 && filtersCount === 0 ? (
  <NoEntity />                                   // first-time empty: illustration + create CTA
) : (
  <>
    <CountersSection />
    <LayoutCard>
      <Header />
      <Table {...(data?.data.length === 0 ? { components: { table: EmptyWhenFilterTable } } : {})} ... />
    </LayoutCard>
  </>
)}
```
The `filtersCount === 0` check is what makes the discrimination correct — never ship the length-only guard. Gate the `NoEntity` CTA by the same permission as the header CTA.

### 7. Table + pagination

`tableLayout="fixed"`, pinned body height, `loading={isLoading}`, `defaultPageSize: 50`, `newPaginationDesign` where the DS version has it; `current` from URL, `onChange` writes back:
```tsx
pagination={{
  showSizeChanger: true,
  defaultPageSize: 50,
  total: data?.meta?.total ?? data?.count ?? 0,   // meta.total = searchCriteria API; count = legacy envelope
  current: Number(searchParams.currentPage) || 1,
  onChange: (page) => updateSearchParams({ currentPage: String(page) }, true),
  showTotal: (total, range) => (
    <ParagraphXSmall $subtlest>{`${range[0]}-${range[1]} ${t('OF')} ${total}`}</ParagraphXSmall>
  ),
}}
```
Columns from the colocated factory with injected `on*` handlers (→ `components`).

### 8. Row mutations → update every cached filter combo

Status toggles and similar list mutations update ALL cached pages with a partial-key match — snapshot-based, per the optimistic template in `data-fetching`:
```ts
queryClient.setQueriesData<IApiReturn<IEntity[]>>({ queryKey: ['entities'] }, (old) =>
  old ? { ...old, data: old.data.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)) } : old,
);
```
Simpler default remains `invalidateQueries(get<X>Key(customerId))` in the call-site `onSuccess`.

### 9. Finish

Notifications on mutation outcomes, translations for every string, skeleton mirrors the layout, permissions on loader+element+CTA (→ `ux-states`).

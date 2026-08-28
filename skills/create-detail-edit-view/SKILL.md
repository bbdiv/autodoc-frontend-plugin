---
name: create-detail-edit-view
description: Full recipe for building a detail/edit page in an Autodoc MFE - parent shell with module navigation, child form routes via Outlet, query by id, update mutation. Use when creating an edit or detail screen - "criar tela de edição", "tela de detalhe", "editar entidade", "página com abas", "edit screen", "detail page", "multi-tab editor".
---

# Create a detail/edit view

For pages like Edit User / Edit Project: URL carries the entity id; the page splits into modules (child routes) — shell with left module nav, right `<Outlet />`.

## Inputs to pin down first

Entity (name, API location, route segment), id param (`:id` — or `:newOrId` when the same route also creates), module list (route ids + labels + icons), avatar format for the nav.

## Steps

### 1. Nested routes

```tsx
<Route path="<entity>/:id" element={<EntityDetails />} loader={entityDetailLoader}
  hydrateFallbackElement={<LoadingEntityDetail />}
  shouldRevalidate={({ currentUrl }) => !currentUrl.pathname.includes(entityDetailRoutes.base)}>
  <Route index element={<Navigate to="registration-data" replace />} />
  <Route path="registration-data" element={<RegistrationDataForm />} />
  {/* one child route per module; permission-wrap each where rights exist */}
</Route>
```
Keep the index redirect pointing at the default module.

### 2. Route helpers

In `routes/buildRoute/`: `entityDetailRoutes.modules.<module>(id)` builders + a `buildSubRoutes<Entity>Detail(id)` returning `{ path, label, icon, condition }[]` — this is what the module nav consumes (`condition` carries the per-module right).

### 3. Shell view

`src/views/<EntityDetails>/index.tsx`: `NavigationBar` (`showBackButton`, `backUrl`) on top; left area with the module navigation component (DS `UserModulesNavigation` where the installed version has it — enumerate first; avatar format per entity); right area `<Outlet />`. Loader data reaches modules via `useOutletContext<T>()`.

### 4. Data access

- Query: `useGet<Entity>ById(customerId, id)` — key `['<entity>', customerId, id]`, `enabled: Boolean(customerId && id) && id !== 'new'`.
- Mutation: `useUpdate<Entity>Mutation(customerId, { onSuccess, onError })`; call-site `onSuccess` invalidates the byId key AND the list key (`['<entityPlural>', customerId]` prefix). → `data-fetching`.

### 5. Each module = an independent form

Per child route: `forms/<FormName>/{index.tsx, formFields.ts}` — own `useAppForm`, defaults branched on loader data, validators trio, `Subscribe`-gated footer (Back + Save, disabled on pristine/submitting/isPending), unsaved-changes guard. Tab switching never carries dirty state. → `forms`.

### 6. Translations & states

Keys for page title (`EDIT_<ENTITY>`), cards, fields, buttons in the 3 locales + key type. Loading = route skeleton; errors/permissions per `ux-states`.

## Variations

- **Read-only detail:** drop mutation + footer; keep query + modules.
- **Single module:** the nested pattern is optional — a single route is fine if the entity won't grow.
- **Create+edit shared route:** use the `:newOrId` sentinel; loader branches on `'new'` (→ `data-fetching`, `forms`).

## Verify

Parent route redirects to default module; nav links match the builders; outlet renders modules; query gated on ids; save invalidates byId + list; all keys translated.

---
name: components
description: Component-writing conventions for Autodoc MFEs - declaration style, props, the modal/drawer/notification contracts, Typography layer, column factories, styling boundary (inline style vs styled.ts), icons. Use when writing or reviewing any React component - "criar um componente", "criar um modal", "adicionar notificação", "toast", "drawer", "tabela", "colunas", "estilizar componente", "create a component/modal/drawer/notification", "table columns", "styling".
---

# Component conventions

## Declaration & props

**Rule:** `const Name = ({ ...props }: NameProps) => {...}` + `export default Name` at file end. Props interface `<Name>Props` (no `I` prefix — reserve `I` for domain models) declared in the same file directly above; defaults in the destructure, never `defaultProps`. `React.FC` only for prop-less roots and custom SVG icons.

**Rule:** Pluggable regions (title, right-side actions, icon slots) typed `React.ReactNode` and rendered directly — no render-prop functions for slots:
```tsx
interface NavigationBarProps {
  title: string | React.ReactNode;
  rightSideComponent?: React.ReactNode | null;
  showBackButton?: boolean;
  backUrl?: string;
}
```

**Rule:** Compose from small colocated single-purpose files; the reference ceiling is ~356 lines per component file (legacy repos hit 1000+ — never).

## Modal contract

**Rule:** Every modal is its own component under `components/01_modals/<Name>/`, props = the callback trio `onOk` / `onCancel` / `onClose` (+ data props, optional `loading`), rendering the fixed DS shell:
```tsx
<Modal width={480} open={true} closeOnOverlayClick={false}
  title={t('UNSAVED_CHANGES')} onOpenChange={onClose}
  body={t('...')}
  footer={<>
    <Button size="small" variant="outlined" onClick={onCancel}>{t('DONT_SAVE')}</Button>
    <Button size="small" variant="solid" onClick={onOk}>{t('SAVE_CHANGES')}</Button>
  </>}
/>
```
The trio is semantic: `onOk` = confirm, `onCancel` = explicit decline ("don't save"), `onClose` = dismiss (X/overlay). Informational modals may drop to `onClose` only. A `loading` prop gates every handler and disables the buttons during async work.

**Rule:** Modals are CONDITIONALLY MOUNTED by the parent — `{showX && <XModal ... />}` with `open={true}` hardcoded inside. Mount/unmount resets internal state; visibility lives in exactly one `useState`. Zero exceptions in the references.

**Rule:** Drawers are the deliberate opposite — always mounted, controlled via `open: boolean; setOpen: (open: boolean) => void`. Filter-drawer selections must survive close/reopen.

## Notifications are functions, not components

**Rule:** Toasts live in `components/03_notification/<domain>/` as exported zero-arg FUNCTIONS, camelCase `<verb><Entity>Success|Error`, calling antd `notification.success/error` with `duration: 3`, the shared 24px icon pair, `style: { gap: 16 }`; messages through i18n (`translateString` — the non-hook `t`). Called from mutation `onSuccess`/`onError` at the view level (see `data-fetching`). Errors carry a `description`; successes usually don't.

## Typography

**Rule:** Never raw text elements in views — use the local `components/Typography` primitives (`LabelSmall/Medium/Large`, `ParagraphXSmall/Small/Medium`, `HeadingXSmall`) with color modifiers (`dark`, `$subtlest`, `$darkest`, `$link`, `$disabled`, `$required`). New modifiers get the `$` transient prefix. (The layer is local because the DS ships no Typography — verified; see `design-system`.)

## Layout

**Rule:** Every page wraps in the MFE's `MainLayout` (styled div: `height: calc(100vh - 52px)`, page background/padding, and the kebab marker class `mf-<name>-main-layout`). Multi-region screens group styled parts into a compound object rendered as `Layout.TopContent` / `Layout.MiddleContent` / `Layout.Footer` / `Layout.FormRow`, exported as one default.

## Table column factories

**Rule:** Column definitions live in a colocated `columns.tsx` / `get<X>Columns.tsx` exporting a default factory `({ onAction, onOther }) => TableColumnsType<Entity>` — handlers injected with `on*` names; the view calls it inline in the `columns` prop. Hooks (`useTypedTranslation`, `useTheme`) at the factory TOP are the practiced form (it executes in the caller's render) — but NEVER call hooks inside a cell `render` callback (that runs in the Table's render — genuinely broken). If a hook-free factory is memoized, memoize the CALL: `useMemo(() => columns(), [])`.

## Tables

**Rule:** Listing tables are server-side paginated, capped at 50 rows/page — never client virtualization at this scale. Pagination state lives in the URL (see `state-management`); the DS `Table` gets:
```tsx
<Table
  tableLayout="fixed"                    // columns sized from explicit widths, not content
  columns={columns}                      // from the colocated factory
  loading={isLoading}
  maxBodyHeight={tableHeight} minBodyHeight={tableHeight}
  dataSource={users?.data ?? []}
  scroll={{ y: tableHeight }}
  pagination={{
    showSizeChanger: true,
    defaultPageSize: 50,
    current: searchParams.pagination_number?.value || 1,
    pageSize: searchParams.pagination_size?.value || 50,
    total: users?.count ?? 0,
    onChange: (page, pageSize) => updateSearchParams(
      { pagination_number: { value: page, operation: '' }, pagination_size: { value: pageSize, operation: '' } }, true),
  }}
/>
```
Body height is pinned (state-held `calc(100vh - ...)` string) so the page frame stays stable across loading/data/empty. Drawer/nested selection tables may use `tableLayout="auto"`.

## Skeletons & loading visuals

**Rule:** Each routed view ships a colocated `<View>Loading` skeleton that reproduces the real screen's layout (same MainLayout/Card shell) with explicitly sized antd `Skeleton.Input`/`Skeleton.Button`; shared bits in `components/LoadingViewsHelpers/`. Grid items get a `<Card>Skeleton` mirroring the real card's slots. Wiring (which level shows what, when): see `ux-states`.

## Styling boundary

**Rule:** One-off layout (flex rows, gaps, widths, margins) = inline `style={{}}` in JSX — this is the accepted default (417 occurrences vs 18 styled.ts files in the references). Reach for a colocated `styled.ts` ONLY for: pseudo-selectors (`:hover`, `:after`), nested class selectors, reusable variants via transient props, `.attrs` marker classes. Hoist repeated inline fragments to a module-level `const`. **Do not "clean up" inline styles into styled-components — that inverts the convention.**

**Rule:** Styled-component variant props are `$`-prefixed (stripped from the DOM); public component APIs expose clean un-prefixed props and map internally:
```tsx
const ListOption = ({ showDivider = false, ...props }: ListOptionProps) => (
  <Container {...props} $showDivider={showDivider}>
```

**Rule:** Semantic/status colors via `useTheme().vars` paths (see `design-system`); the local Typography palette is the sanctioned hex exception.

## Icons

**Rule:** All icons via the `@icons` barrel — NEVER import `react-icons/*` in views/components/utils (only the barrel itself does). To add one: pick it on react-icons.github.io/react-icons/search, import it in `@icons/index.ts` from the correct subpath, add it to the export block, keep the library's export name (no local aliases).

**Rule:** Custom icons that don't exist in react-icons live in `@icons/extraIcons/<Name>.tsx`, replicate the react-icons signature (`{ size = 20, color, className }` → `<svg height/width={size} fill={color}>`) so they're drop-in interchangeable, and are re-exported from the barrel.

**Rule:** Explicit numeric `size`: 16 inline (buttons, cells, menus, labels), 24 for modal-title warnings and notifications, 48+ only for illustrations/spinners.

## Accessibility

The references carry essentially none (zero `aria-*`; a11y is whatever antd/the DS provides). Do not invent a convention and attribute it to the codebase; adding one is a team decision. Meanwhile: always set `alt` on images (the references do), and don't add redundant `role` attributes to DS components.

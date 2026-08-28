---
name: design-system
description: How to consume the @autodocdev/autodoc-ui design system in Autodoc MFEs — enumerate the installed version before importing anything, decide between consuming/extending/creating components, use slot props and theme tokens. Use when adding ANY UI to an Autodoc frontend - creating a screen, view, page, table, modal, drawer, button, select, form field, card, tag, or when the user says "criar uma tela", "adicionar um componente", "usar o design system", "importar do autodoc-ui", "estilizar", "customizar componente", "add a component", "build a screen", "style this". Also use before reviewing UI code.
---

# Consuming `@autodocdev/autodoc-ui`

Every Autodoc MFE pins a DIFFERENT exact version of the design system and the library moves fast. A component that exists in one repo's version may not exist in another's. **Never assume a component exists. Never trust a component list from memory, from another repo, or from this plugin.**

## Step 0 — Enumerate the installed version (always, before any DS import)

Run the bundled script from the consumer repo root:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/enumerate-ds.mjs" .
```

- Output `values` = the complete importable surface (components/hooks/utils) for THIS repo. Anything not listed must not be imported.
- Output `types` = importable type names.
- `installed: false` → stop. If `declared` is set, ask to install first; if not, this repo does not use the DS.
- On hard failure the script prints the standing instruction: open `node_modules/@autodocdev/autodoc-ui/dist` and confirm the export exists before writing any import.
- Heed the stale-install warning (`declared !== version`).

To see what changed between two versions (requires a local checkout of the `autodoc-ui` repo): `git diff v<from> v<to> -- autodoc-ui/main.tsx`. The barrel `autodoc-ui/main.tsx` is the source of truth for exports; the changelog is incomplete and out of order — never authority. Version numbers do NOT signal breaking changes (a type was renamed inside a patch range: `OptionItemType` → `PopoverOptionItemType` between 0.1.10 and 0.1.43) — only the barrel diff can.

For props and usage of a specific component: the `autodoc-ui` repo carries per-export guides in `autodoc-ai-guides/<category>/<Name>.md`. They are NOT published to node_modules and they lag the code — cross-check every guide against the enumeration output before trusting it.

## Decision rule: consume, extend, or create

### Consume — DS-first for interactive primitives

**Rule:** Any interactive/visual primitive (button, modal shell, input, select, table, tooltip, popover, tag, card, drawer, switch, checkbox, avatar, skeleton…) comes from `@autodocdev/autodoc-ui`, verified against the enumeration output.

**Why:** The reference repos are DS-first with zero parallel primitives. The known cost of ignoring this: one legacy repo maintains 46 local components of which 12 collide by exact name with current DS exports — every new feature there faces a which-Button fork.

**Example** (`mf-workforce/src/views/JobFunctions/index.tsx:3`):
```tsx
import { Button, LayoutCard, PopoverMultiSelect, Search, Table, Tag } from '@autodocdev/autodoc-ui';
```

**Import style:** named imports from the package root ONLY. Never deep-import `@autodocdev/autodoc-ui/dist/...` (physically possible — no `exports` map — but it pins you to one version's internals). Evidence: 134 files across both reference repos, zero deep imports.

### Create locally — only for verified gaps

**Rule:** Build a local component in `components/` only when the enumeration output confirms the DS has no equivalent. Verified DS absences the references fill locally: Typography primitives, NavigationBar/page header, MainLayout shell, imperative notifications.

**Rule:** A local primitive that deserves to graduate into the DS goes in `src/component_ds/` (staging folder, mf-adm convention) with a DS-grade API: clean un-prefixed public props mapped internally to `$`-transient styled props, `...props` pass-through.

### Extend — by composition, never by restyling

**Rule:** Wrap the DS component in a component that adds behavior and forwards the rest; place the `{...props}` spread BEFORE your controlled props so your wrapper wins. **Never `styled(DSComponent)`. Never override the DS's generated CSS classes.**

**Example** (`mf-adm/src/component_ds/ListOption/index.tsx:73-78`):
```tsx
const ListOption = ({ showDivider = false, highlighted = false, ...props }: ListOptionProps) => (
  <Container as={tag} {...props} $showDivider={showDivider} $highlighted={highlighted}>
```

**Antipattern** (`mf-projetos/src/components/00_Modals/CreateUserModal/style.ts:41-56`): `styled(ButtonComponent)` fighting the DS with `margin: … !important; padding: 0 !important`. Forks the visual contract; breaks on every DS patch.

### Customize internals — slot props, never global CSS

**Rule:** Adjust a DS component's look at the call site with its typed slot maps — `styles={{ <slot>: {...} }}` / `classNames={{ <slot>: '...' }}` — plus root `style`/`className`. Never ship a `.css` file targeting `autodoc-ui_*` or `.ant-*` class names.

**Why:** Slots are the DS's declared extension contract (every component implements the style-interface helper; see `autodoc-ai-guides/css-slot-pattern/SKILL.md` in the DS repo). 20+ call sites in the references; zero override CSS files.

**Example** (`mf-workforce/src/views/JobFunctions/columns.tsx:73`):
```tsx
<Tooltip styles={{ content: { display: 'flex', alignItems: 'center', gap: 4 } }} ...>
```

**When a slot genuinely doesn't expose the part you need:** (1) write a tightly-scoped selector WITHOUT `!important`, with a comment stating exactly which slot is missing; (2) file the gap against the DS. A blanket `!important` sheet is never acceptable.

### Theme tokens instead of loose values

**Rule:** Read semantic/status colors from the theme: `const { vars } = useTheme()` and use semantic paths. Available namespaces: `border.radius`, `breakpoints`, `spacing`, `color.{bg,border,icon,interaction,link,surface,text}` (+ accent palettes), and the typography scale. Interaction variants end in `_default`/`hovered`/`pressed`.

**Example** (`mf-workforce/src/views/JobFunctions/columns.tsx:23-29`):
```tsx
case 'active':   return <MdCheckCircleOutline size={16} color={theme.vars.color.icon.success} />;
case 'inactive': return <MdOutlineCancel size={16} color={theme.vars.color.icon.subtle} />;
```

**Antipattern:** hardcoding a value a token already holds (`color: #b72726` where `vars.color.icon.danger` IS that value). Layout one-offs (a width, a gap) may stay literal — see the `components` skill's styling boundary.

## Raw antd: exactly three sanctioned shapes

antd 5 is a DS dependency and is bundled per MFE (not an external). Import from `'antd'` directly ONLY for:

1. **`notification`** — the imperative toast API the DS doesn't wrap (used inside `components/03_notification/` functions only).
2. **Skeleton-screen primitives** — `Skeleton.Input` / `Skeleton.Button` inside `*Loading`/`*Skeleton` components. (The DS `Skeleton` is a simpler block placeholder — use it for inline placeholders, antd for composed skeleton screens.)
3. **`TableColumnsType<T>`** — type-only import for column factories; legitimate because the DS `Table` wraps antd's and types `columns` loosely.

Any other raw-antd import is drift: challenge it (does the enumerated DS surface cover it? is it a DS gap to report?). Known drifts in the references that the team decided to BAN going forward: antd `Typography`, antd `Select` (use the DS Select — or `NewSelect` where the installed version has it), antd `Avatar`.

`Select` note: deprecated in favor of `NewSelect` on the 0.2.x line. Check the enumeration output — if `NewSelect` is present, use it for new code.

## Version discipline

**Rule:** Pin `@autodocdev/autodoc-ui` EXACT (no `^`/`~`) — every consumer does. Treat any DS upgrade as an API-verification task: re-run the enumeration, diff the barrel between the two tags, and fix renames before bumping.

**Rule:** Never copy DS-consuming code between MFEs without checking both repos' pinned versions. Real case: the shared TopbarWrapper copy from a 0.1.x repo is NOT valid in a 0.2.x repo (TopBar was reworked in 0.2.11) — copy from a version-matched repo.

## Shared-by-copy components

A few platform components (TopbarWrapper) are deliberately duplicated across repos instead of packaged. They carry a warning header listing every repo that holds a copy. **Rule:** if you edit one, apply the same change to all listed copies, version-checked per the rule above.

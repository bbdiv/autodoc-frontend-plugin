---
name: react-performance
description: Curated React performance rules for Autodoc MFEs, derived from Vercel's react-best-practices pack with Next.js/SSR-only rules removed and conflicts resolved against house conventions. Use when writing or reviewing React code for performance - "performance", "re-render", "otimizar", "lento", "bundle", "memoization", "optimize React".
---

# React performance (curated for client-only webpack MFEs)

Curation of Vercel's react-best-practices pack (MIT, © Vercel) for this stack: React 18.2 client-only, webpack 5 (no Next.js), TanStack Query (no SWR), single-chunk MFE bundles, scarce-memoization house calibration.

**Precedence: the other plugin skills win over any rule here on conflict.** Where the platform architecture already delivers a rule (loader prefetch = no waterfalls; URL state; query cache), apply it through those skills, not ad hoc.

## Async hygiene (highest impact)

- **Parallelize independent awaits** with `Promise.all` — already the loader rule (`data-fetching`); apply the same inside any async helper.
- **Defer awaits into the branch that uses them** — don't block a function on data only one path needs.
- **Chain only true dependencies** — when B needs A but C doesn't, start C before awaiting A.

## Bundle

- **No barrel re-export files; per-icon imports** — already house rules (`project-structure`, `components`); never import a whole library namespace for one symbol.
- **Heavy module behind a user action** — the ONE sanctioned dynamic-`import()` case in a single-chunk MFE: a big lib (export/PDF/chart) used only after an explicit action may load on that action. Measure before and after; don't route-split (platform decision, see `mfe-platform`).

## Client

- **Version localStorage payloads** — anything persisted (the persistor, per-viewer conveniences) gets a schema/version key and tolerates missing/old data; relevant to the rights persistor pattern.
- **Deduplicate global listeners** — one `window`/`document` listener per concern, attached in one effect with cleanup; never per-row.
- **Passive listeners** for scroll/touch handlers that don't `preventDefault`.

## Re-render discipline

- **Derive, don't sync**: compute derived values in render (or `useMemo` for heavy maps) — never `useEffect` + `setState` to mirror props/state. (House rule: effects never derive — `hooks`.)
- **Move effect logic into the event handler** when it reacts to a user action, not to state settling.
- **Functional setState** (`setX(p => ...)`) whenever next depends on previous.
- **Lazy state init** (`useState(() => expensive())`) — already practiced.
- **Never define components inside components** — hoist or extract.
- **Refs for transient values** that shouldn't re-render (timers — the `cron` idiom; latest-value refs).
- **Honest, minimal dependency arrays** — no over-inclusive deps, no dependency hacks; restructure instead (`hooks` carries the lint gap).
- **Read-don't-subscribe in callbacks** — values only used inside handlers come from `getState()`/refs, not from subscribing the component (matches the zustand selector rule).
- **Split combined hooks/stores** — one concern per hook/store so consumers re-render only for their slice.
- **Don't memoize simple expressions** — `useMemo(() => a + b)` is overhead, not optimization.
- **`React.memo` is NOT a default** — the reference codebases ship zero and are fine at 50-row pages. Reach for it only on a measured re-render problem, and prefer fixing the data flow first. *(Deliberate deviation from the upstream pack.)*
- *(Optional, unpracticed here — needs a measured case + team awareness: `useTransition` for typing-driven heavy updates; `useDeferredValue` for expensive derived views.)*

## Rendering

- **Return `null` early** for conditionally hidden subtrees instead of rendering-and-hiding with CSS.
- **Hoist static JSX** out of render when it's provably constant and large.
- **`content-visibility: auto`** for long offscreen sections (rare here — lists are paginated at 50).
- **Animate a wrapper div, not the SVG internals**; **trim SVG path precision** in custom icons.

## JS micro (hot paths only)

Early exit; combine iterations (one loop instead of chained map/filter over big arrays); `flatMap` over `map().flat()`; `Set`/`Map` for lookups, index maps for repeated `find`s; hoist regex literals; cache repeated property access/function results in locals; length-check before expensive comparisons; `toSorted()` when the original array must survive; batch DOM reads/writes; `requestIdleCallback` for genuinely deferrable work; cache `localStorage` reads (it's synchronous I/O).

## Advanced (rare)

Event-handler refs and `useLatest`-style refs to escape stale closures without re-subscribing; init-once guards for module-level singletons.

## Dropped from the upstream pack (do not apply here)

All `server-*` (RSC/server actions/React.cache), `async-api-routes`, `async-suspense-boundaries`, `bundle-dynamic-imports`/`bundle-preload` (route-level splitting is the platform's job), `bundle-defer-third-party`, hydration rules, `rendering-resource-hints`/`script-defer-async` (the shell owns the document), `rendering-activity` (React 19), `client-swr-dedup` (TanStack Query), and `rerender-memo`/`rerender-memo-with-default-value` as defaults (see calibration above).

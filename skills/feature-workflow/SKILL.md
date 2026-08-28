---
name: feature-workflow
description: End-to-end order for implementing a feature in an Autodoc MFE - models first, then API, queries/mutations, forms, UI, translations, verify. Use when building a feature, adding functionality, or making a change that touches multiple layers - "implementar uma feature", "adicionar funcionalidade", "criar do zero", "build a feature", "add functionality", "where do I start".
---

# Feature workflow (layer order)

Follow this order for any change touching multiple layers. Skip what doesn't apply. Each step's detailed rules live in the referenced skill.

## 0. Understand before coding

Read the relevant existing code. Check what already exists — models, API functions, query/mutation hooks, components, translations. Reuse before inventing. If the plan still has open decisions (scope, data shape, edge cases, integration points), stress-test it first → `grill-me` skill.

## 1. Models first

Define/update the data shapes in `@models/<entity>/` — pure data, no logic. → `project-structure`, `typescript-conventions`.

## 2. API layer

Add/update typed endpoint functions in `@apis/<backend>/<entity>/`. Check which filter system the target repo uses (legacy `IFilter`/genFilters vs `searchCriteria`) before writing query strings. → `data-fetching`.

## 3. Queries & mutations

Triple-export query modules; thin mutation wrappers with call-site invalidation. → `data-fetching`.

## 4. Route + loader

Register the route with `loader` (prefetch via shared configs) + `hydrateFallbackElement` + `shouldRevalidate`; add the `buildRoute` object. → `project-structure`, `data-fetching`, `ux-states`.

## 5. Forms (if applicable)

`formFields.ts` + `useAppForm` + registered field components + validators + unsaved-changes guard. → `forms`.

## 6. Components & UI

DS-first: run the enumeration, compose from `@autodocdev/autodoc-ui`, local components only for verified gaps. Full-page recipes: `create-list-view`, `create-detail-edit-view`. → `design-system`, `components`.

## 7. Translations

Every user-facing string goes through typed i18n — including text handed to you in the task (treat it as source content for a new key, never inline it). Update the 3 locale JSONs AND the key type together. → `typescript-conventions`.

## 8. Verify

- TypeScript compiles; `t('NEW_KEY')` has no type errors.
- Lint passes on touched files; import order follows the spec (→ `project-structure`).
- New files follow folder/naming conventions.
- Loading/error/empty states covered (→ `ux-states`).
- React quality pass (→ `react-performance`; project conventions win on any conflict).

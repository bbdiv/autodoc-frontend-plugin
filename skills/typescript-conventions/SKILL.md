---
name: typescript-conventions
description: TypeScript conventions for Autodoc MFEs - where rigor lives (data layer vs glue), I-prefix domain models, IApiReturn envelope + isApiError guard, literal unions, typed i18n via codegen, hand-written .d.ts for externals. Use when writing types, models, API typings, or i18n keys - "criar um tipo", "tipar a resposta da API", "model", "interface", "enum ou union", "traduzir", "adicionar chave de tradução", "create a type/interface/model", "type the API response", "add a translation key".
---

# TypeScript conventions

## Where rigor lives (the honest split)

Both tsconfigs: `strict: true` **with** `noImplicitAny: false`. The practiced meaning:
- The **data layer is fully typed**: models, API envelopes, axios generics, form values, filter shapes.
- **Implicit any is tolerated only at wiring params**: mutation-hook wrapper args `(customerId, { onSuccess, onError })`, loader `({ params })`, callback params — where the fully-typed alternative is TanStack/router generic noise. The payloads flowing THROUGH those functions stay typed.
- **Never** explicit `: any`/`as any` in domain code. **Never** `@ts-ignore`/`@ts-expect-error` (zero in ~400 reference files) — fix the type, or cast the single expression as a last resort.

## Domain models

**Rule:** `I` prefix marks domain/entity types (`IUser`, `IFilter`, `IApiReturn`) — including type aliases (`type IModules = 'workforce' | ...`). Component props are `<Name>Props` without `I`. One entity file under `@models/<entity>/`, main interface default-exported (see `project-structure`).

**Rule:** Status/lifecycle fields = inline string-literal unions: `status: 'active' | 'inactive' | 'draft'`. Never enums (team decision), never `'active' | 'inactive' | string` (the `| string` absorbs the literals and kills narrowing — real defect in a reference model, don't copy).

**Candidate:** audit fields typed with the shared `IActionMeta` (`{ date: string; user: IUserInfo }`) — `created: IActionMeta; updated?: IActionMeta; deleted: IActionMeta | null;`.

## API boundary

**Rule:** The envelope + guard pair:
```ts
interface IApiReturn<T> { page?: number; size?: number; count?: number; data: T; error?: string; request_id?: string; }
export interface IApiErrorReturn { error: string; message: string; status_code: number; }

function isApiError(r: IApiErrorReturn | IApiReturn<unknown>): r is IApiErrorReturn {
  return (r as IApiErrorReturn).status_code !== undefined;
}
```
Narrow ONLY with the predicate — never ad-hoc property checks. QueryFns normalize errors to the success shape (see `data-fetching`).

**Rule:** Type the axios CALL, not the variable: `instance.get<IApiReturn<IJobFunction[]> | IApiErrorReturn>(url)`. Zero `as` casts in the API layer.

**Rule:** Generic infra takes one `<T>` at the call site: `useSearchParamsHook<T extends Record<string, any>>()`, `createPersistor<T>('localStorage')`, `persistor.getWithMeta<ICustomer>(...)`, `IFilter<K extends string = string>` instantiated as `IFilter<'search' | 'finished'>`.

**Rule:** Type loader data at the read site: `useLoaderData<IUserDetailLoader>()` / `useOutletContext<IUserDetailLoader>()` (team decision). Mutation params: inline literal up to 2 fields, named interface above.

## Typed i18n (differential — no other repo in the ecosystem has it)

**Rule:** Never call `useTranslation` raw. Call `useTypedTranslation`, whose `t` accepts only dot-paths derived from the pt-Br locale:

1. pt-Br locale JSON is the source of truth for key existence;
2. `scripts/genTranslationsType.ts` (run MANUALLY after editing the locale — it is not wired to npm) writes the committed `src/locale/translationsKeyType.ts`;
3. `DotNestedKeys<T>` (recursive template-literal type) flattens it to `'A' | 'A.B' | ...`;
4. the hook re-types `t: (key: dottedTranslationsKeys, opts?: Record<string, string | number>) => string`.

A typo'd or missing key is a compile error. Never escape with `t(key as any)` for dynamic keys — restructure the keys instead. Outside components use `translateString` (the non-hook `t`). Forgetting step 2 means new keys type-error at the call site — that's the workflow working.

## Externals get hand-written `.d.ts`

Every import-map external and shell global is typed by a local `types/*.d.ts` (see `mfe-platform`). Ship this WORKING styled-components theme augmentation (the reference's imports a non-resolvable path, which is why `(theme as any)` plagues its styled files — the smell that says the augmentation broke):

```ts
// types/styled.d.ts
import 'styled-components';
import type { ThemeContractTypes } from '@autodocdev/autodoc-ui';

declare module 'styled-components' {
  export interface DefaultTheme {
    vars: ThemeContractTypes;
  }
}
```

If a `(theme as any)` appears in a styled file, the augmentation is broken — fix it, don't cast.

## Rights maps (when authorization exists — see `ux-states`)

Const string map, not an enum — improved over the reference with `as const` + a derived union so a misspelled right is a compile error:

```ts
const userRightsMap = {
  ACCESS_GENERAL: 'access::general',
  CREATE_USER: 'create::user',
} as const;
export type UserRight = (typeof userRightsMap)[keyof typeof userRightsMap];
```

## ESLint TS baseline

`tseslint.configs.recommended` with exactly ONE relaxation: `@typescript-eslint/no-require-imports: 'off'` (for the CommonJS codegen scripts). No other TS-rule overrides, no eslint-disables in app code.

## Not practiced (don't introduce without a decision)

`as const` beyond the rights map above, `satisfies`, runtime schema validation (zod/yup), typed `catch (e: unknown)`, branded types, OpenAPI codegen, `tsc --noEmit` scripts.

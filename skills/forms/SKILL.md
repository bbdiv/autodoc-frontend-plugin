---
name: forms
description: TanStack Form v1 patterns for Autodoc MFEs - the app form kit (createFormHook + useAppForm), DS-wrapping field components, validators, Subscribe-gated buttons, edit-vs-create defaults, unsaved-changes guard, multi-tab editors. Use when building or editing any form - "criar um form", "formulário de cadastro", "adicionar um campo", "validação", "form de edição", "multi-etapas", "create a form", "add a field", "validate input", "submit", "registration form", "edit screen".
---

# Forms (TanStack Form v1)

**Step 0:** Confirm `@tanstack/react-form` is in the target repo's `package.json` before writing any of this. Absent → report it and ask; never install it or scaffold the kit on your own.

## The form kit — one per MFE

**Rule:** `src/@form/index.ts` creates the kit ONCE: `createFormHookContexts()` + `createFormHook({ fieldComponents })`, registering the app's DS-wrapping field components. All forms consume `useAppForm` / `withForm` from here — never raw `useForm`.

```ts
export const { formContext, fieldContext, useFormContext, useFieldContext } = createFormHookContexts();
export const { useAppForm, withForm } = createFormHook({
  formContext, fieldContext,
  fieldComponents: { TextField, TextAreaField, SwitchField, SelectField, InputWithSearchAndDropdown },
  formComponents: {},
});
```

(Field set is the union of both references — team decision.)

## Field components (`@form/formFields/`)

**Rule:** A registered field wraps the DS input and implements the full contract (canonical: the mf-workforce TextField — team decision):
- reads its value via `useFieldContext<T>()` (ONE generic — never reconstruct the 23-slot `FieldApi<...>` type);
- maps touched + errors → `visualState="error"` + `helperText={errors[0]}`;
- disables itself on `field.state.meta` … `field.form.state.isSubmitting`;
- optional `value`/`onChange` overrides and a `loading` visualState.

```tsx
const field = context ?? useFieldContext<string>();
return (
  <Input
    value={value ?? field.state.value}
    onChange={(e) => (onChange ? onChange(e.target.value) : field.handleChange(e.target.value))}
    disabled={disabled || field.form.state.isSubmitting}
    visualState={loading ? 'loading' : field.state.meta.isTouched && field.state.meta.errors.length > 0 ? 'error' : 'default'}
    helperText={helperText || (field.state.meta.isTouched && field.state.meta.errors.length > 0 ? field.state.meta.errors[0] : '')}
    {...props}
  />
);
```

## Adding a field — the priority ladder

**A.** Use an existing registered field component (`field.TextField`, `field.SelectField`, ...).
**B.** Create a NEW registered field component when the need is reusable: follow the field contract above, wrap a DS primitive, register it in `@form/index.ts` `fieldComponents`.
**C.** Use a component inline inside `AppField` `children` only when the field is one-off/too specific:
```tsx
<formInstance.AppField name="projects" children={(field) => (
  <TreeSelect value={field.state.value} onChange={field.handleChange} data={groups ?? []} />
)} />
```
Never skip straight to C when the need will recur.

## Validation

**Rule:** Field-level validators as the trio `validators={{ onMount, onChange, onSubmit }}` using shared helpers from `@form/helpers.ts` (`emptyFieldStringValidation`, `isValidEmail` — return a message from `@form/errorTexts.ts` or `undefined`). Pass helpers as bare references (team decision). `onMount` makes required-empty fields count against `canSubmit` from first render, so the save button starts disabled.

There is no schema library (no zod/yup) and no form-level validators — don't introduce them without a team decision.

**Candidate — async server validation** (email-exists, CEP lookup): `onChangeAsyncDebounceMs: 500` + `onChangeAsync`, fetching through the query layer's exported configs (`queryClient.fetchQuery({ ...getXConfigs(...), retry: false })`); CEP variant back-fills sibling fields via `formInstance.setFieldValue`. Alternative form (also practiced): a reactive query (`useGetCepAddress(cep)` with `enabled: cep.length === 8`) + a sync effect writing `form.setFieldValue` on `[data, isSuccess]` — use the validator form when the lookup must gate submission, the effect form when it only fills fields.

## Form shell

**Rule:** Native `<form>` wrapping the content:
```tsx
onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void formInstance.handleSubmit(); }}
```
(`stopPropagation` matters — multiple MFEs share the DOM.)

**Rule:** Footer buttons gated by `Subscribe` render-props; the save button includes the mutation's `isPending`:
```tsx
<formInstance.Subscribe>
  {({ canSubmit, isSubmitting, isPristine }) => (
    <Button size="small" variant="solid" type="button" onClick={() => formInstance.handleSubmit()}
      disabled={!canSubmit || isSubmitting || isPristine || isPending}>
      {saveLabel}
    </Button>
  )}
</formInstance.Subscribe>
```
The back link intercepts clicks: `preventDefault` while `isSubmitting`; open the unsaved-changes modal when `isDirty`.

**Rule:** Form state needed OUTSIDE JSX comes from `useStore(formInstance.store, selector)` — `formInstance.state` reads are not reactive:
```ts
const isDirty = useStore(formInstance.store, (s) => s.isDirty);
```

## Defaults, edit-vs-create, colocated types

**Rule:** Decide create vs edit from loader data (`newOrId === 'new'`, `loaderData?.user`) and feed `useAppForm` either the entity mapped to form shape or the typed empty defaults. Never mutate the form after mount to "load" data — the loader already prefetched, and defaults-as-persisted-values keep `isDirty`/`isPristine` correct.

**Rule:** Each form's value type + defaults live in a colocated `formFields.ts` exporting the RAW typed values object (not a `{defaultValues}` wrapper — team decision):
```ts
export const newUserFormDefaultValues: INewUserFormValues = { users: [...], profile: '', ... };
```

## Composition

**Rule:** Split large forms into `withForm({ defaultValues, props, render })` section components receiving the parent's `formInstance` as `form` — type-safe access to the parent's fields without prop-drilling. Declare the same `defaultValues` for typing.

**Rule:** Cross-field derivation (select option → fill alias; email lookup → fill name) via `formInstance.setFieldValue('other', ...)` in the source field's onChange — derived values stay in the form store (dirty tracking, validation).

**Rule:** Multi-section entity editors = parent route rendering shared chrome + `<Outlet/>`; each tab is a child route owning its own `useAppForm`, submit and guard; loader data reaches tabs via `useOutletContext<T>()`. Tab switching must not carry dirty state across concerns.

## Submit

Always through the mutation wrapper with call-site `onSuccess` (notification + invalidation + navigation) and `isPending` in the disable expression — full rules in `data-fetching`. Never `await api.createX(...)` inside `onSubmit`.

## Unsaved-changes guard

**Rule:** Page-level editors guard dirty state with the shared hook (canonical: mf-workforce version — blocks only when `pathname` actually changes):
```ts
export const useUnsavedChanges = (hasUnsavedChanges: boolean) => {
  const [showModal, setShowModal] = useState(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname) {
      setShowModal(true);
      return true;
    }
    return false;
  });
  return { showModal, setShowModal, blocker };
};
```
Wire `NotSavedValuesModal`: onOk = `formInstance.handleSubmit()`; onCancel(leave) = `blocker.proceed?.()`; onClose = stay. Not used inside modals — only routed editors.

## Form-adjacent state

**Rule:** Screen state that belongs to the form's lifecycle but not its values (a permissions table beside the form, a modal→editor draft) lives in a dedicated zustand store, reset in the unmount cleanup together with `formInstance.reset()` (see `state-management` for store shape and the reset-every-field requirement).

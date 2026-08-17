# Editors and validation

Which control a cell opens when it starts editing, and what stops a bad value
being committed. Both follow from the column: `meta.type` picks the editor,
`meta.validate` guards the field.

```demo
file: editing/EditorsAndValidation.tsx
hint: Type a single letter into String, or 5 into Number, to see validation refuse.
height: 440
```

## The built-in editors

`meta.type` picks one, and `meta.options` feeds the select editors from the
same source the filter panel reads.

| `meta.type` | Editor |
| --- | --- |
| `string` (default) | Text input |
| `number` | Number input |
| `boolean` | Checkbox |
| `date` | Native `<input type="date">` |
| `select` | Searchable select from `meta.options` - commits on pick under `"cell"` |
| `multiSelect` | Multi-select, same source |

Each ships as a named export (`TMDataGridStringEditor`,
`TMDataGridNumberEditor`, `TMDataGridBooleanEditor`, `TMDataGridDateEditor`,
`TMDataGridSelectEditor`, `TMDataGridMultiSelectEditor`), so a custom editor
can wrap one rather than starting over.

## Writing your own

`meta.editor` fills the same slot the built-ins do. It is a **component** -
rendered as JSX, so hooks are legal inside - receiving the live TanStack Form
`field` API. Bind any control to it exactly as you would inside a form:

```tsx
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => (
  <Slider
    value={field.state.value}
    onChange={field.handleChange}
    onChangeEnd={() => void commit()}
  />
);

meta: { editor: SalaryEditor }
```

**Define editors at module scope.** An inline arrow gets a new identity every
render, which remounts the editor mid-edit and loses what was being typed.

## Validation

Nothing invented here - the validators are TanStack Form's own, Standard Schema
included, so a Zod schema passes straight through.

```tsx
// Per column: field-level validators. A bare schema means { onChange: schema }.
meta: { validate: z.string().min(2, "Too short") }

// Per row: form-level validators - cross-field rules live here.
useTMDataGrid({
  editMode: "cell",
  rowValidators: {
    onSubmit: z.object({ salary: z.number().positive() })
      .refine((r) => r.status !== "Terminated" || r.salary === 0, {
        message: "A terminated employee has no salary",
      }),
  },
});
```

Pathed issues land on the matching cells; pathless ones on the row.

A commit blocked by validation keeps the editor open with the message on the
input. A rejected `onEditCommit` keeps the draft too, with the error on the row.
Server-side field errors can be returned natively through
`rowValidators.onSubmitAsync`'s `{ form, fields }` shape.

Cross-field rules want a mode that commits the whole row at once. Under
`"cell"` each cell commits alone, so a rule spanning two columns cannot be
satisfied by either one; `"row"` and `"batch"` are where `rowValidators.onSubmit`
earns its place - see [Editing](/docs/editing#row-editing).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `meta.editor` | Column meta | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. |
| `meta.validate` | Column meta | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema means `onChange`. |
| `rowValidators` | Option | `TMDataGridRowValidators` | – | Form-level validation, for cross-field rules. |
| `TMDataGridEditorArgs` | Export | type | – | What an editor component receives - `field`, `commit`, `cancel`, `row`, `column`. |
| `TMDataGridStringEditor` · `NumberEditor` · `BooleanEditor` · `DateEditor` · `SelectEditor` · `MultiSelectEditor` | Exports | components | – | The six built-ins, for wrapping. |
| `normalizeFieldValidate` | Export | `(validate) => validators` | – | Turns a bare schema into TanStack Form's validator shape. |
| `getEditFieldName` | Export | `(column) => string` | – | The data path a column's edits write to. |

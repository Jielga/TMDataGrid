# Editors and validation

Which control a cell opens when editing starts, what the value becomes on the
way in, and what prevents a bad one being committed. All three follow from the
column: `meta.type` picks the editor, and `meta.edit` holds the rest.

```demo
file: editing/EditorsAndValidation.tsx
hint: Type a single letter into String, or 5 into Number, to see validation reject it.
height: 440
```

## The built-in editors

`meta.type` picks one, and `meta.options` feeds the select editors from the same
source the filter panel reads. Neither lives under `meta.edit`.

| `meta.type` | Editor |
| --- | --- |
| `string` (default) | Text input |
| `number` | Number input |
| `boolean` | Checkbox |
| `date` | Native `<input type="date">` |
| `select` | Searchable select from `meta.options`. Commits on pick under `"cell"` |
| `multiSelect` | Multi-select, same source |

Each is a named export (`TMDataGridStringEditor`, `TMDataGridNumberEditor`,
`TMDataGridBooleanEditor`, `TMDataGridDateEditor`, `TMDataGridSelectEditor`,
`TMDataGridMultiSelectEditor`), so a custom editor can wrap one instead of
starting from scratch.

## Writing your own

`meta.edit.editor` fills the same slot as the built-ins. It is a **component**,
rendered as JSX, so hooks may be used inside, and it receives the live TanStack
Form `field` API. Bind any control to it as you would inside a form:

```tsx
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => (
  <Slider
    value={field.state.value}
    onChange={field.handleChange}
    onChangeEnd={() => void commit()}
  />
);

meta: { edit: { editor: SalaryEditor } }
```

**Define editors at module scope.** An inline arrow function gets a new identity
on every render, which remounts the editor mid-edit and discards what was typed.

## Mapping the value as it is typed

A column can rewrite every value on its way into the draft: uppercase a code,
strip spaces out of an IBAN, clamp a number into range. `meta.edit.mapValue`
runs on each write an editor makes, which is each keystroke for a text input and
each pick for a select.

```demo
file: editing/MappedInput.tsx
hint: Type into either column. Code uppercases, Reference keeps digits only.
height: 420
```

```tsx
meta: {
  edit: {
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}
```

What it returns is what the cell shows, what the validators check and what is
committed.

The map is applied inside the editor host, around the field every editor writes
through, so one declaration covers all six built-in editors, your own
`meta.edit.editor`, and the character that opened the editor when typing started
the edit.

Two writes are not mapped: the value the editor opens with, and
`edit.clearCell()`, the Delete key, which writes the type's empty value through
the form rather than through an editor. An editor calling `field.setValue`
instead of `field.handleChange` also bypasses the map. `handleChange` is the
mapped path.

The map receives the row and column as well, so it can depend on the record
being edited:

```tsx
meta: {
  edit: {
    mapValue: ({ value, row }) =>
      row.original.country === "SE" && typeof value === "string"
        ? value.replace(/ /g, "")
        : value,
  },
}
```

`previous` is the value the field held before this write, which a mask needs in
order to tell an insertion from a deletion.

### Keeping the caret

A mapped value differs from the one the input holds, so React writes the new
value into the DOM node and the browser collapses the selection to the end of
the field.

The built-in string and number editors restore the caret to where it was typed,
shifted by however much the map changed the length, so a mask that inserts or
strips characters keeps the caret beside the same text.

A custom editor rendering its own input has the same problem, and solves it the
same way: record `selectionStart` as the value is handed over, and restore it in
a layout effect once the mapped value has rendered.

## Validation

The validators are TanStack Form's own, Standard Schema included, so a Zod
schema passes straight through.

```tsx
// Per column: field-level validators. A bare schema means { onChange: schema }.
meta: { edit: { validate: z.string().min(2, "Too short") } }

// Per row: form-level validators - cross-field rules live here.
useTMDataGrid({
  editing: {
    mode: "cell",
    rowValidators: {
      onSubmit: z.object({ salary: z.number().positive() })
        .refine((r) => r.status !== "Terminated" || r.salary === 0, {
          message: "A terminated employee has no salary",
        }),
    },
  },
});
```

Pathed issues land on the matching cells; pathless ones on the row.

A commit blocked by validation keeps the editor open with the message on the
input. A rejected `editing.onCommit` keeps the draft too, with the error on the
row. Server-side field errors can be returned natively through
`editing.rowValidators.onSubmitAsync`'s `{ form, fields }` shape.

Cross-field rules need a mode that commits the whole row at once. Under
`"cell"` each cell commits alone, so a rule spanning two columns cannot be
satisfied by either one. Use `editing.rowValidators.onSubmit` with `"row"`. See
[Editing](/docs/editing#row-editing).

A rule about the whole collection, such as "at least one row" or "no
duplicates", is neither a field rule nor a row rule. It belongs to a form around
the grid. See [A query builder inside a form](/docs/query-builder).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `meta.edit.editor` | Column meta | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. |
| `meta.edit.validate` | Column meta | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema means `onChange`. |
| `meta.edit.mapValue` | Column meta | `TMDataGridEditValueMap` | – | Maps each value an editor writes, before it reaches the draft. |
| `editing.rowValidators` | Option | `TMDataGridRowValidators` | – | Form-level validation, for cross-field rules. |
| `TMDataGridEditorArgs` | Export | type | – | What an editor component receives: `field`, `commit`, `cancel`, `row`, `column`. |
| `TMDataGridEditValueMapArgs` | Export | type | – | What `mapValue` receives: `value`, `previous`, `row`, `column`, `table`. |
| `TMDataGridStringEditor` · `NumberEditor` · `BooleanEditor` · `DateEditor` · `SelectEditor` · `MultiSelectEditor` | Exports | components | – | The six built-ins, for wrapping. |
| `normalizeFieldValidate` | Export | `(validate) => validators` | – | Turns a bare schema into TanStack Form's validator shape. |
| `getEditFieldName` | Export | `(column) => string` | – | The data path a column's edits write to. |

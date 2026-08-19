# A query builder inside a form

A search form owns dates, a title filter, and a list of extra conditions.
The conditions are rows, so the condition builder is a grid - packaged as a
form field, with the rows coming in through `value` and every approved change
going back out through `onChange`.

```demo
file: recipes/QueryBuilderForm.tsx
hint: Add a condition and pick Status - the value editor becomes a select. Delete every condition, or repeat one, and Search says why it will not.
height: 560
```

The ownership line is the whole recipe: **the form owns the array, the grid
owns the row being typed into**. The grid never mutates `data`, so the form's
state is only ever what the user has approved, and the grid's own per-row form
holds whatever is mid-edit.

## The field contract

The grid is wrapped once, as an ordinary controlled component:

```tsx
function ConditionsGrid({ value, onChange }: {
  value: Array<QueryCondition>;
  onChange: (next: Array<QueryCondition>) => void;
}) {
  const grid = useTMDataGrid({
    data: value,
    columns,
    getRowId: (row) => String(row.id),
    editMode: "row",
    rowValidators,
    onEditCommit: ({ rowId, value: row }) =>
      onChange(value.map((c) => (String(c.id) === rowId ? row : c))),
    onRowAdd: ({ value: row }) =>
      onChange([...value, { ...row, id: Math.min(0, ...value.map((c) => c.id)) - 1 }]),
    onRowDelete: ({ rowId }) =>
      onChange(value.filter((c) => String(c.id) !== rowId)),
    newRowDefaults: () => ({ id: 0, field: "title", operator: "contains", value: "" }),
  });
  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<QueryCondition> />
    </TMDataGrid>
  );
}
```

And handed to the form as a field:

```tsx
<form.Field
  name="conditions"
  validators={{
    onChange: ({ value }) =>
      value.length === 0 ? "Add at least one condition" : undefined,
  }}
>
  {(field) => (
    <ConditionsGrid value={field.state.value} onChange={field.handleChange} />
  )}
</form.Field>
```

`field.handleChange` **is** the `onChange`: it writes the array into the form
and runs the field's validators. `onChange` carries the whole next array
rather than a diff, because the form is the owner - the grid reports outcomes,
and the form decides what owning them means.

Three details carry the correctness:

- **Map by row id, never by index.** A sort or a delete moves the index; the
  draft is keyed by the id.
- **`data` identity stays stable.** `field.state.value` changes identity only
  when a row is actually written, which is what `data` requires - see
  [useTMDataGrid](/docs/use-tm-data-grid).
- **New rows count down from `-1`.** `Math.min(0, ...ids) - 1`, so an emptied
  grid starts at `-1` rather than `-Infinity`, existing negative ids keep
  descending, and the server can tell unsaved rows from real ones. The grid's
  own `tempId` never leaves the grid - the id you mint in `onRowAdd` is the
  one the form sees.

## Which half validates what

**A rule that can be decided from one row belongs to the grid. A rule that
needs the other rows, or the collection as a whole, belongs to the form.**

| Rule | Owner | Written as |
| --- | --- | --- |
| "The condition needs a value" | Grid | `rowValidators.onSubmit` |
| "A date, for a date field" | Grid | `meta.editor` per column |
| "At least one condition" | Form | the `conditions` field's `onChange` validator |
| "No two conditions repeat a field and operator" | Form | the same place |

This is a consequence, not a convention. A row's form is seeded with that
row's values and nothing else, so it cannot see the array. And the grid's
`edit.store` publishes field names, never values, so the form cannot see a
draft. Each side validates exactly what it can see - which is also what keeps
the form's validators cheap: they run once per approved row, never per
keystroke.

## Editors that follow the row

In a `[field, operator, value]` builder the value cell means something
different on every row. `meta.editor` receives the row's live form, so one
component switches on the *draft* field - not the committed one - and picking
a new field resets its dependents:

```tsx
const FieldEditor: TMDataGridEditorComponent = ({ field, form, size }) => (
  <Select
    size={size}
    data={[...FIELDS]}
    value={String(field.state.value)}
    onChange={(next) => {
      if (next === null) return;
      field.handleChange(next);
      form.setFieldValue("operator", OPERATORS[next as QueryField][0]);
      form.setFieldValue("value", "");
    }}
  />
);
```

The operator and value editors read the sibling with
`useSelector(form.store, (state) => state.values.field)`, so switching Field
mid-edit switches them instantly. See
[Editors and validation](/docs/editors) for the full editor contract.

## Which mode

`editMode: "row"`. A condition is approved as a unit - the pencil opens the
whole row, Save commits it, and `onEditCommit` hands the form one finished
condition. The form's rules re-run at that moment and never earlier.

**Not `"batch"`.** Batch parks every draft inside the grid and calls nothing
until `edit.submitAll()`. The form's array goes stale the moment typing
starts: "at least one condition" counts rows the user may have marked for
deletion, a duplicate sitting in a draft passes unseen, and the form's submit
would save an array missing every pending edit. Batch has its own transaction
boundary, and a form around it is a second one over the same data.

If batch is what you want anyway, invert the ownership of the save:
`grid.edit.submitAll()` becomes the only way rows reach the form, and the
form's submit is gated on the grid holding no draft -
`useSelector(grid.edit.store, (s) => s.openRowIds.length === 0)`.

## Submitting

The invariant on the Search button: **the form submits only while the grid
holds no draft.**

```tsx
const hasOpenDraft = useSelector(grid.edit.store, (s) => s.openRowIds.length > 0);

<Button type="submit" disabled={!canSubmit || hasOpenDraft}>
  {hasOpenDraft ? "Finish the open condition" : "Search"}
</Button>
```

The alternative is to flush instead of block:
`await grid.edit.submitAll()` before `form.handleSubmit()` commits every open
row through the normal `onEditCommit` path - it works in every mode, not just
batch - and rows that fail their own validation stay open, which fails the
submit honestly.

Two reassurances about putting a native `<form>` around a grid:

- The grid's buttons cannot submit it. Mantine buttons default to
  `type="button"`, so only your own `type="submit"` button submits.
- Enter inside a cell editor commits the cell, not the form - the editor
  prevents the default, so implicit form submission never fires.

## Reference

This page introduces no API of its own. The pieces it composes:

| Piece | Documented on |
| --- | --- |
| `data`, `getRowId`, `editMode`, `onEditCommit`, `onRowAdd`, `onRowDelete`, `newRowDefaults`, `edit.store` | [Editing](/docs/editing) |
| `rowValidators`, `meta.editor`, the editor contract | [Editors and validation](/docs/editors) |
| `useForm`, `form.Field`, field validators | TanStack Form's own docs |

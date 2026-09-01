# A query builder inside a form

A search form holds dates, a title filter and a list of extra conditions. The
conditions are rows, so the condition builder is a grid, wrapped as a form
field: rows come in through `value`, and approved changes go back out through
`onChange`.

```demo
file: recipes/QueryBuilderForm.tsx
hint: Add a condition and pick Status - the value editor becomes a select. Delete every condition, or repeat one, and Search says why it will not. Sample file imports five rows, one of which the file's own rules reject.
height: 560
extraSources: data/conditionCsv.ts
```

The form holds the array; the grid holds the row being edited. The grid never
mutates `data`, so the form's state is only ever what the user has approved.

## Wrapping the grid as a field

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
    editing: {
      mode: "row",
      rowValidators,
      onCommit: ({ rowId, value: row }) =>
        onChange(value.map((c) => (String(c.id) === rowId ? row : c))),
      onRowAdd: ({ value: row }) =>
        onChange([
          ...value,
          { ...row, id: value.reduce((low, c) => Math.min(low, c.id), 0) - 1 },
        ]),
      onRowDelete: ({ rowId }) =>
        onChange(value.filter((c) => String(c.id) !== rowId)),
      newRowDefaults: () => ({ id: 0, field: "title", operator: "contains", value: "" }),
    },
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

`field.handleChange` is the `onChange`: it writes the array into the form and
runs the field's validators. `onChange` carries the whole next array rather than
a diff.

- **Map by row id, never by index.** A sort or a delete moves the index; the
  draft is keyed by the id.
- **`data` identity stays stable.** `field.state.value` changes identity only
  when a row is written, which is what `data` requires.
  See [useTMDataGrid](/docs/use-tm-data-grid).
- **New rows count down from `-1`.** `ids.reduce(Math.min, 0) - 1`, so an
  emptied grid starts at `-1` rather than `-Infinity` and existing negative ids
  keep descending. A fold rather than `Math.min(0, ...ids)`, which spreads
  every id onto the call stack and throws `RangeError` past about 100 000 of
  them - reachable in one import. The grid's `tempId` never leaves the grid:
  the id you assign in `editing.onRowAdd` is the one the form sees.

## Importing a file

The import is a form write, not a grid action. The file is parsed, every
record is checked against the same vocabulary the editors offer, and the rows
that pass are appended in **one** `onChange`:

```tsx
const importCsv = (text: string) => {
  const result = readCsv(text, value);
  if (result.added.length > 0) onChange([...value, ...result.added]);
  setReport(importReport(result));
};
```

`editing` has a bulk entry point of its own -
`edit.addRows(rows, { commit: true })`, on [Editing](/docs/editing) - and it is
the right one when the grid owns the rows: each row is seeded, validated and
committed, and a row that fails stays open in the entry block carrying its
error. It is the wrong one here. Every commit calls `editing.onRowAdd`, and in
this recipe that is one array copy, one run of the `conditions` field's
validators and one row model - per line. A file's worth of them is quadratic
work, and each `onRowAdd` closes over the `value` that was current when the
grid rendered, so the adds after the first would write over each other.

Two consequences of importing this way:

- **The file is validated by your reader, not by the row validators.**
  A row that never opens an editor never runs `editing.rowValidators`, so the
  reader checks the field, the operator and the value itself and reports the
  lines it rejected. The grid's rules still hold for everything typed.
- **Ids are assigned in the same pass.** The reader counts down from the
  form's lowest id, so an import and the Add condition button mint ids from
  the same sequence.

Reading the file is the cheap half - a 20 000-row, 0.6 MB file parses in about
30 ms. What costs is what the array reaches: the field validators run over
every condition, so a collection rule written with a scan per row
(`pairs.indexOf(pair)` inside a loop) is what makes a large import stall.
Keyed through a `Set`, the same rule over 20 000 conditions costs about 15 ms
against about 4 seconds.

One design consequence shows up only at that size. The availability columns are
joined into the rows so that `hours` is a real accessor - it sorts and filters
like any other column - and the join rebuilds the array, so one condition's
result re-materializes every row and hands the table a new `data` identity. At
two conditions that is free; at 20 000 each calculation costs a row model. Keep
the joined shape while the column has to sort, and move the value out to a
store the cell subscribes to (the way the date range already is) when it does
not.

## Where validation belongs

A rule that can be decided from one row belongs to the grid. A rule that needs
the other rows, or the collection as a whole, belongs to the form.

| Rule | Owner | Written as |
| --- | --- | --- |
| "The condition needs a value" | Grid | `editing.rowValidators.onSubmit` |
| "A date, for a date field" | Grid | `meta.edit.editor` per column |
| "At least one condition" | Form | the `conditions` field's `onChange` validator |
| "No two conditions are identical" | Form | the same place |

A row's form is seeded with that row's values only, so it cannot see the array,
and the grid's `edit.store` publishes field names but not values, so the form
cannot see a draft.

## Editors that follow the row

In a `[field, operator, value]` builder the value cell means something
different on every row. `meta.edit.editor` receives the row's live form, so one
component can switch on the *draft* field rather than the committed one, and
picking a new field resets its dependents:

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

The operator and value editors read the sibling with TanStack Store's
[`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference):
`useSelector(form.store, (state) => state.values.field)`, so switching Field
mid-edit switches them immediately. See
[Editors and validation](/docs/editors) for the editor's full API.

## Which mode

`editing.mode: "row"`. A condition is approved as a unit: the pencil opens the
whole row, Save commits it, and `editing.onCommit` hands the form one finished
condition. The form's rules run at that point.

**Not `draft: true`.** A draft store holds every commit inside the grid and
calls nothing until `edit.saveDrafts()`, so the form's array goes stale the
moment typing starts: "at least one condition" counts rows the user may have
marked for deletion, a duplicate sitting in a draft passes unseen, and the
form's submit saves an array missing every pending edit.

To use the store anyway, invert where the save happens: `grid.edit.saveDrafts()`
becomes the only way rows reach the form, and the form's submit is gated on the
grid holding no draft -
`useSelector(grid.edit.store, (s) => s.openRowIds.length === 0)`.

## Submitting

The form submits only while the grid holds no draft.

```tsx
const hasOpenDraft = useSelector(grid.edit.store, (s) => s.openRowIds.length > 0);

<Button type="submit" disabled={!canSubmit || hasOpenDraft}>
  {hasOpenDraft ? "Finish the open condition" : "Search"}
</Button>
```

The alternative is to flush instead of block. `await grid.edit.commitAll()`
before `form.handleSubmit()` submits every open row through the normal
`editing.onCommit` path, in every mode; with `draft: true` follow it with
`grid.edit.saveDrafts()`. Rows that fail their own validation
stay open, so the submit fails.

Two constraints apply to a native `<form>` around a grid:

- The grid's buttons cannot submit it. Mantine buttons default to
  `type="button"`, so only your own `type="submit"` button submits.
- Enter inside a cell editor commits the cell, not the form. The editor
  prevents the default, so implicit form submission never fires.

## Reference

The pieces this recipe composes:

| Piece | Documented on |
| --- | --- |
| `data`, `getRowId`, `editing.mode`, `editing.onCommit`, `editing.onRowAdd`, `editing.onRowDelete`, `editing.newRowDefaults`, `edit.addRows`, `edit.store` | [Editing](/docs/editing) |
| `editing.rowValidators`, `meta.edit.editor`, the editor contract | [Editors and validation](/docs/editors) |
| `useForm`, `form.Field`, field validators | TanStack Form's own docs |

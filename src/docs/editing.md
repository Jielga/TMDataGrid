# Editing

Set `editMode` and the grid's cells open editors. One TanStack Form is created
per editing row (*one row, one form*), and **the grid never mutates `data`**:
`onEditCommit` applies the change wherever the data actually lives, and the new
rows flow back in through `data` as always.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  editMode: "cell",
  onEditCommit: async ({ rowId, value, changes }) => {
    await api.patch(rowId, changes);
  },
});
```

`getRowId` is **required**: drafts are keyed by row id, and the index fallback
would point a draft at a different record after any sort.
`@tanstack/react-form` becomes a peer dependency once editing is used.

The editing options travel together, and the types say so: setting any of them
without `editMode` is a compile error (they would act on nothing), the moment
`editMode` is set `getRowId` stops being optional, and `onEditCommitBatch` only
exists under `editMode: "batch"` - the one mode whose `submitAll` calls it.
Batch *without* `onEditCommitBatch` stays legal; `submitAll` falls back to the
per-row `onEditCommit` loop.

## The four modes

`editMode` is one axis, and each mode is a policy over the same engine.

| Mode | Commit | Cancel | Chrome |
| --- | --- | --- | --- |
| `"cell"` | Enter, Tab, blur - as in Sheets | Escape | none |
| `"cellConfirm"` | ✓ or Enter only; blur keeps the draft | ✕ or Escape | ✓ / ✕ beside the input |
| `"row"` | Save in the edit lane, or Ctrl+Enter | Cancel, or Escape | generated edit lane |
| `"batch"` | `edit.submitAll()` | `edit.cancelAll()` | `TMDataGridEditActions` |

```demo
file: editing/CellEditing.tsx
hint: Double-click a cell - or press Enter, F2, or just start typing on it.
height: 440
```

**Opening an editor**: double-click, or with the cell cursor on the cell -
Enter, F2, or just typing, where the character replaces the value as it would
in a spreadsheet. Delete or Backspace clears the value and commits without
opening anything. Editing brings cell selection along: `cellSelection` defaults
to `"single"` while `editMode` is set.

### Row editing

The pencil opens every cell of the row at once and ✓ saves them as **one
commit** - which is where a cross-field rule can finally live, because the
whole row is being validated together.

```demo
file: editing/RowEditing.tsx
hint: Put a Sales row over 60 000 kr and Save will tell you why it will not.
height: 440
```

### Batch editing

Under `"batch"` nothing commits until you say so. Enter and Tab **park** the
draft (dirty-marked, Tab moving on to the next editable cell), Escape drops the
one draft, and drafts accumulate across rows - surviving filters, sorts and
scrolling, since they live outside the DOM.

`TMDataGridEditActions` in the toolbar is the chrome: Save with the dirty-row
count, and Discard.

```demo
file: editing/BatchEditing.tsx
hint: Edit cells, add rows in the sticky entry block, mark deletions with the trash - nothing leaves the grid until Save.
height: 440
```

`edit.submitAll()` commits every open row - through the per-row `onEditCommit`
loop by default, or through one `onEditCommitBatch({ rows, added, deleted })`
call when that is set. Rows failing validation stay open either way, and a
rejected batch keeps every draft.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.editField` for a column built on `accessorFn`. Dot paths reach into
nested records - `accessorKey: "address.city"` edits `values.address.city`, and
a nested schema's issues land on the right column.

| Gate | Effect |
| --- | --- |
| `meta.editable: false` | The column never edits |
| `meta.editable: (row) => boolean` | Per row, per column |
| `isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes never edit.

```demo
file: editing/EditableGating.tsx
hint: ID never edits · Salary refuses on Terminated rows · rows under 25 are closed entirely · Full name is computed but writes to Last name.
height: 440
```

## Drafts survive scrolling

Forms live outside the DOM, keyed by row id. Scrolling an editing row away
unmounts the editor; the form keeps its values, dirty state and errors, and the
editor remounts over the same form when the row returns.

Cell corners mark the state meanwhile: blue for a dirty draft, red for a
validation error.

## Adding and deleting rows

`edit.addRow()` opens an **entry row** in a sticky block under the header - the
one place stickiness is genuinely required, since a row being typed into exists
nowhere else to scroll back to. Entry cells are real editors over a form seeded
from `newRowDefaults`. Enter, or the lane's ✓, commits the add through
`onRowAdd` under the immediate modes, while batch parks it for `submitAll`.
Escape, or ✕, discards the entry.

```tsx
useTMDataGrid({
  editMode: "batch",
  newRowDefaults: () => ({ id: 0, name: "", hired: today() }),
  onEditCommitBatch: async ({ rows, added, deleted }) => {
    await api.saveBatch({ rows, added, deleted });
  },
});

<Button onClick={() => grid.edit.addRow()}>Add row</Button>
```

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` straight away under
the immediate modes - confirmation, if you want it, belongs in that callback.
Under batch it toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane's trash becomes a restore, and `submitAll` reports
the ids in `deleted`. Setting `onRowDelete` puts the trash can in the edit lane,
which appears in any mode that has a use for it.

The grid still never mutates `data`: adds and deletes are applied by you, and
the new rows arrive back through `data`. The engine's `tempId` (`__new__1`, …)
never needs to become a real id - mint one when you create the record.

## The engine: `edit`

Everything the chrome does goes through `edit`, which is public.

| Member | Does |
| --- | --- |
| `edit.begin({ rowId, columnId })` | Opens an editor |
| `edit.commit(rowId)` | Commits - resolves `false` if blocked |
| `edit.cancel(rowId)` / `edit.cancelAll()` | Drops drafts |
| `edit.submitAll()` | Commits every open row (batch) |
| `edit.addRow()` / `edit.deleteRow(rowId)` | Rows in and out |
| `edit.getForm(rowId)` | The row's live `FormApi` |
| `edit.store` | Open rows, active cell, dirty and error projections, entry rows, deletion marks |

`getForm` is the *one row, one form* promise made public: render the same form
in a drawer or side panel and it shares values, dirty state and errors with the
inline cells, because it is the same `FormApi`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `editMode` | Option | `"cell" \| "cellConfirm" \| "row" \| "batch"` | – | Turns editing on and picks how commits happen. |
| `getRowId` | Table option | `(row) => string` | – | Required once `editMode` is set. Drafts are keyed by it. |
| `isRowEditable` | Option | `(row) => boolean` | – | Closes a whole row to editing. |
| `onEditCommit` | Callback | `({ rowId, value, changes }) => void \| Promise` | – | Applies one row's change. Reject to keep the draft. |
| `onEditCommitBatch` | Callback | `({ rows, added, deleted }) => void \| Promise` | – | Batch only. One call for the whole save. |
| `newRowDefaults` | Option | `() => TData` | – | Seeds the entry row's form. |
| `onRowAdd` | Callback | `({ row }) => void \| Promise` | – | Commits an added row. |
| `onRowDelete` | Callback | `({ rowId, row }) => void \| Promise` | – | Deletes a row, and puts the trash in the edit lane. |
| `meta.editable` | Column meta | `boolean \| (row) => boolean` | `true` | Whether a column's cells edit. |
| `meta.editField` | Column meta | `string` | The column id | The data path an edit writes to. |
| `EDIT_COLUMN_ID` | Export | `"__edit__"` | – | Id of the generated edit lane. |
| `TMDataGridEditActions` | Component | – | – | Save and Discard for batch mode. |
| `clearedValueForType` | Export | `(type) => unknown` | – | What Delete writes for each column type. |
| `--dg-entry-height` | CSS variable | length | From `size` | Height of the sticky entry block. |
| `data-deleted` | Data attribute | – | – | On a row marked for deletion under batch. |

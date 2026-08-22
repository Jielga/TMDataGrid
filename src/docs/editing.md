# Editing

`@tanstack/react-form` becomes a peer dependency once editing is used.

Set `editMode` and `onEditCommit` on the config and the grid shows editors in the cells when a row/cell gets open for edit. Each row gets a TanStack form wrapper that hold the local form state and calls `onEditCommit` once the form data is committed. So edit works in an uncontrolled React manner by providing data > onEditCommit (onChange).

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

## What requires what

The editing options depend on each other, and the types enforce it. Each line
below is a compile error, not an option that silently does nothing.

| This option                                                                                                              | Requires            | Because                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| `onEditCommit` · `onEditCommitBatch` · `isRowEditable` · `rowValidators` · `newRowDefaults` · `onRowAdd` · `onRowDelete` | `editMode`          | Without a mode there is no editing for them to act on                                           |
| `editMode`                                                                                                               | `getRowId`          | Drafts are keyed by row id, and the index fallback would name a different record after any sort |
| `onEditCommitBatch`                                                                                                      | `editMode: "batch"` | `submitAll` is its only caller                                                                  |

`editMode: "batch"` _without_ `onEditCommitBatch` is fine: `submitAll` falls
back to the per-row `onEditCommit` loop.

## The four modes

All four use the same engine and the same forms. `editMode` sets two things:
what counts as a commit, and which controls trigger it.

| Mode            | Commit                                | Cancel             | Chrome                  |
| --------------- | ------------------------------------- | ------------------ | ----------------------- |
| `"cell"`        | Enter, Tab or blur                    | Escape             | none                    |
| `"cellConfirm"` | ✓ or Enter only; blur keeps the draft | ✕ or Escape        | ✓ / ✕ beside the input  |
| `"row"`         | Save in the edit lane, or Ctrl+Enter  | Cancel, or Escape  | generated edit lane     |
| `"batch"`       | `edit.submitAll()`                    | `edit.cancelAll()` | `TMDataGridEditActions` |

```demo
file: editing/CellEditing.tsx
hint: Double-click a cell - or press Enter, F2, or just start typing on it.
height: 440
```

**Opening an editor**: double-click, or, with the cell cursor on the cell,
Enter, F2, or typing, where the first character replaces the value as it would
in a spreadsheet. The grid places the caret in the cell that was opened, so a
`meta.edit.editor` receives focus without handling it itself. A row added with
`edit.addRow()` opens the same way, with the caret in its first editable cell.

Delete or Backspace clears the value and commits without opening an editor.
Editing implies cell selection: `cellSelection` defaults to `"single"` while
`editMode` is set.

### Row editing

The pencil opens every cell of the row at once, and ✓ saves them as **one
commit**. Cross-field rules belong here, since the whole row is validated
together. Double-clicking a cell opens the whole row, with the caret in the cell
that was clicked.

Rows **accumulate**: opening a second row leaves the first one open, and each
row's ✓ and ✕ act on that row alone.

```demo
file: editing/RowEditing.tsx
hint: Put a Sales row over 60 000 kr and Save reports why it is rejected.
height: 440
```

### Batch editing

Under `"batch"` nothing commits until you ask for it. Enter and Tab **park** the
draft (dirty-marked, Tab moving on to the next editable cell), Escape drops the
one draft, and drafts accumulate across rows - surviving filters, sorts and
scrolling, since they live outside the DOM.

`TMDataGrid.EditActions` in the toolbar provides the controls: Save with the
dirty-row count, and Discard. `renderActions` replaces the pair and hands over
its pieces: `state.pendingCount`, `state.isSubmitting`, the `save` and `discard`
actions, and `Controls.Save` / `Controls.Discard` as the built-in buttons:

```tsx
<TMDataGrid.EditActions
  renderActions={({ state, Controls }) => (
    <Group>
      {state.pendingCount > 0 && <Badge>{state.pendingCount} unsaved</Badge>}
      <Controls.Save />
      <Controls.Discard />
    </Group>
  )}
/>
```

```demo
file: editing/BatchEditing.tsx
hint: Edit cells, add rows in the sticky entry block, mark deletions with the trash. Nothing leaves the grid until Save.
height: 440
```

`edit.submitAll()` commits every open row, through the per-row `onEditCommit`
loop by default, or through one `onEditCommitBatch({ rows, added, deleted })`
call when that is set. Rows failing validation stay open either way, and a
rejected batch keeps every draft.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.edit.field` for a column built on `accessorFn`. Dot paths reach into
nested records: `accessorKey: "address.city"` edits `values.address.city`, and
issues from a nested schema map to the right column.

| Gate                                  | Effect                       |
| ------------------------------------- | ---------------------------- |
| `meta.edit.enabled: false`            | The column never edits       |
| `meta.edit.enabled: (row) => boolean` | Per row, per column          |
| `isRowEditable: (row) => boolean`     | The whole row, in every mode |

Group rows and the generated lanes never edit.

```demo
file: editing/EditableGating.tsx
hint: ID never edits · Salary is closed on Terminated rows · rows under 25 are closed entirely · Full name is computed but writes to Last name.
height: 440
```

## Drafts survive scrolling

Forms live outside the DOM, keyed by row id. Scrolling an editing row away
unmounts the editor; the form keeps its values, dirty state and errors, and the
editor remounts over the same form when the row returns.

Cell corners show the state: blue for a dirty draft, red for a validation
error.

## Adding and deleting rows

`edit.addRow()` opens an **entry row** in a sticky block under the header, so a
row being typed into stays in view. Entry cells are ordinary editors over a form
seeded from `newRowDefaults`. Enter, or the lane's ✓, commits the add through
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

<Button onClick={() => grid.edit.addRow()}>Add row</Button>;
```

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` immediately under
the immediate modes; put any confirmation in that callback. Under batch it
toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane's trash becomes a restore, and `submitAll` reports
the ids in `deleted`. Setting `onRowDelete` puts the trash can in the edit lane.

The grid still never mutates `data`: you apply adds and deletes, and the new
rows arrive back through `data`. The engine's `tempId` (`__new__1`, …) does not
need to become a real id; assign one when you create the record.

## The engine: `edit`

Everything the built-in controls do goes through `edit`, which is public.

| Member                                    | Does                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `edit.begin({ rowId, columnId })`         | Opens an editor                                                                 |
| `edit.commit(rowId)`                      | Commits. Resolves `false` if blocked                                            |
| `edit.cancel(rowId)` / `edit.cancelAll()` | Drops drafts                                                                    |
| `edit.submitAll()`                        | Commits every open row (batch)                                                  |
| `edit.addRow()` / `edit.deleteRow(rowId)` | Adds or removes a row                                                           |
| `edit.getForm(rowId)`                     | The row's live `FormApi`                                                        |
| `edit.store`                              | Open rows, active cell, dirty and error projections, entry rows, deletion marks |

`getForm` exposes the row's form: render it in a drawer or side panel and it
shares values, dirty state and errors with the inline cells, because it is the
same `FormApi`.

For the inverse, a `@tanstack/react-form` form _around_ the grid holding the row
array, see [A query builder inside a form](/docs/query-builder).

## Reference

| Name                          | Kind           | Type                                             | Default           | What it does                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `editMode`                    | Option         | `"cell" \| "cellConfirm" \| "row" \| "batch"`    | –                 | Turns editing on and picks how commits happen.                                                   |
| `getRowId`                    | Table option   | `(row) => string`                                | –                 | Required once `editMode` is set. Drafts are keyed by it.                                         |
| `isRowEditable`               | Option         | `(row) => boolean`                               | –                 | Closes a whole row to editing.                                                                   |
| `onEditCommit`                | Callback       | `({ rowId, value, changes }) => void \| Promise` | –                 | Applies one row's change. Reject to keep the draft.                                              |
| `onEditCommitBatch`           | Callback       | `({ rows, added, deleted }) => void \| Promise`  | –                 | Batch only. One call for the whole save.                                                         |
| `newRowDefaults`              | Option         | `() => TData`                                    | –                 | Seeds the entry row's form.                                                                      |
| `onRowAdd`                    | Callback       | `({ row }) => void \| Promise`                   | –                 | Commits an added row.                                                                            |
| `onRowDelete`                 | Callback       | `({ rowId, row }) => void \| Promise`            | –                 | Deletes a row, and puts the trash in the edit lane.                                              |
| `meta.edit.enabled`           | Column meta    | `boolean \| (row) => boolean`                    | `true`            | Whether a column's cells edit.                                                                   |
| `meta.edit.field`             | Column meta    | `string`                                         | The `accessorKey` | The data path an edit writes to.                                                                 |
| `meta.edit.mapValue`          | Column meta    | `({ value, previous, row, column }) => unknown`  | –                 | Maps each value an editor writes. See [Editors](/docs/editors#mapping-the-value-as-it-is-typed). |
| `EDIT_COLUMN_ID`              | Export         | `"__edit__"`                                     | –                 | Id of the generated edit lane.                                                                   |
| `TMDataGrid.EditActions`      | Component      | –                                                | –                 | Save and Discard for pending edits.                                                              |
| `EditActions` `renderActions` | Slot           | `({ state, actions, Controls }) => ReactNode`    | Built-in pair     | Replaces the buttons, and hands over their pieces.                                               |
| `clearedValueForType`         | Export         | `(type) => unknown`                              | –                 | What Delete writes for each column type.                                                         |
| `--dg-entry-height`           | CSS variable   | length                                           | From `size`       | Height of the sticky entry block.                                                                |
| `data-deleted`                | Data attribute | –                                                | –                 | On a row marked for deletion under batch.                                                        |

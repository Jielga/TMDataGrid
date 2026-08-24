# Editing

`@tanstack/react-form` becomes a peer dependency once editing is used.

Editing is configured through one option, `editing`. `mode` decides what counts
as a commit, and `onCommit` receives it. Each open row gets its own TanStack
Form instance holding the draft; the grid never mutates `data`, so you apply
the commit and the new values arrive back through `data`.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "cell",
    onCommit: async ({ rowId, value, changes }) => {
      await api.patch(rowId, changes);
    },
  },
});
```

`editing` requires `getRowId`: drafts are keyed by row id, and the index
fallback would name a different record after any sort. `onCommitDrafts` is
accepted only under `mode: "draft"`. Both are compile errors rather than options
that silently do nothing. `mode: "draft"` without `onCommitDrafts` is fine:
`submitAll` falls back to the per-row `onCommit` loop.

The `editing` object may be written inline. Its callbacks are read through a ref
on every render, so its identity does not matter.

## The four modes

All four use the same engine and the same forms. `editing.mode` sets what
counts as a commit and which controls trigger it.

| Mode            | Commit                                | Cancel                                     | Controls                                |
| --------------- | ------------------------------------- | ------------------------------------------ | --------------------------------------- |
| `"cell"`        | Enter, Tab or blur                    | Escape                                     | none                                    |
| `"cellConfirm"` | ✓ or Enter only; blur keeps the draft | ✕ or Escape                                | ✓ / ✕ beside the input                  |
| `"row"`         | Save in the edit lane, or Ctrl+Enter  | Cancel, or Escape                          | generated edit lane                     |
| `"draft"`       | `edit.submitAll()`                    | `edit.cancelAll()`, or per row in the lane | `TMDataGridEditActions` + the edit lane |

```demo
file: editing/CellEditing.tsx
hint: Double-click a cell, or press Enter or F2, or start typing on it.
height: 440
```

**Opening an editor**: double-click, or, with the cell cursor on the cell,
Enter, F2, or typing, where the first character replaces the value as it would
in a spreadsheet. The grid places the caret in the cell that was opened, so a
`meta.edit.editor` receives focus without handling it itself. A row added with
`edit.addRow()` opens the same way, with the caret in its first editable cell.

Delete or Backspace clears the value and commits without opening an editor;
under `"draft"` the cleared value is held with the other drafts instead.
Editing implies cell selection: `cellSelection` defaults to `"single"` while
`editing` is set.

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

### Draft editing

Under `"draft"` nothing reaches a callback until Save all. Enter and Tab
**hold** the draft (Tab moving on to the next editable cell), Escape drops the
one draft, and drafts accumulate across rows, surviving filters, sorts and
scrolling. A held draft is displayed: the cell renders the draft value through
the column's own `cell` renderer, with the blue corner marking it dirty.

The edit lane shows each row's pending change and undoes it per row:

- an edited row - a pencil icon, and Revert, which drops the row's draft
- a new row - a plus icon, a pencil that reopens it, and ✕, which removes it
- a row marked for deletion - a trash icon, and Restore

A row with a dirty draft hides the trash: revert first, then delete. If
validation blocks a row, its icon turns red with the message in the tooltip.

`TMDataGrid.EditActions` in the toolbar provides the whole-grid controls: Save
with the pending count, and Discard. `renderActions` replaces the pair and
hands over its pieces: `state.pendingCount`, `state.isSubmitting`, the `save`
and `discard` actions, and `Controls.Save` / `Controls.Discard` as the
built-in buttons:

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
file: editing/DraftEditing.tsx
hint: Edit cells, enter new rows, mark deletions with the trash - the lane shows each row's pending change, and nothing leaves the grid until Save.
height: 440
```

`edit.submitAll()` commits every pending change, through the per-row
`onCommit` / `onRowAdd` / `onRowDelete` loop by default, or through one
`onCommitDrafts({ rows, added, deleted })` call when that is set. Rows failing
validation stay open either way, and a rejected save keeps every draft.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.edit.field` for a column built on `accessorFn`. Dot paths reach into
nested records: `accessorKey: "address.city"` edits `values.address.city`, and
issues from a nested schema map to the right column.

| Gate                                          | Effect                       |
| --------------------------------------------- | ---------------------------- |
| `meta.edit.enabled: false`                    | The column never edits       |
| `meta.edit.enabled: (row) => boolean`         | Per row, per column          |
| `editing.isRowEditable: (row) => boolean`     | The whole row, in every mode |

Group rows and the generated lanes never edit.

```demo
file: editing/EditableGating.tsx
hint: ID never edits · Salary is closed on Terminated rows · rows under 25 are closed entirely · Full name is computed but writes to Last name.
height: 440
```

## Draft lifetime

Forms live outside the DOM, keyed by row id. Scrolling an editing row away
unmounts the editor; the form keeps its values, dirty state and errors, and the
editor remounts over the same form when the row returns.

A cell whose row holds a draft renders the draft value through the column's
own `cell` renderer, in every mode - a `"cellConfirm"` draft kept on blur
displays what was typed, not the value in `data`. Cell corners show the state:
blue for a dirty draft, red for a validation error, and the row carries
`data-dirty`.

## Adding and deleting rows

`edit.addRow()` opens an **entry row** in a sticky block under the header, so a
row being typed into stays in view. Entry cells are ordinary editors over a form
seeded from `newRowDefaults`. Enter, or the lane's ✓, enters the row: the
immediate modes commit the add through `onRowAdd`, while draft mode holds it
with the other drafts and `submitAll` reports it in `added`. Escape, or ✕,
discards the entry.

Under `"draft"` an entered row renders as a value row above the body rows,
marked new (`data-new`, `data-confirmed`) and tinted with `--dg-row-new-bg`.
By default it scrolls with the body; set `newRowsSticky: true` to keep entered
rows pinned in the entry block until Save all. Double-click, or the lane's
pencil, reopens the row; ✕ removes it.

```tsx
useTMDataGrid({
  editing: {
    mode: "draft",
    newRowDefaults: () => ({ id: 0, name: "", hired: today() }),
    onCommitDrafts: async ({ rows, added, deleted }) => {
      await api.saveBatch({ rows, added, deleted });
    },
  },
});

<Button onClick={() => grid.edit.addRow()}>Add row</Button>;
```

To limit how many entry rows are open at once, read the entry state off
`edit.store` and gate the button:

```tsx
const hasOpenEntry = useSelector(grid.edit.store, (state) =>
  state.newRows.some((newRow) => !newRow.confirmed),
);

<Button disabled={hasOpenEntry} onClick={() => grid.edit.addRow()}>
  Add row
</Button>;
```

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` immediately under
the immediate modes; put any confirmation in that callback. Under draft mode it
toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane shows Restore, and `submitAll` reports the ids in
`deleted`. Setting `onRowDelete` puts the trash can in the edit lane.

The grid still never mutates `data`: you apply adds and deletes, and the new
rows arrive back through `data`. The engine's `tempId` (`__new__1`, …) does not
need to become a real id; assign one when you create the record.

## The engine: `edit`

The built-in controls do everything through `edit`, which is public.

| Member                                    | Does                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `edit.begin({ rowId, columnId })`         | Opens an editor. On an entered new row, reopens it                                                  |
| `edit.commit(rowId)`                      | Commits. Resolves `false` if blocked. Under `"draft"`, validates and holds the draft                |
| `edit.cancel(rowId)` / `edit.cancelAll()` | Drops drafts                                                                                        |
| `edit.submitAll()`                        | Commits every pending change - draft mode's Save all                                                |
| `edit.addRow()` / `edit.deleteRow(rowId)` | Adds or removes a row                                                                               |
| `edit.getForm(rowId)`                     | The row's live `FormApi`                                                                            |
| `edit.store`                              | Open rows, active cell, dirty and error projections, draft values, entry rows, deletion marks       |

`getForm` returns the row's own `FormApi`. Render it in a drawer or side panel
and it shares values, dirty state and errors with the inline cells.

For the inverse, a `@tanstack/react-form` form _around_ the grid holding the row
array, see [A query builder inside a form](/docs/query-builder).

## Reference

| Name                          | Kind           | Type                                             | Default           | What it does                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `editing`                     | Option         | `TMDataGridEditingOptions`                       | –                 | Turns editing on. One object holding the mode and every editing callback.                        |
| `editing.mode`                | Member         | `"cell" \| "cellConfirm" \| "row" \| "draft"`    | –                 | Picks what counts as a commit and which controls trigger it.                                     |
| `getRowId`                    | Table option   | `(row) => string`                                | –                 | Required once `editing` is set. Drafts are keyed by it.                                          |
| `editing.isRowEditable`       | Member         | `(row) => boolean`                               | –                 | Closes a whole row to editing.                                                                   |
| `editing.rowValidators`       | Member         | TanStack Form validators                         | –                 | Form-level rules for the whole editing row. See [Editors](/docs/editors).                        |
| `editing.onCommit`            | Callback       | `({ rowId, value, changes }) => void \| Promise` | –                 | Applies one row's change. Reject to keep the draft.                                              |
| `editing.onCommitDrafts`      | Callback       | `({ rows, added, deleted }) => void \| Promise`  | –                 | Draft mode only. One call for the whole save.                                                    |
| `editing.newRowsSticky`       | Member         | `boolean`                                        | `false`           | Draft mode only. Keeps entered new rows pinned in the entry block until Save all.                |
| `editing.newRowDefaults`      | Member         | `TData \| () => TData`                           | –                 | Seeds the entry row's form.                                                                      |
| `editing.onRowAdd`            | Callback       | `({ tempId, value }) => void \| Promise`         | –                 | Commits an added row.                                                                            |
| `editing.onRowDelete`         | Callback       | `({ rowId, row }) => void \| Promise`            | –                 | Deletes a row, and puts the trash in the edit lane.                                              |
| `meta.edit.enabled`           | Column meta    | `boolean \| (row) => boolean`                    | `true`            | Whether a column's cells edit.                                                                   |
| `meta.edit.field`             | Column meta    | `string`                                         | The `accessorKey` | The data path an edit writes to.                                                                 |
| `meta.edit.mapValue`          | Column meta    | `({ value, previous, row, column }) => unknown`  | –                 | Maps each value an editor writes. See [Editors](/docs/editors#mapping-the-value-as-it-is-typed). |
| `EDIT_COLUMN_ID`              | Export         | `"__edit__"`                                     | –                 | Id of the generated edit lane.                                                                   |
| `TMDataGrid.EditActions`      | Component      | –                                                | –                 | Save and Discard for pending edits.                                                              |
| `EditActions` `renderActions` | Slot           | `({ state, actions, Controls }) => ReactNode`    | Built-in pair     | Replaces the buttons, and hands over their pieces.                                               |
| `clearedValueForType`         | Export         | `(type) => unknown`                              | –                 | What Delete writes for each column type.                                                         |
| `--dg-entry-height`           | CSS variable   | length                                           | From `size`       | Height of the sticky entry block.                                                                |
| `--dg-row-new-bg`             | CSS variable   | color                                            | Green tint        | Background of an entered new row.                                                                |
| `data-deleted`                | Data attribute | –                                                | –                 | On a row marked for deletion under draft mode.                                                   |
| `data-dirty`                  | Data attribute | –                                                | –                 | On a body row holding a dirty draft.                                                             |
| `data-new` / `data-confirmed` | Data attribute | –                                                | –                 | On an entry row; `data-confirmed` once it is entered, awaiting Save all.                         |

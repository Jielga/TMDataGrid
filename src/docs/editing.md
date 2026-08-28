# Editing

`@tanstack/react-form` becomes a peer dependency once editing is used.

Editing is configured through one option, `editing`, and it has two axes.
`mode` decides what counts as a commit; `draft` decides where that commit goes.
The grid never mutates `data`, so you apply the commit and the new values
arrive back through `data`.

A row moves through three places, and the words for them are used exactly:

| Place | What it holds | In | Out |
| --- | --- | --- | --- |
| **data** | Your rows, the only source of truth | - | - |
| **form state** | A row being edited: its own TanStack Form, undecided | `edit.begin`, `edit.addRow` | `edit.cancel` |
| **draft store** | Rows whose form passed its submit, parked in the grid | `edit.commit` | `edit.saveDrafts` |

A row is **open** while it is form state, and **committed** once it is in the draft store.
The store only has dwell under `draft: true`; without it a commit goes straight to `onCommit` and the form is dropped, which is the same pipeline with the middle step lasting no time at all.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "cell",
    onCommit: async ({ rowId, value, changes }) => {
      // changes is a list of descriptors, not a patch object
      await api.patch(rowId, Object.fromEntries(changes.map((c) => [c.field, c.next])));
    },
  },
});
```

`onCommit` receives `{ rowId, value, original, changes, source }`.
`value` is the whole row as edited, `original` the row as editing began, and
`changes` the per-field diff: `Array<{ columnId, field, previous, next }>`, one
entry in cell mode.

`editing` requires `getRowId`: drafts are keyed by row id, and the index
fallback would name a different record after any sort. `onSaveDrafts` is
accepted only under `draft: true`. Both are compile errors rather than options
that silently do nothing. `draft: true` without `onSaveDrafts` is fine:
`saveDrafts` falls back to the per-row `onCommit` loop.

The `editing` object may be written inline. Its callbacks are read through a ref
on every render, so its identity does not matter.

## The three modes

All three use the same engine and the same forms. `editing.mode` sets what
counts as a commit and which controls trigger it.

| Mode            | Commit                                     | Cancel            | Controls                 |
| --------------- | ------------------------------------------ | ----------------- | ------------------------ |
| `"cell"`        | Enter, Tab or leaving the cell             | Escape            | none                     |
| `"cellConfirm"` | ✓ or Enter; Tab and leaving keep the draft | ✕ or Escape       | ✓ / ✕ beside the input   |
| `"row"`         | Save in the edit lane, or Enter            | Cancel, or Escape | generated edit lane      |

An entry row from `edit.addRow()` is row-shaped in every mode: every editable cell opens at once, Tab walks them, and the lane's ✓ is what enters it.

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
under `draft: true` the cleared value goes into the draft store with the rest. The
commit validates either way - a column rule that rejects the empty value
refuses the clear and marks the cell, rather than writing past the rule.
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

## The draft store

`draft: true` changes where a commit goes, and nothing else: instead of reaching `onCommit`, the row parks in the grid's draft store and waits for `edit.saveDrafts()`.
The mode still decides what counts as a commit, so the two combine freely - `{ mode: "row", draft: true }` parks a whole row from the lane's ✓, `{ mode: "cell", draft: true }` parks a row as the caret leaves it.

```tsx
editing: {
  mode: "row",
  draft: true,
  onSaveDrafts: async ({ updated, created, deleted }) => {
    await api.saveBatch({ updated, created, deleted });
  },
}
```

A committed row is displayed: the cell renders the draft value through the column's own `cell` renderer, with the blue corner marking it dirty.
Committed rows accumulate across filters, sorts and scrolling.

A row left open is not lost and not sent. It keeps everything typed into it,
stays open across a save, and joins the next save once it is committed. This
is what `edit.commitAll()` is for: it submits every open row at once, so
"commit everything, then save" is two calls, and the rows that fail validation
stay open with their errors instead of travelling half-checked.

A row that fails validation on the way out is the other way a row stays open.
Its message outlives the editor that found it: the cell keeps its invalid marker and the lane carries the text, until the value that failed is changed.

The rest of this page is what `draft: true` turns on.

### The lane

The edit lane holds two things at once, one per axis: the mode's own controls while a row is open, and the draft store's marker once it is parked.

- a parked edit - a pencil icon, and Revert, which drops the row's draft
- a parked new row - a plus icon, a pencil that reopens it, and ✕, which removes it
- a row marked for deletion - a trash icon, and Restore
- an open row - whatever the mode offers: Save and Cancel

A parked row has had its submit, so the lane never offers to save it again - `TMDataGrid.DraftActions` is what sends it.
A parked row also hides the trash: revert first, then delete.
If validation blocks a row, its icon turns red with the message in the tooltip: the parked row's marker, or the open row's ✓.
A pathless issue from `rowValidators` has no cell to land on, so that tooltip is where its message shows.

### Marking the drafts

Rows publish what they are holding, for styling and for tests:

| Attribute | On | Means |
| --- | --- | --- |
| `data-dirty` | Body row, cell | Values typed in, decided or not |
| `data-draft` | Body row, entry row | Committed into the draft store, waiting for Save |
| `data-deleted` | Body row | Marked for deletion |
| `data-new` | Entry row | An entered row, committed or not |

A row attribute is published on every body row, `"true"` or `"false"`, so match
the value - `[data-draft="true"]` - rather than the bare attribute, which
matches every row. A cell's `data-dirty` is present only while the cell is
dirty.

The grid paints none of them beyond the markers already described. To
highlight everything pending a save, and to let the user toggle it, use
`rowStyle` on the Table:

```tsx
<TMDataGrid.Table
  rowStyle={(row) =>
    showPending && grid.edit.state.committedRowIds.includes(row.id)
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-yellow-6) 15%, transparent)" }
      : undefined
  }
/>
```

`rowClassName` takes a class instead. For CSS alone, target the attribute:
`[data-dg-part="row"][data-draft="true"]`.

`TMDataGrid.DraftActions` in the toolbar provides the whole-grid controls: Save
with the draft-store count, Discard, and a note counting the rows still open.
Save sends the store and leaves open rows alone, so it greys out while nothing
is committed however much is being typed - the note is what keeps those rows
visible rather than silently left behind.
The toolbar is declarative: the grid does not add or remove this component for you, so include it when the grid runs a draft store - without `draft: true` there is nothing to save and Save stays disabled.

`renderActions` replaces the set and hands over its pieces: `state.draftCount`,
`state.openCount`, `state.openRowIds`, `state.isSubmitting`, the `save`,
`commitAll`, `discard`, `scrollToRow` and `scrollToFirstOpenRow` actions, and
`Controls.Save` / `Controls.Discard` / `Controls.OpenRowsNote` as the built-in
pieces.

Counting the open rows is only half the job on a long grid: the row that still
needs a decision may be nowhere near the viewport, and the grid is always
[virtualized](/docs/scrolling), so it may have no element to scroll to.
`actions.scrollToFirstOpenRow(align?)` goes to the topmost one and answers
whether it could be reached.

```tsx
<TMDataGrid.DraftActions
  renderActions={({ state, actions, Controls }) => (
    <Group>
      {state.draftCount > 0 && <Badge>{state.draftCount} ready</Badge>}
      <Button
        disabled={state.openCount === 0}
        onClick={() => {
          actions.scrollToFirstOpenRow("center");
        }}
      >
        Go to open row
      </Button>
      <Controls.OpenRowsNote />
      <Controls.Save />
      <Controls.Discard />
    </Group>
  )}
/>
```

`state.openRowIds` is the ids behind `openCount`, for a control the grid does
not offer - a list, or a next-open-row cycle. It is in the order the grid
opened the rows, while `scrollToFirstOpenRow` takes "first" in display order,
so the two need not name the same row. An entered row appears as its `tempId`;
those are always on screen in the entry block, so the scroll answers `true`
without moving.

```demo
file: editing/DraftEditing.tsx
hint: Double-click a row, ✓ parks it, "Go to open row" returns to one left undecided - nothing leaves the grid until Save.
height: 440
```

`edit.saveDrafts()` sends the draft store, through the per-row `onCommit` /
`onRowAdd` / `onRowDelete` loop by default, or through one
`onSaveDrafts({ updated, created, deleted })` call when that is set - the whole
store in one payload, for a server that applies it as a transaction.
`updated` entries are the shape `onCommit` receives -
`{ rowId, value, original, changes, source }`. `created` entries are
`{ tempId, value }`, and `deleted` is a list of row ids.

`changes` is a list of descriptors, not a patch object; spreading it into a row
compiles and writes nothing. To build a patch:

```tsx
const patch = Object.fromEntries(entry.changes.map((c) => [c.field, c.next]));
```

### Saving part of the store

`onSaveDrafts` decides how much of the store is cleared:

| Returned | Effect |
| --- | --- |
| nothing | Everything saved. The store is cleared. |
| a rejected promise, or a throw | Nothing saved. Every draft is kept. |
| `{ updated, created, deleted }` | The ids reported `false` are kept; the rest are cleared. |

Each key takes `false` for the whole bucket, or a map of id to result. An id
the map does not name saved.

```tsx
onSaveDrafts: async ({ updated, created, deleted }) => {
  const failed = await api.saveBatch({ updated, created, deleted });
  return { updated: Object.fromEntries(failed.map((id) => [id, false])) };
};
```

A kept row stays committed rather than reopening, so the next `saveDrafts()`
retries it with the values it already holds. `saveDrafts()` resolves `false`
when anything was kept.

Nothing about a kept row is styled by the grid. It carries the same markers
every draft carries - see [Marking the drafts](#marking-the-drafts).

`edit.submitAll()` is the old single verb and is **deprecated**: it now does
`commitAll()` followed by `saveDrafts()`, which is what it always did in
effect. Replace it with whichever half you meant.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.edit.field` for a column built on `accessorFn`. Dot paths reach into
nested records: `accessorKey: "address.city"` edits `values.address.city`, and
issues from a nested schema map to the right column.

| Gate | Effect |
| --- | --- |
| `editing.columns: string[]` | Only the named columns edit |
| `meta.edit.enabled: false` | The column never edits |
| `meta.edit.enabled: (row) => boolean` | Per row, per column |
| `editing.isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes never edit.

`editing.columns` lists the column ids that take edits.
Unset, the default, every column mapping to a data path is editable.

```tsx
editing: { mode: "cell", columns: ["targetPct", "note"] }
```

It gates before `meta.edit`, never past it: a column left out takes no edits whatever its own meta says, and a listed column still answers to its `meta.edit.enabled`.
The same list decides which cells an entry row opens.

`edit.isColumnEditable(column)` asks the column's half of the question on its own, for a toolbar or a menu with no row in hand: the column maps to a field, `editing.columns` lists it when that is set, and `meta.edit.enabled` is not `false`.
A per-row `enabled` predicate is the row's half, and `edit.canEditCell(row, column)` asks both.

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
own `cell` renderer, in every mode - a `"cellConfirm"` draft kept on the way
out displays what was typed, not the value in `data`. Cell corners show the
state: blue for a dirty draft, red for a validation error, and the row carries
`data-dirty`. A red corner outlives the editor that found the error: it stands
until that field's value changes.

The draft is displayed by the column that owns the field. A column computed
from other fields - `accessorFn` or `display` - reads `row.original`, which is
`data`, so it shows the saved record while the row is edited. To make a
computed cell follow the draft, read the drafted row from `edit.store`:

```tsx
function useDraftedRow(rowId: string, original: Product): Product {
  const { edit } = useTMDataGridContext();
  const values = useSelector(edit.store, (state) => state.rows[rowId]?.values);
  return (values as Product | undefined) ?? original;
}
```

`useTMDataGridContext()` reaches the engine from inside a cell renderer, and
the selector re-renders the cell as the draft changes.

## Adding and deleting rows

`edit.addRow()` opens an **entry row** in a sticky block under the header, so a
row being typed into stays in view. Entry cells are ordinary editors over a form
seeded from `newRowDefaults`.
Enter, or the lane's ✓, commits the row: `onRowAdd` receives it, or under `draft: true` it parks in the draft store and `saveDrafts` reports it in `created`.
Escape, or ✕, discards the entry.
Clicking away decides nothing - an entry row is row-shaped in every mode.
An entry row never OK'd is not part of a save; it stays open.

Under `draft: true` a committed row renders as a value row above the body rows,
marked new (`data-new`, `data-committed`) and tinted with `--dg-row-new-bg`.
By default it scrolls with the body; set `newRowsSticky: true` to keep
committed rows pinned in the entry block until the save. Double-click, or the
lane's pencil, reopens the row - which takes it back out of the draft store
until it is committed again; ✕ removes it.

```tsx
useTMDataGrid({
  editing: {
    mode: "row",
    draft: true,
    newRowDefaults: () => ({ id: 0, name: "", hired: today() }),
    onSaveDrafts: async ({ updated, created, deleted }) => {
      await api.saveBatch({ updated, created, deleted });
    },
  },
});

<Button onClick={() => grid.edit.addRow()}>Add row</Button>;
```

Annotate `newRowDefaults`' return type: a bare object literal widens a union
field to `string`, and `(): Product => ({ ... })` keeps it checked.

`addRow` takes the values the row starts from. They override `newRowDefaults`
key by key, so `addRow()` opens the `newRowDefaults` row and
`addRow({ department: "Sales" })` opens that row with `department` filled in.
Passing a whole row duplicates it. The entry row is an ordinary form either way:
the seeded values are editable, validate like any other, and nothing reaches
`onRowAdd` until the row is committed.

A grouped column has no cell on the entry row - under the default
`groupedColumnMode: "remove"` it is not in the grid at all - so an entry row
cannot type the grouped field. Seed it: `addRow({ region: "EMEA" })`.

```tsx
<Button onClick={() => grid.edit.addRow({ department: "Sales", active: true })}>
  Add to Sales
</Button>;

<Button onClick={() => grid.edit.addRow(selected.original)}>Duplicate</Button>;
```

To limit how many entry rows are open at once, read the entry state off
`edit.store` and gate the button:

```tsx
const hasOpenEntry = useSelector(grid.edit.store, (state) =>
  state.newRows.some((newRow) => !newRow.committed),
);

<Button disabled={hasOpenEntry} onClick={() => grid.edit.addRow()}>
  Add row
</Button>;
```

### Importing rows

`edit.addRows(rows)` opens a batch of entry rows in one write, where a loop
over `addRow` is one write per row. Each row is seeded over `newRowDefaults`
exactly as `addRow` is.

`{ commit: true }` submits each row as it lands, which is what an import
wants: rows that validate are committed, and rows that fail stay open in the
entry block carrying their errors, for the user to fix. The result says which
went which way, so the file's bad rows can be reported before anything is
saved.

```tsx
const { committed, open } = await grid.edit.addRows(parsedRows, {
  commit: true,
});
if (open.length > 0) notify(`${open.length} rows need attention`);
await grid.edit.saveDrafts();
```

Column rules are enforced here even though the rows never had an editor on
screen: the engine runs `meta.edit.validate` itself at commit, so an imported
row is held to the same rules as a typed one. Without `draft: true` there is
no store to park in, so `commit: true` adds each valid row through `onRowAdd`
- one call per row.

```demo
file: editing/ImportRows.tsx
hint: Import parses the pasted rows, commits the valid ones and leaves the rest open with their errors.
height: 460
```

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` immediately; put
any confirmation in that callback. Under `draft: true` it toggles a mark
instead: the row renders struck through and inert
(`data-deleted`), the lane shows Restore, and `saveDrafts` reports the ids in
`deleted`. A deletion mark is a decision the moment it is made, so it goes
straight into the draft store - there is nothing to type. The trash can shows
when the deletion has somewhere to report to: `onRowDelete` is set, or under
`draft: true`, `onSaveDrafts` is.

The grid still never mutates `data`: you apply adds and deletes, and the new
rows arrive back through `data`. The engine's `tempId` (`__new__1`, …) does not
need to become a real id; assign one when you create the record.

## The engine: `edit`

The built-in controls do everything through `edit`, which is public.

| Member | Does |
| --- | --- |
| `edit.begin({ rowId, columnId })` | Opens a row into form state. On a committed row, takes it back out of the draft store |
| `edit.commit(rowId)` | Submits one row: into the draft store under `draft: true`, to `onCommit` otherwise. Resolves `false` if validation blocked it |
| `edit.commitAll()` | Submits every open row. Resolves `false` when one stayed open |
| `edit.saveDrafts()` | Sends the draft store. Open rows are left alone |
| `edit.submitAll()` | **Deprecated** - `commitAll()` then `saveDrafts()` |
| `edit.cancel(rowId)` / `edit.cancelAll()` | Drops drafts - form state and the draft store alike |
| `edit.setCellValue(rowId, columnId, value)` | Writes one cell and commits the row, with no editor. Resolves `false` if the cell takes no edit, or validation refused the value |
| `edit.setRowValues(rowId, values)` | The same for several cells of one row, in one commit. All or nothing |
| `edit.clearCell(rowId, columnId)` | Writes the type's empty value and commits it - what Delete does |
| `edit.addRow(values?)` | Opens one entry row, seeded over `newRowDefaults` |
| `edit.addRows(rows, options?)` | Opens a batch; `{ commit: true }` submits each as it lands |
| `edit.deleteRow(rowId)` | Deletes a row, or marks it deleted under `draft: true` |
| `edit.isColumnEditable(column)` | Whether a column takes edits at all, with no row in hand |
| `edit.getForm(rowId)` | The row's live `FormApi` |
| `edit.store` | Open rows, committed rows, active cell, dirty and error projections, draft values, entry rows, deletion marks |

`commit`, `commitAll`, `saveDrafts`, `setCellValue`, `setRowValues`,
`clearCell` and `addRows` return promises. Await each call before starting the
next when driving edits in a loop.

`getForm` returns the row's own `FormApi`. Render it in a drawer or side panel
and it shares values, dirty state and errors with the inline cells.

For the inverse, a `@tanstack/react-form` form _around_ the grid holding the row
array, see [A query builder inside a form](/docs/query-builder).

### Bulk actions

`edit.setCellValue(rowId, columnId, value)` writes one cell and commits its row without an editor ever opening: a typed edit without the typing, for a toolbar action or a bulk fill.
The row need not be mounted, so a selected row inside a collapsed group takes the write like any other.

```tsx
for (const row of grid.table.getSelectedRowModel().rows) {
  await grid.edit.setCellValue(row.id, "targetPct", equalWeight(row.original));
}
```

Under `draft: true` each row parks in the draft store like any hand-made edit, so the whole basket saves at once through `edit.saveDrafts()`, carries the same change markers, and is reverted row by row from the edit lane.

`edit.setRowValues(rowId, values)` does the same for several cells of one row in a single commit: one `onCommit` call and one draft entry rather than one per column.
Keys are column ids, and it is all or nothing - if any named cell takes no edit, nothing is written and it resolves `false`.

```tsx
await grid.edit.setRowValues(row.id, { status: "Closed", closedOn: today() });
```

Both resolve `false` when the cell takes no edit - no such row or column, `editing.columns` excludes it, `meta.edit.enabled` is off, or the row is not editable - and when validation refuses the value, which leaves the row open carrying its errors.
`value` is the stored value: no editor runs, so `meta.edit.mapValue` does not run either, while `meta.edit.validate` does.

## Reference

| Name                          | Kind           | Type                                             | Default           | What it does                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `editing`                     | Option         | `TMDataGridEditingOptions`                       | –                 | Turns editing on. One object holding both axes and every editing callback.                       |
| `editing.mode`                | Member         | `"cell" \| "cellConfirm" \| "row"`               | –                 | Picks what counts as a commit and which controls trigger it.                                     |
| `editing.draft`               | Member         | `boolean`                                        | `false`           | Parks commits in the draft store for `edit.saveDrafts()` instead of sending them out.             |
| `getRowId`                    | Table option   | `(row) => string`                                | –                 | Required once `editing` is set. Drafts are keyed by it.                                          |
| `editing.columns`             | Member         | `ReadonlyArray<string>`                          | Every mapped column | The column ids that take edits. Gates before `meta.edit`, never past it.                       |
| `editing.isRowEditable`       | Member         | `(row) => boolean`                               | –                 | Closes a whole row to editing.                                                                   |
| `editing.rowValidators`       | Member         | TanStack Form validators                         | –                 | Form-level rules for the whole editing row. See [Editors](/docs/editors).                        |
| `editing.tableValidators`     | Member         | `TMDataGridTableValidators`                      | –                 | Cross-row rules, handed the collection with every draft overlaid. See [Editors](/docs/editors#cross-row-rules). |
| `editing.onCommit`            | Callback       | `({ rowId, value, original, changes, source }) => void \| Promise` | – | Applies one row's change. Reject to keep the draft.                                              |
| `editing.onSaveDrafts`        | Callback       | `({ updated, created, deleted }) => void \| Result \| Promise` | –  | `draft: true` only. One call for the whole draft store. See [Saving part of the store](#saving-part-of-the-store). |
| `editing.onCommitDrafts`      | Callback       | `({ updated, created, deleted }) => void \| Result \| Promise` | –  | **Deprecated** - renamed to `onSaveDrafts`. Still honoured.                                      |
| `editing.newRowsSticky`       | Member         | `boolean`                                        | `false`           | `draft: true` only. Keeps entered new rows pinned in the entry block until the save.             |
| `editing.newRowDefaults`      | Member         | `TData \| () => TData`                           | –                 | Seeds the entry row's form.                                                                      |
| `editing.onRowAdd`            | Callback       | `({ tempId, value }) => void \| Promise`         | –                 | Commits an added row.                                                                            |
| `editing.onRowDelete`         | Callback       | `({ rowId, row }) => void \| Promise`            | –                 | Deletes a row. Shows the trash; under `draft: true`, `onSaveDrafts` shows it too.                |
| `meta.edit.enabled`           | Column meta    | `boolean \| (row) => boolean`                    | `true`            | Whether a column's cells edit.                                                                   |
| `meta.edit.field`             | Column meta    | `string`                                         | The `accessorKey` | The data path an edit writes to.                                                                 |
| `meta.edit.mapValue`          | Column meta    | `({ value, previous, row, column }) => unknown`  | –                 | Maps each value an editor writes. See [Editors](/docs/editors#mapping-the-value-as-it-is-typed). |
| `EDIT_COLUMN_ID`              | Export         | `"__edit__"`                                     | –                 | Id of the generated edit lane.                                                                   |
| `TMDataGrid.DraftActions`      | Component      | –                                                | –                 | Save and Discard for pending edits.                                                              |
| `DraftActions` `renderActions` | Slot           | `({ state, actions, Controls }) => ReactNode`    | Built-in pair     | Replaces the buttons, and hands over their pieces. See [Components](/docs/components#tmdatagriddraftactions). |
| `actions.scrollToFirstOpenRow` | Slot action    | `(align?) => boolean`                            | `align: "auto"`   | Scrolls to the first open row in display order. `false` when none could be reached.              |
| `clearedValueForType`         | Export         | `(type) => unknown`                              | –                 | What Delete writes for each column type.                                                         |
| `--dg-entry-height`           | CSS variable   | length                                           | From `size`       | Height of the sticky entry block.                                                                |
| `--dg-row-new-bg`             | CSS variable   | color                                            | Green tint        | Background of an entered new row.                                                                |
| `data-deleted`                | Data attribute | –                                                | –                 | On a row marked for deletion under `draft: true`.                                                |
| `data-dirty`                  | Data attribute | –                                                | –                 | On a body row holding a dirty draft.                                                             |
| `data-new` / `data-committed` | Data attribute | –                                                | –                 | On an entry row; `data-committed` once it is committed, awaiting the save.                       |

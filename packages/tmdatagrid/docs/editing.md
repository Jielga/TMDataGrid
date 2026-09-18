# Editing

`@tanstack/react-form` becomes a peer dependency once editing is used.

Editing is turned on with the `editing` option.
Two settings inside it work independently:

- `mode` - what counts as a commit: leaving the cell, confirming the cell, or saving the row
- `draft` - where a commit goes: to your `onCommit` callback at once, or into the grid's draft store until the user presses Save

The grid never modifies `data`.
You apply each commit in your callback, and the new values arrive back through `data`.

A row is in one of three places:

| Place | What it holds | Enters by | Leaves by |
| --- | --- | --- | --- |
| **data** | Your rows, the only source of truth | - | - |
| **form state** | A row being edited, in its own TanStack Form | `edit.begin`, `edit.addRow` | `edit.commit`, `edit.cancel` |
| **draft store** | Rows that passed their commit, held as values inside the grid until Save | `edit.commit` under `draft: true` | `edit.saveDrafts`, `edit.cancel` |

A row is **open** while it is in form state, and **committed** once it is in the draft store.
Without `draft: true` a commit goes straight to `onCommit` and the form is dropped, so the draft store stays empty.

## Set up editing

The smallest setup is cell mode with an `onCommit` that applies each change:

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

`onCommit` receives `{ rowId, value, original, changes, source }`:

- `value` - the whole row as edited
- `original` - the row as editing began
- `changes` - the per-field diff, `Array<{ columnId, field, previous, next }>`, one entry in cell mode
- `source` - the `mode` the commit came from

`editing` requires `getRowId`: drafts are keyed by row id, and the index fallback would name a different record after a sort.
`onSaveDrafts` is accepted only under `draft: true`.
Both are compile errors, not options that silently do nothing.

The `editing` object can be written inline.
Its callbacks are read through a ref on every render, so its identity does not matter.

Editing turns on cell selection: `cellSelection` defaults to `"single"` while `editing` is set.

## Modes

`editing.mode` sets what counts as a commit and which controls trigger it.
All three modes use the same engine and the same forms.

| Mode            | Commit                                     | Cancel            | Controls                 |
| --------------- | ------------------------------------------ | ----------------- | ------------------------ |
| `"cell"`        | Enter, Tab or leaving the cell             | Escape            | none                     |
| `"cellConfirm"` | ✓ or Enter; Tab walks input, ✓, ✕ and then leaves, keeping the draft | ✕ or Escape       | ✓ / ✕ beside the input   |
| `"row"`         | ✓ in the edit lane, or Enter               | ✕, or Escape      | generated edit lane      |

An entry row from `edit.addRow()` is row-shaped in every mode: every editable cell opens at once, Tab walks them, and Enter, or the lane's ✓, commits it.

```demo
file: editing/CellEditing.tsx
hint: Double-click a cell, or press Enter or F2, or start typing on it.
height: 440
```

### Opening an editor

An editor opens on double-click, or, with the cell cursor on the cell, on Enter, F2 or typing, where the first character replaces the value as in a spreadsheet.
The grid places the caret in the opened cell, so a `meta.edit.editor` receives focus without handling it itself.
A row added with `edit.addRow()` opens the same way, with the caret in its first editable cell.

Delete or Backspace clears the value and commits it without opening an editor.
The commit is validated: a column rule that rejects the empty value refuses the clear and marks the cell.
Under `draft: true` the cleared value goes into the draft store with the rest.

A commit that fails validation keeps the editor open and marked invalid, with the message in its tooltip, until the value is fixed or Escape drops the edit.

### Row editing

The pencil in the edit lane opens every cell of the row at once, and ✓ commits them as one commit.
Double-clicking a cell opens the whole row, with the caret in the clicked cell.
Cross-field rules belong in this mode, because the whole row is validated together.
Opening a second row leaves the first one open, and each row's ✓ and ✕ act on that row alone.

```demo
file: editing/RowEditing.tsx
hint: Put a Sales row over 60 000 kr and Save reports why it is rejected.
height: 440
```

## The draft store

`draft: true` changes where a commit goes, and nothing else.
Instead of reaching `onCommit`, the row is committed into the grid's draft store, where it waits for `edit.saveDrafts()`.
The mode still decides what counts as a commit: `{ mode: "row", draft: true }` commits a whole row from the lane's ✓, and `{ mode: "cell", draft: true }` commits a row as the caret leaves the cell.

`draft: true` requires `getRowId`.
The usual setup adds `onSaveDrafts`, which receives the whole store in one call when the user presses Save, and `TMDataGrid.DraftActions` in the toolbar, which renders Save and Discard:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "row",
    draft: true,
    onSaveDrafts: async ({ updated, created, deleted }) => {
      await api.saveBatch({ updated, created, deleted });
    },
  },
});

<TMDataGrid {...grid}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.DraftActions />
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
</TMDataGrid>;
```

In this demo:

- ✓ commits the row into the draft store, and the Backend panel logs nothing
- Save sends the whole store as one `onSaveDrafts` call
- with "Reject Sales rows" on, the backend refuses those rows and they keep their drafts
- "Go to open row" scrolls to a row left open

```demo
file: editing/DraftEditing.tsx
hint: Double-click a row, ✓ commits it, Save sends the store.
height: 440
```

### Saving the store

`edit.saveDrafts()` sends the draft store and leaves open rows alone.
With `onSaveDrafts` set, it makes one call with the whole store, `onSaveDrafts({ updated, created, deleted })`:

- `updated` - one entry per committed edit, in the shape `onCommit` receives: `{ rowId, value, original, changes, source }`
- `created` - one `{ tempId, value }` per committed new row
- `deleted` - the ids of the rows marked for deletion

Without `onSaveDrafts`, `saveDrafts` makes one call per row instead: `onCommit` for each edit, `onRowAdd` for each new row and `onRowDelete` for each deletion.
`draft: true` without `onSaveDrafts` is therefore valid.

`changes` is a list of descriptors, not a patch object; spreading it into a row compiles and writes nothing.
To build a patch:

```tsx
const patch = Object.fromEntries(entry.changes.map((c) => [c.field, c.next]));
```

Before the rows are sent, `editing.tableValidators` run once more over every committed row.
Column rules and `rowValidators` ran at commit on the same values, so they do not run again.
A row the table rules reject is reopened with its errors and left out of the save.
On the per-row path, a row whose `onCommit` or `onRowAdd` rejects is reopened the same way.

`TMDataGrid.DraftActions` renders the whole-grid controls: Save with the count of rows in the store, Discard, and a note counting the rows still open.
Save is disabled while the store is empty, however much is being typed, and shows a loading state while the save is in flight.
The toolbar is declarative: include the component yourself when the grid runs a draft store, or call `edit.saveDrafts()` from a control of your own.
Without `draft: true` there is nothing to save and Save stays disabled.

### Saving part of the store

`onSaveDrafts` decides how much of the store is cleared by what it returns:

| Returned | Effect |
| --- | --- |
| nothing | Everything saved. The store is cleared. |
| a rejected promise, or a throw | Nothing saved. Every draft is kept. |
| `{ updated, created, deleted }` | The ids reported `false` are kept; the rest are cleared. |

Each key takes `false` for the whole bucket, or a map from id to result.
An id the map does not name counts as saved.

```tsx
onSaveDrafts: async ({ updated, created, deleted }) => {
  const failed = await api.saveBatch({ updated, created, deleted });
  return { updated: Object.fromEntries(failed.map((id) => [id, false])) };
};
```

A kept row stays committed rather than reopening, so the next `saveDrafts()` retries it with the values it already holds.
`saveDrafts()` resolves `false` when anything was kept.
A kept row carries the same markers as every other draft and nothing more; see [Styling pending rows](#styling-pending-rows).

### Rows left open

A row left open is neither lost nor sent.
It keeps everything typed into it, stays open across a save, and joins the next save once it is committed.
`edit.commitAll()` submits every open row at once; rows that fail validation stay open with their errors.
"Commit everything, then save" is `commitAll()` followed by `saveDrafts()`.
`edit.submitAll()` did both in one call and is **deprecated**; replace it with the half you meant.

The note beside Save counts the open rows.
On a long grid the open row may be far from the viewport, and because the grid is [virtualized](/docs/scrolling) it may have no element to scroll to.
`actions.scrollToFirstOpenRow(align?)` scrolls to the first open row in display order and returns whether it could be reached.

`renderActions` replaces the built-in pair and receives its pieces:

- `state` - `draftCount`, `openCount`, `openRowIds`, `isSubmitting` and `isSaving`
- `actions` - `save`, `commitAll`, `discard`, `scrollToRow` and `scrollToFirstOpenRow`
- `Controls` - `Save`, `Discard` and `OpenRowsNote`, the built-in pieces

The full list is on [Components](/docs/components#tmdatagriddraftactions).

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

`state.openRowIds` lists the open rows in the order the grid opened them, for a control the grid does not offer, such as a list or a next-open-row cycle.
`scrollToFirstOpenRow` takes "first" in display order, so the two need not name the same row.
An entered row appears as its `tempId`; entry rows are always on screen in the entry block, so the scroll returns `true` without moving.

### How a committed row behaves

A committed row holds no form: its values are data in the draft store.
To the table it is a row like any other, and everything that reads a row reads the draft:

- sorting, filtering, quick search and grouping
- `aggregatedCell`, `footer` and the faceted filter options
- export, row selection, the row numbers and counts
- `edit.getRows()` and `editing.tableValidators`
- the row callbacks `onRowClick`, `renderRowContextMenu`, `renderDetails`, `isRowEditable`, `meta.edit.enabled`, `rowClassName`, `rowStyle` and `enableRowPinning`, which receive a row whose `original` is the committed draft; an entered row is a record under its temp id, with no server id

`data` itself is never modified, and `getRowCount()` with a `rowCount` you set does not grow.
Only top-level rows are overlaid; children reached through `getSubRows` keep their `data` values.
A committed row that stops matching a filter or the quick search leaves the view, and Save still counts it.

Reopening a committed row, through `begin` or a write with `setCellValue`, `setRowValues` or `clearCell`, builds a fresh form seeded from the committed values and takes the row out of the store until it commits again.
The row keeps its place in the sort until it commits again or is cancelled.

A commit moves nothing else: the page stays, and open details panels and groups stay open.
TanStack's `autoResetPageIndex` and `autoResetExpanded` fire on any change to the `data` array, which under `draft: true` is every commit, so the grid switches both off and resets the page on a query change itself; see `resetPageOnQueryChange`.

A refetch that no longer returns a row drops that row's draft, its open editor and its deletion mark.
Under `manualPagination` or `manualFiltering` a row missing from `data` is on another page, not gone, so its draft is kept until Save.

## Edit lane

The edit lane is the generated column at the end of every row, with the id `EDIT_COLUMN_ID`.
The grid adds it under `mode: "row"`, under `draft: true`, or when `onRowDelete` is set.
What it shows depends on the row's state:

| Row state | Icon | Actions |
| --- | --- | --- |
| Open | - | The mode's controls: ✓ ("Save row") commits the row, ✕ ("Cancel edit") cancels the edit |
| Committed edit | Pencil | Revert drops the row's draft |
| Committed new row | Plus | Pencil reopens it, ✕ removes it |
| Marked for deletion | Trash | Restore removes the mark |

A committed row is never offered ✓ again; `TMDataGrid.DraftActions` sends it.
A committed row also hides the trash: revert first, then delete.
The trash shows when a deletion has somewhere to go: `onRowDelete` is set, or under `draft: true`, `onSaveDrafts` is.

If validation blocks a row, its icon turns red and the tooltip shows the message; this covers the open row's ✓ and an entry row's ✓ alike.
A pathless issue from `rowValidators` has no cell to land on, so that tooltip is where its message shows.

## Adding rows

`edit.addRow()` opens an **entry row** in a sticky block under the header, so the row being typed into stays in view.
Its cells are ordinary editors over a form seeded from `newRowDefaults`.

- Enter, or the lane's ✓, commits the row: `onRowAdd` receives it, or under `draft: true` it goes into the draft store and `saveDrafts` reports it in `created`
- Escape, or ✕, discards it
- clicking away decides nothing; an entry row is row-shaped in every mode
- an entry row that was never committed is not part of a save and stays open

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

Annotate the return type of `newRowDefaults`: a bare object literal widens a union field to `string`, and `(): Product => ({ ... })` keeps it checked.

`addRow(values)` overrides `newRowDefaults` key by key: `addRow()` opens the defaults, `addRow({ department: "Sales" })` opens them with `department` filled in, and passing a whole row duplicates it.
The seeded values are editable and validate like any other, and nothing reaches `onRowAdd` until the row is committed.

A grouped column has no cell on the entry row; under the default `groupedColumnMode: "remove"` it is not in the grid at all.
Seed it instead: `addRow({ region: "EMEA" })`.

```tsx
<Button onClick={() => grid.edit.addRow({ department: "Sales", active: true })}>
  Add to Sales
</Button>;

<Button onClick={() => grid.edit.addRow(selected.original)}>Duplicate</Button>;
```

To limit how many entry rows are open at once, read the entry state from `edit.store` and gate the button:

```tsx
const hasOpenEntry = useSelector(grid.edit.store, (state) =>
  state.newRows.some((newRow) => !newRow.committed),
);

<Button disabled={hasOpenEntry} onClick={() => grid.edit.addRow()}>
  Add row
</Button>;
```

### Committed new rows

Under `draft: true` a committed entry row leaves the entry block and becomes a body row: it carries `data-new` and `data-draft`, is tinted with `--dg-row-new-bg`, and is sorted, filtered and counted with the rest on the values it was entered with.
Set `newRowsSticky: true` to keep committed rows in the entry block until the save instead, out of the body's sort and out of the row count.
Double-click, or the lane's pencil, reopens the row into the entry block, which takes it out of the draft store until it is committed again; ✕ removes it.

### Importing rows

`edit.addRows(rows)` opens a batch of entry rows in one write, where a loop over `addRow` is one write per row.
Each row is seeded over `newRowDefaults` like `addRow`.
`{ commit: true }` submits the rows too: rows that validate are committed, and rows that fail stay open in the entry block with their errors.
The result says which went which way, so the bad rows can be reported before anything is saved:

```tsx
const { committed, open } = await grid.edit.addRows(parsedRows, {
  commit: true,
});
if (open.length > 0) notify(`${open.length} rows need attention`);
await grid.edit.saveDrafts();
```

Column rules apply even though the rows never had an editor on screen: the engine runs `meta.edit.validate` at commit.
Under `draft: true` the whole import is one publish: the rows are validated together and land in the draft store in the same render that shows them, so ten thousand rows take about a second.
`saveDrafts` sends them the same way.
Without `draft: true`, `commit: true` adds each valid row through `onRowAdd`, one call per row, in the order given.

```demo
file: editing/ImportRows.tsx
hint: Import parses the pasted rows, commits the valid ones and leaves the rest open with their errors. The second button imports ten thousand generated rows, twenty of them invalid.
height: 460
```

## Deleting rows

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` at once; put any confirmation in that callback.
Under `draft: true` it marks the row instead: the row renders struck through and inert with `data-deleted`, the lane shows Restore, and `saveDrafts` reports the id in `deleted`.
The mark goes straight into the draft store; there is nothing to type.
`edit.restoreRow(rowId)` removes the mark, which is what the lane's Restore calls.

`deleteRow` is idempotent: deleting a marked row leaves it marked.
On an entry row, committed or not, it discards the entry, and an unknown id is a no-op.
`edit.deleteRows(rowIds)` does the same over a list in one call, so a selection can be passed as it stands: duplicates, marked rows and stale ids included.

A marked row is read-only and not selectable until it is restored:

- `begin`, `setCellValue`, `setRowValues` and `clearCell` refuse it, and the keyboard cannot open an editor on it
- an editor open on the row when it is marked is cancelled
- its checkbox is disabled, select-all skips it, and the mark drops it from `rowSelection`
- it still sorts, filters, groups, aggregates and counts, and is left out of an export
- a committed edit stays under the mark: Restore brings the row back as edited, while Save leaves the edit out of `updated`, reports the row in `deleted` only, and forgets the edit once the deletion is saved

A row the engine takes out of the table, an entry row that is discarded or saved or a marked row once its deletion is saved, leaves `rowSelection`, `expanded` and `rowPinning` with it, so a saved deletion does not leave the select-all box indeterminate.

The grid never modifies `data`: you apply adds and deletes, and the new rows arrive back through `data`.
The engine's `tempId` (`__new__1`, …) does not need to become a real id; assign one when you create the record.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or `meta.edit.field` for a column built on `accessorFn`.
Dot paths reach into nested records: `accessorKey: "address.city"` edits `values.address.city`, and issues from a nested schema map to the right column.

| Gate | Effect |
| --- | --- |
| `editing.columns: string[]` | Only the named columns edit |
| `meta.edit.enabled: false` | The column never edits |
| `meta.edit.enabled: (row) => boolean` | Per row, per column |
| `editing.isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes never edit.

`editing.columns` lists the column ids that take edits.
By default, every column that maps to a data path is editable.

```tsx
editing: { mode: "cell", columns: ["targetPct", "note"] }
```

It gates before `meta.edit`, never past it: a column left out takes no edits whatever its own meta says, and a listed column still answers to its `meta.edit.enabled`.
The same list decides which cells an entry row opens.

`edit.isColumnEditable(column)` answers the column's half of the question on its own, for a toolbar or a menu with no row in hand: the column maps to a field, `editing.columns` lists it when that is set, and `meta.edit.enabled` is not `false`.
A per-row `enabled` predicate is the row's half, and `edit.canEditCell(row, column)` asks both.

```demo
file: editing/EditableGating.tsx
hint: ID never edits · Salary is closed on Terminated rows · rows under 25 are closed entirely · Full name is computed but writes to Last name.
height: 440
```

## How a draft renders

Forms live outside the DOM, keyed by row id.
Scrolling an editing row away unmounts its editor; the form keeps its values, dirty state and errors, and the editor remounts over the same form when the row returns.

A cell whose row holds a draft renders the draft value through the column's own `cell` renderer, in every mode; a `"cellConfirm"` draft kept when the caret left shows what was typed, not the value in `data`.
Cell corners show the state: blue for a dirty draft, red for a validation error, and the row carries `data-dirty`.
An entry row's cells take the red corner, never the blue one.

A validation message outlives the editor that found it: the cell keeps its red corner and the lane carries the text until that field's value changes.
While an editor is open, the field's message shows in a tooltip on it, opened by focus and by hover.

The draft is displayed by the column that owns the field.
A column computed from other fields, with `accessorFn` or `display`, reads `row.original`, which is `data`, so it shows the saved record while the row is edited.
To make a computed cell follow the draft, read the drafted row from `edit.store`:

```tsx
function useDraftedRow(rowId: string, original: Product): Product {
  const { edit } = useTMDataGridContext();
  const values = useSelector(edit.store, (state) => state.rows[rowId]?.values);
  return (values as Product | undefined) ?? original;
}
```

`useTMDataGridContext()` reaches the engine from inside a cell renderer, and the selector re-renders the cell as the draft changes.

## Styling pending rows

Rows publish what they hold, for styling and for tests:

| Attribute | On | Means |
| --- | --- | --- |
| `data-dirty` | Body row, cell | Values typed in, committed or not |
| `data-draft` | Body row, entry row | Committed into the draft store, waiting for Save |
| `data-deleted` | Body row | Marked for deletion |
| `data-new` | Body row, entry row | An entered row, committed (body) or not (entry block) |

A row attribute is published on every body row as `"true"` or `"false"`, so match the value, `[data-draft="true"]`, rather than the bare attribute, which matches every row.
A cell's `data-dirty` is present only while the cell is dirty.

The grid styles none of them beyond the corners, the strike-through and the new-row tint.
To highlight every row pending a save, and to let the user toggle it, use `rowStyle` on the Table:

```tsx
<TMDataGrid.Table
  rowStyle={(row) =>
    showPending && grid.edit.state.committedRowIds.includes(row.id)
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-yellow-6) 15%, transparent)" }
      : undefined
  }
/>
```

`rowClassName` takes a class instead.
For CSS alone, target the attribute: `[data-dg-part="row"][data-draft="true"]`.

## The edit API

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
| `edit.addRows(rows, options?)` | Opens a batch; `{ commit: true }` submits the rows too - one publish for the lot under `draft: true` |
| `edit.deleteRow(rowId)` | Deletes a row, or marks it deleted under `draft: true`. Idempotent; discards an entry row; ignores an unknown id |
| `edit.deleteRows(rowIds)` | `deleteRow` over a list in one call - safe to feed a selection as it stands |
| `edit.restoreRow(rowId)` | Removes a row's deletion mark - what the lane's Restore calls |
| `edit.isColumnEditable(column)` | Whether a column takes edits at all, with no row in hand |
| `edit.getForm(rowId)` | The open row's live `FormApi`; `undefined` for a committed row |
| `edit.getRowValues(rowId)` | The row as shown: its draft where one is held, else the `data` value. `undefined` for an unknown row |
| `edit.getRows()` | Every row as shown - drafts overlaid, entry rows appended, deletion-marked rows included and flagged `deleted` |
| `edit.store` | Open rows, committed rows, active cell, dirty and error projections, draft values, the committed values the table shows (`committedValues`), entry rows, deletion marks, and `isSaving` |

`commit`, `commitAll`, `saveDrafts`, `setCellValue`, `setRowValues`, `clearCell` and `addRows` return promises.
Await each call before starting the next when driving edits in a loop.

`getForm` returns the open row's own `FormApi`.
Render it in a drawer or side panel and it shares values, dirty state and errors with the inline cells.
A committed row has no form, so `getForm` returns `undefined` for it; call `begin` first, which reopens the row with a form seeded from the committed values.

`getRowValues` and `getRows` read what the grid shows rather than what `data` holds: an open form's values, a committed draft, or the `data` value when neither exists.
`getRows` walks the core row model, so it is unfiltered and never contains group rows, and it filters nothing out: a row marked deleted comes back flagged `deleted`, an entry row flagged `isNew` under its temp id.
The order is the core row model's, committed new rows ahead of the `data` rows, and then the entry rows the table does not hold: the ones still being typed into, and the committed ones under `newRowsSticky`.

```tsx
const selected = grid.table
  .getSelectedRowModel()
  .rows.flatMap((row) => grid.edit.getRowValues(row.id) ?? []);

const surviving = grid.edit.getRows().filter((row) => !row.deleted);
```

For the inverse, a `@tanstack/react-form` form _around_ the grid holding the row array, see [A query builder form](/docs/query-builder).

### Bulk actions

`edit.setCellValue(rowId, columnId, value)` writes one cell and commits its row without an editor ever opening, for a toolbar action or a bulk fill.
The row need not be mounted, so a selected row inside a collapsed group takes the write like any other.

```tsx
for (const row of grid.table.getSelectedRowModel().rows) {
  await grid.edit.setCellValue(row.id, "targetPct", equalWeight(row.original));
}
```

Under `draft: true` each row is committed into the draft store like a typed edit: the whole batch saves at once through `edit.saveDrafts()`, carries the same markers, and is reverted row by row from the edit lane.

`edit.setRowValues(rowId, values)` does the same for several cells of one row in a single commit: one `onCommit` call and one draft entry rather than one per column.
Keys are column ids, and it is all or nothing: if any named cell takes no edit, nothing is written and it resolves `false`.

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
| `editing.draft`               | Member         | `boolean`                                        | `false`           | Holds commits in the draft store for `edit.saveDrafts()` instead of sending them out.             |
| `getRowId`                    | Table option   | `(row) => string`                                | –                 | Required once `editing` is set. Drafts are keyed by it.                                          |
| `editing.columns`             | Member         | `ReadonlyArray<string>`                          | Every mapped column | The column ids that take edits. Gates before `meta.edit`, never past it.                       |
| `editing.isRowEditable`       | Member         | `(row) => boolean`                               | –                 | Closes a whole row to editing.                                                                   |
| `editing.rowValidators`       | Member         | TanStack Form validators                         | –                 | Form-level rules for the whole editing row. See [Editors](/docs/editors).                        |
| `editing.tableValidators`     | Member         | `TMDataGridTableValidators`                      | –                 | Cross-row rules, handed the collection with every draft overlaid. See [Editors](/docs/editors#cross-row-rules). |
| `editing.onCommit`            | Callback       | `({ rowId, value, original, changes, source }) => void \| Promise` | – | Applies one row's change. Reject to keep the draft.                                              |
| `editing.onSaveDrafts`        | Callback       | `({ updated, created, deleted }) => void \| Result \| Promise` | –  | `draft: true` only. One call for the whole draft store. See [Saving part of the store](#saving-part-of-the-store). |
| `editing.onCommitDrafts`      | Callback       | `({ updated, created, deleted }) => void \| Result \| Promise` | –  | **Deprecated** - renamed to `onSaveDrafts`. Still honoured.                                      |
| `editing.newRowsSticky`       | Member         | `boolean`                                        | `false`           | `draft: true` only. Keeps committed entry rows in the sticky entry block, out of the body's sort, until the save. |
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
| `--dg-row-new-bg`             | CSS variable   | color                                            | Green tint        | Background of a committed new row, in the body or the entry block.                               |
| `data-deleted`                | Data attribute | –                                                | –                 | On a row marked for deletion under `draft: true`.                                                |
| `data-dirty`                  | Data attribute | –                                                | –                 | On a body row holding a dirty draft.                                                             |
| `data-draft`                  | Data attribute | –                                                | –                 | On a body row or entry row committed into the draft store, waiting for a save.                   |
| `data-new`                    | Data attribute | –                                                | –                 | On a body row that is a committed new row, and on an entry row.                                  |
| `data-committed`              | Data attribute | –                                                | –                 | On an entry row once it is committed, awaiting the save. Seen only under `newRowsSticky`.        |

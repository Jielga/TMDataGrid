---
name: editing
description: >
  Edit cells and rows in TMDataGrid. Covers editMode with its four policies
  (cell, cellConfirm, row, batch), the required getRowId, onEditCommit and
  onEditCommitBatch, why the grid never mutates data, per-column gating with
  meta.editable and meta.editField, the six built-in editors picked by
  meta.type, custom editors through meta.editor, field validation with
  meta.validate and cross-field rules with rowValidators (Standard Schema and
  Zod), adding and deleting rows with edit.addRow, newRowDefaults, onRowAdd,
  onRowDelete, the generated edit lane, TMDataGrid.EditActions with its
  renderActions slot, and the public edit engine (begin, commit, cancel,
  submitAll, getForm, store). Load when making a grid editable, choosing an edit
  mode, wiring a save, writing a cell editor, validating an edit, or when cells
  will not open for editing.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.1.0'
sources:
  - 'Jielga/TMDataGrid:src/docs/editing.md'
  - 'Jielga/TMDataGrid:src/docs/query-builder.md'
  - 'Jielga/TMDataGrid:src/docs/editors.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/editEngine.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/useTMDataGrid.tsx'
---

# TMDataGrid - Editing

`editMode` turns editing on and picks how commits happen. Three facts decide
every wiring question below:

- **The grid never mutates `data`.** `onEditCommit` applies the change wherever
  the data actually lives, and the new rows arrive back through `data`.
- **One row, one form.** Each editing row gets its own TanStack Form, keyed by
  row id and living outside the DOM, so a draft survives scrolling, sorting and
  filtering.
- **`getRowId` is required** once `editMode` is set, and it must be the record's
  own identity. Drafts are keyed by it.

`@tanstack/react-form` becomes a peer dependency once editing is used.

## Setup

```tsx
const [employees, setEmployees] = useState(initial);

const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editMode: "cell",
  // The grid writes nothing: apply the change, and the edited row arrives
  // back through `data`.
  onEditCommit: ({ rowId, value }) =>
    setEmployees((previous) =>
      previous.map((employee) =>
        String(employee.id) === rowId ? value : employee,
      ),
    ),
});

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
  <TMDataGrid.Table<Employee> />
</TMDataGrid>;
```

The editing options travel together, and the types say so: passing any of them
without `editMode` is a compile error, `getRowId` stops being optional the
moment `editMode` is set, and `onEditCommitBatch` exists only under
`editMode: "batch"`.

## The four modes

One axis, four policies over the same engine.

| Mode | Commits on | Cancels on | Chrome |
| --- | --- | --- | --- |
| `"cell"` | Enter, Tab, blur | Escape | none |
| `"cellConfirm"` | ✓ or Enter; blur keeps the draft | ✕ or Escape | ✓ / ✕ beside the input |
| `"row"` | Save in the edit lane, or Ctrl+Enter | Cancel, or Escape | generated edit lane |
| `"batch"` | `edit.submitAll()` | `edit.cancelAll()` | `TMDataGrid.EditActions` |

Which to pick: `"cell"` for saved-as-you-go spreadsheet feel; `"cellConfirm"`
when a stray click must not fire a request; `"row"` when the row is the unit of
the save or a rule spans two columns; `"batch"` for many edits sent as one
transaction.

An editor opens on double-click, or with the cell cursor on the cell: Enter, F2,
or just typing, where the character replaces the value. Delete or Backspace
clears the value and commits without opening an editor. Editing brings cell
selection with it: `cellSelection` defaults to `"single"` while `editMode` is
set. Every open gesture puts the caret in the cell it named, and the grid places
it rather than the editor - a `meta.editor` needs no `autoFocus` wiring.

Under `"row"` the pencil - or a double-click on any cell, which puts the caret
in the cell clicked - opens every editable cell of the row, and ✓ saves them as
one commit. Rows accumulate: opening a second row leaves the first open, and
each row's ✓ and ✕ act on that row alone, so no row is closed or saved to make
space for the next.

Under `"batch"` nothing leaves the grid until `submitAll`. Enter and Tab park
the draft, dirty-marked, Escape drops that one draft, and drafts accumulate
across rows. `submitAll` then commits every open row: through the per-row
`onEditCommit` loop by default, or through one
`onEditCommitBatch({ rows, added, deleted })` call when that is set. Rows
failing validation stay open either way, and a rejected batch keeps every
draft.

## What a commit receives

`onEditCommit` is handed `{ rowId, value, original, changes, source }`: `value`
is the whole edited row for consumers who save records, `changes` the per-field
diff (`columnId`, `field`, `previous`, `next`) for consumers who PATCH, one
entry in cell mode.

The engine drops the draft only when `onEditCommit` resolves. A slow save keeps
the draft on screen with a busy marker; a **rejection keeps the form open** with
the error on the row, which is how a failed save stays visible.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.editField` for a column built on `accessorFn`. Dot paths reach into nested
records, so `accessorKey: "address.city"` edits `values.address.city`.

| Gate | Effect |
| --- | --- |
| `meta.editable: false` | The column never edits |
| `meta.editable: (row) => boolean` | Per row, per column |
| `meta.editField: "lastName"` | The path an `accessorFn` column writes to |
| `isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes (checkbox, row number, details, edit) never
edit.

```tsx
// Computed column writing back to a real field, and per-row gating.
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
  meta: { label: "Full name", editField: "lastName" },
});
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { editable: (row) => row.original.status !== "Terminated" },
});
```

## Editors and validation

`meta.type` picks the editor - `"string"` (the default), `"number"`,
`"boolean"`, `"date"`, `"select"` and `"multiSelect"` - and `meta.options` feeds
the two select editors from the same declaration the filter panel reads. Each
one, with the export that wraps it, is in
[references/editors-and-validation.md](references/editors-and-validation.md#the-built-in-editors).

`meta.editor` replaces one, `meta.validate` guards the field, and
`rowValidators` carries cross-field rules. The validators are TanStack Form's
own, Standard Schema included, so a Zod schema passes straight through:

```tsx
import { z } from "zod";

// Field level, on the column. A bare schema means { onChange: schema }.
meta: { validate: z.string().min(2, "At least two characters") }

// Form level, on the hook. Cross-field rules, under "row" or "batch".
rowValidators: {
  onSubmit: z
    .object({ salary: z.number().positive(), status: z.string() })
    .refine((row) => row.status !== "Terminated" || row.salary === 0, {
      message: "A terminated employee has no salary",
    }),
}
```

Pathed issues land on the matching cells, pathless ones on the row. Cell corners
mark state meanwhile: blue for a dirty draft, red for a validation error.

The editor contract, wrapping a built-in, and async server-side field errors:
[references/editors-and-validation.md](references/editors-and-validation.md).

## Adding and deleting rows

`edit.addRow()` opens an entry row in a sticky block under the header, seeded
from `newRowDefaults`. Enter, or the lane's ✓, commits the add through
`onRowAdd` under the immediate modes; batch parks it for `submitAll`. Escape, or
✕, discards it.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editMode: "batch",
  newRowDefaults: () => ({ id: 0, firstName: "", salary: 30_000 }),
  onEditCommitBatch: async ({ rows, added, deleted }) => {
    await api.saveBatch({ rows, added, deleted });
  },
});

<TMDataGrid.Toolbar>
  <Button onClick={() => grid.edit.addRow()}>Add row</Button>
  <TMDataGrid.Spacer />
  <TMDataGrid.EditActions />
</TMDataGrid.Toolbar>;
```

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` straight away under
the immediate modes, so a confirmation belongs inside that callback. Under batch
it toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane's trash becomes a restore, and `submitAll` reports
the ids in `deleted`. Adds and deletes are applied by you, the same as edits -
the engine's `tempId` (`__new__1`, …) never needs to become a real id.

## The chrome

The generated edit lane (`EDIT_COLUMN_ID`, pinned right) appears when `editMode`
is `"row"`, or `onRowDelete` is set, or `editMode` is `"batch"` with
`onEditCommitBatch` set. Nothing else conjures it, and `"cell"` mode has no
chrome at all by design.

`TMDataGrid.EditActions` is Save with the pending count plus Discard. It greys
out while nothing is pending, spins while a submit is in flight, renders nothing
while editing is off, and works under any mode, not only batch.

`renderActions` replaces the pair while handing over its pieces:

```tsx
<TMDataGrid.EditActions
  renderActions={({ state, Controls }) => (
    <Group>
      {state.pendingCount > 0 && <Badge>{state.pendingCount}</Badge>}
      <Controls.Save />
      <Controls.Discard />
    </Group>
  )}
/>
```

`state` is `{ pendingCount, isSubmitting }`, `actions` is `{ save, discard }`.

## The engine: `edit`

`grid.edit` is public, and everything the chrome does goes through it:
`begin` and `commit`, `cancel` / `cancelAll`, `submitAll`, `addRow` /
`deleteRow`, `getForm`, and `store` for `useSelector`. Every member with its
signature, the gates, `clearCell`, `deactivate`, and the `edit.store` shape are
in [references/editing-api.md](references/editing-api.md#the-edit-engine).

```tsx
import { useSelector } from "@tanstack/react-store";

const pendingCount = useSelector(
  grid.edit.store,
  (state) => state.openRowIds.length + state.deletedRowIds.length,
);
```

`getForm` is the *one row, one form* promise made public: render that same form
in a drawer and it shares values, dirty state and errors with the inline cells,
because it is the same `FormApi`.

## Inside an outer form

A `@tanstack/react-form` form can own the row array, with the grid as a
controlled field: `data` from `field.state.value`, and `onEditCommit` /
`onRowAdd` / `onRowDelete` composing the next array into `field.handleChange`.
Use `editMode: "row"` so a row reaches the form on approval, map by row id
(never index), and mint negative ids for new rows.

The validation split is structural, not stylistic: **a rule decidable from one
row belongs to the grid (`meta.validate`, `rowValidators`); a rule needing the
other rows or the collection ("has rows", "no duplicates") belongs to the
form's field validator.** A row's form cannot see the array, and `edit.store`
publishes field names, never values, so the form cannot see a draft.

## Common mistakes

### CRITICAL Expecting the grid to write into `data`

The grid holds no copy of the rows. Without `onEditCommit` an edit commits, the
draft clears, and the cell snaps back to the value in `data`, which looks like
the edit was silently discarded.

Wrong:

```tsx
useTMDataGrid({ data: employees, columns, getRowId, editMode: "cell" });
```

Correct:

```tsx
useTMDataGrid({
  data: employees,
  columns,
  getRowId,
  editMode: "cell",
  onEditCommit: ({ rowId, value }) =>
    setEmployees((previous) =>
      previous.map((employee) =>
        String(employee.id) === rowId ? value : employee,
      ),
    ),
});
```

Source: `src/docs/editing.md`, `src/tmdatagrid/core/editEngine.ts`.

### CRITICAL `getRowId` built from the row index

`getRowId` satisfies the compiler with any string, so an index-based id passes.
Drafts are keyed by it, so after a sort or a filter the draft is applied to
whichever record now sits at that index.

Wrong:

```tsx
getRowId: (row, index) => String(index),
```

Correct:

```tsx
getRowId: (row) => String(row.id),
```

Source: `src/tmdatagrid/useTMDataGrid.tsx` (`TMDataGridEditingCallbacks`).

### HIGH A cell editor defined inside the component

`meta.editor` is rendered as JSX, so its identity is its component type. An
inline arrow is a new type on every render, which unmounts the open editor and
loses what was being typed.

Wrong:

```tsx
meta: { editor: ({ field }) => <Slider value={field.state.value} /> },
```

Correct:

```tsx
// Module scope, referenced by name.
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => (
  <Slider
    value={Number(field.state.value ?? 0)}
    onChange={(next) => field.handleChange(next)}
    onChangeEnd={() => void commit()}
  />
);

meta: { editor: SalaryEditor },
```

Source: `src/docs/editors.md`, `src/tmdatagrid/core/editEngine.ts`.

### HIGH A cross-field rule under `editMode: "cell"`

Under `"cell"` each cell commits on its own, so a rule spanning two columns can
never be satisfied by either one: the first cell edited is rejected against the
other column's old value, and the row cannot be saved at all.

Wrong:

```tsx
useTMDataGrid({ editMode: "cell", rowValidators: { onSubmit: endAfterStart } });
```

Correct:

```tsx
// "row" (or "batch") validates the whole row in one commit.
useTMDataGrid({ editMode: "row", rowValidators: { onSubmit: endAfterStart } });
```

Source: `src/docs/editors.md` (cross-field rules want a mode that commits the
whole row at once).

### HIGH An `accessorFn` column that never opens an editor

Editability follows the data path, not the column. A column built on an accessor
function has no `accessorKey`, so it maps to nothing and stays read-only while
every other column edits. No warning is raised.

Wrong:

```tsx
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
});
```

Correct:

```tsx
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
  meta: { label: "Full name", editField: "lastName" },
});
```

Source: `src/docs/editing.md` (Which cells edit).

### HIGH Swallowing the error in `onEditCommit`

The draft is dropped when `onEditCommit` resolves. A `try/catch` that logs the
failure resolves it, so a save that failed on the server clears the editor and
the grid shows the old value as though nothing happened.

Wrong:

```tsx
onEditCommit: async ({ rowId, changes }) => {
  try {
    await api.patch(rowId, changes);
  } catch (error) {
    console.error(error);
  }
},
```

Correct:

```tsx
// Reject: the form stays open with the error on the row.
onEditCommit: async ({ rowId, changes }) => {
  await api.patch(rowId, changes);
},
```

Source: `src/tmdatagrid/useTMDataGrid.tsx` (`onEditCommit`).

### HIGH Submitting an outer form while the grid holds a draft

The outer form's array contains only committed rows. Under any mode a mid-edit
row is invisible to it, and under `"batch"` *every* edit is until
`submitAll()` - so a form submit saves stale rows and collection rules pass
over pending values.

Correct:

```tsx
const hasOpenDraft = useSelector(grid.edit.store, (s) => s.openRowIds.length > 0);

<Button type="submit" disabled={!canSubmit || hasOpenDraft}>Save</Button>
// or flush instead of blocking:
const flushed = await grid.edit.submitAll();
if (flushed) await form.handleSubmit();
```

Source: `src/docs/query-builder.md` (Which mode, Submitting).

### MEDIUM Reading a commit's result as the saved value

`edit.commit(rowId)` and `edit.submitAll()` resolve to a `boolean` saying
whether the form closed, and resolve `false` when validation or a rejected save
kept it open. Ignoring the result reports a save that did not happen.

```tsx
const saved = await grid.edit.submitAll();
notifications.show({ message: saved ? "Saved" : "Some rows need attention" });
```

Source: `src/tmdatagrid/core/editEngine.ts` (`TMDataGridEditApi`).

### MEDIUM Expecting `onRowDelete` to fire under batch

Under the immediate modes `edit.deleteRow` calls `onRowDelete` at once. Under
`"batch"` it only toggles a deletion mark, and the ids arrive later in
`submitAll`'s `deleted`, so a batch grid that deletes through `onRowDelete`
alone never removes anything. Handle `deleted` in `onEditCommitBatch`.

Source: `src/docs/editing.md` (Adding and deleting rows).

## References

- [Editors and validation](references/editors-and-validation.md) - the editor
  contract, wrapping a built-in, field and row validators, server-side errors.
- [Editing API](references/editing-api.md) - every option, callback, column meta
  field, export, CSS variable and data attribute editing owns.

See also: the `columns` skill for `meta.type` and the shared `meta.options`
source, and the `testing` skill for driving editors from a test.

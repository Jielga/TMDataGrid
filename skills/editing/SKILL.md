---
name: editing
description: >
  Edit cells and rows in TMDataGrid. Covers the editing option with its four
  mode policies (cell, cellConfirm, row, batch), the required getRowId,
  editing.onCommit and editing.onCommitBatch, why the grid never mutates data,
  per-column gating with meta.edit.enabled and meta.edit.field, the six built-in
  editors picked by meta.type, custom editors through meta.edit.editor,
  per-keystroke value mapping with meta.edit.mapValue, field validation with
  meta.edit.validate and cross-field rules with editing.rowValidators (Standard
  Schema and Zod), adding and deleting rows with edit.addRow,
  editing.newRowDefaults, editing.onRowAdd and editing.onRowDelete, the
  generated edit lane, TMDataGrid.EditActions with its renderActions slot, and
  the public edit engine (begin, commit, cancel, submitAll, getForm, store).
  Load when making a grid editable, choosing an edit mode, wiring a save,
  writing a cell editor, validating an edit, or when cells will not open.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.0.0-beta.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/editing.md'
  - 'Jielga/TMDataGrid:src/docs/query-builder.md'
  - 'Jielga/TMDataGrid:src/docs/editors.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/editEngine.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/useTMDataGrid.tsx'
---

# TMDataGrid - Editing

The `editing` option turns editing on, and `editing.mode` picks how commits
happen. Three facts decide every wiring question below:

- **The grid never mutates `data`.** `editing.onCommit` applies the change
  wherever the data lives, and the updated rows arrive back through `data`.
- **One row, one form.** Each editing row gets its own TanStack Form, keyed by
  row id and living outside the DOM, so a draft survives scrolling, sorting and
  filtering.
- **`getRowId` is required** once `editing` is set, and it must be the record's
  own identity. Drafts are keyed by it.

`@tanstack/react-form` becomes a peer dependency once editing is used.

## Setup

```tsx
const [employees, setEmployees] = useState(initial);

const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "cell",
    // The grid writes nothing: apply the change, and the edited row arrives
    // back through `data`.
    onCommit: ({ rowId, value }) =>
      setEmployees((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      ),
  },
});

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
  <TMDataGrid.Table<Employee> />
</TMDataGrid>;
```

Two rules are compile errors, not options that silently do nothing: `editing`
requires `getRowId`, and `editing.onCommitBatch` exists only under
`editing.mode: "batch"`. Batch _without_ `onCommitBatch` is fine: `submitAll`
falls back to the per-row `editing.onCommit` loop.

## The four modes

All four use the same engine and the same forms. `editing.mode` sets what counts
as a commit, and which controls trigger it.

| Mode | Commits on | Cancels on | Controls |
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
or typing, where the first character replaces the value. Delete or Backspace
clears the value and commits without opening an editor. Editing implies cell
selection: `cellSelection` defaults to `"single"` while `editing` is set. The
grid places the caret in the cell that was opened, and `edit.addRow()` places it
in the new row's first editable cell, so a `meta.edit.editor` receives focus
without handling it itself.

Under `"row"` the pencil, or a double-click on any cell, which puts the caret in
the cell clicked, opens every editable cell of the row, and ✓ saves them as one
commit. Rows accumulate: opening a second row leaves the first open, and each
row's ✓ and ✕ act on that row alone.

Under `"batch"` nothing leaves the grid until `submitAll`. Enter and Tab park
the draft, dirty-marked, Escape drops that one draft, and drafts accumulate
across rows. `submitAll` then commits every open row: through the per-row
`editing.onCommit` loop by default, or through one
`editing.onCommitBatch({ rows, added, deleted })` call when that is set. Rows
failing validation stay open either way, and a rejected batch keeps every
draft.

## What a commit receives

`editing.onCommit` is handed `{ rowId, value, original, changes, source }`.
`value` is the whole edited row, for saving a record; `changes` is the per-field
diff (`columnId`, `field`, `previous`, `next`), for a PATCH, and holds one entry
in cell mode.

The engine drops the draft only when `editing.onCommit` resolves. A slow save
keeps the draft on screen with a busy marker, and a **rejection keeps the form
open** with the error on the row.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.edit.field` for a column built on `accessorFn`. Dot paths reach into nested
records, so `accessorKey: "address.city"` edits `values.address.city`.

| Gate | Effect |
| --- | --- |
| `meta.edit.enabled: false` | The column never edits |
| `meta.edit.enabled: (row) => boolean` | Per row, per column |
| `meta.edit.field: "lastName"` | The path an `accessorFn` column writes to |
| `editing.isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes (checkbox, row number, details, edit) never
edit.

```tsx
// Computed column writing back to a real field, and per-row gating.
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
  meta: { label: "Full name", edit: { field: "lastName" } },
});
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { edit: { enabled: (row) => row.original.status !== "Terminated" } },
});
```

## Editors and validation

`meta.type` picks the editor - `"string"` (the default), `"number"`,
`"boolean"`, `"date"`, `"select"` and `"multiSelect"` - and `meta.options` feeds
the two select editors from the same declaration the filter panel reads. Each
one, with the export that wraps it, is in
[references/editors-and-validation.md](references/editors-and-validation.md#the-built-in-editors).

`meta.edit.editor` replaces one, `meta.edit.validate` guards the field, and
`editing.rowValidators` carries cross-field rules. The validators are TanStack
Form's own, Standard Schema included, so a Zod schema passes straight through:

```tsx
import { z } from "zod";

// Field level, on the column. A bare schema means { onChange: schema }.
meta: { edit: { validate: z.string().min(2, "At least two characters") } }

// Form level, inside `editing`. Cross-field rules, under "row" or "batch".
rowValidators: {
  onSubmit: z
    .object({ salary: z.number().positive(), status: z.string() })
    .refine((row) => row.status !== "Terminated" || row.salary === 0, {
      message: "A terminated employee has no salary",
    }),
}
```

Pathed issues land on the matching cells, pathless ones on the row, and cell
corners mark both: blue for a dirty draft, red for a validation error.

`meta.edit.mapValue` rewrites a value instead of rejecting it: uppercase a code,
strip spaces from an IBAN, clamp a number. It runs on every write an editor
makes, so a text input maps per keystroke, and what it returns is what the
validators check and what is committed.

```tsx
meta: { edit: { mapValue: ({ value }) => String(value).toUpperCase() } }
```

Detail for all three: [references/editors-and-validation.md](references/editors-and-validation.md).

## Adding and deleting rows

`edit.addRow()` opens an entry row in a sticky block under the header, seeded
from `editing.newRowDefaults`. Enter, or the lane's ✓, commits the add through
`editing.onRowAdd` under the immediate modes; batch parks it for `submitAll`.
Escape, or ✕, discards it.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "batch",
    newRowDefaults: () => ({ id: 0, firstName: "", salary: 30_000 }),
    onCommitBatch: async ({ rows, added, deleted }) => {
      await api.saveBatch({ rows, added, deleted });
    },
  },
});

<TMDataGrid.Toolbar>
  <Button onClick={() => grid.edit.addRow()}>Add row</Button>
  <TMDataGrid.Spacer />
  <TMDataGrid.EditActions />
</TMDataGrid.Toolbar>;
```

`edit.deleteRow(rowId)` calls `editing.onRowDelete({ rowId, row })` immediately
under the immediate modes, so put any confirmation inside that callback. Under
batch it toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane's trash becomes a restore, and `submitAll` reports
the ids in `deleted`. You apply adds and deletes, the same as edits. The
engine's `tempId` (`__new__1`, …) does not need to become a real id.

## The built-in controls

The generated edit lane (`EDIT_COLUMN_ID`, pinned right) appears when
`editing.mode` is `"row"`, or `editing.onRowDelete` is set, or `editing.mode` is
`"batch"` with `editing.onCommitBatch` set. Nothing else adds it, and `"cell"`
mode renders no controls of its own.

`TMDataGrid.EditActions` is Save with the pending count plus Discard. It greys
out while nothing is pending, spins while a submit is in flight, renders nothing
while editing is off, and works under any mode, not only batch.

`renderActions` replaces the pair and hands over its pieces:

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

`grid.edit` is public, and everything the built-in controls do goes through it:
`begin` and `commit`, `cancel` / `cancelAll`, `submitAll`, `addRow` /
`deleteRow`, `getForm`, and `store` for `useSelector` (an example is under
[Submitting an outer form](#high-submitting-an-outer-form-while-the-grid-holds-a-draft)).
Every member with its signature, the gates, `clearCell`, `deactivate`, and the
`edit.store` shape are in
[references/editing-api.md](references/editing-api.md#the-edit-engine).

`getForm` exposes the row's form: render it in a drawer and it shares values,
dirty state and errors with the inline cells, because it is the same
`FormApi`.

## Inside an outer form

A `@tanstack/react-form` form can hold the row array, with the grid as a
controlled field: `data` from `field.state.value`, and `editing.onCommit` /
`editing.onRowAdd` / `editing.onRowDelete` composing the next array into
`field.handleChange`. Use `editing.mode: "row"` so a row reaches the form on
approval, map by row id (never index), and assign negative ids to new rows.

The validation split follows from what each side can see: **a rule decidable
from one row belongs to the grid (`meta.edit.validate`,
`editing.rowValidators`); a rule needing the other rows or the collection ("has
rows", "no duplicates") belongs to the form's field validator.** A row's form
cannot see the array, and `edit.store` publishes field names but not values, so
the form cannot see a draft.

## Common mistakes

### CRITICAL Expecting the grid to write into `data`

The grid holds no copy of the rows. Without `editing.onCommit` an edit commits,
the draft clears, and the cell reverts to the value in `data`.

Wrong:

```tsx
useTMDataGrid({
  data: employees,
  columns,
  getRowId,
  editing: { mode: "cell" },
});
```

Correct: wire `editing.onCommit` to apply the change where the data lives, as
in [Setup](#setup).

Source: `src/docs/editing.md`, `src/tmdatagrid/core/editEngine.ts`.

### CRITICAL `getRowId` built from the row index

`getRowId` accepts any string, so an index-based id compiles. Drafts are keyed
by it, so after a sort or a filter the draft is applied to whichever record now
sits at that index.

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

`meta.edit.editor` is rendered as JSX, so its identity is its component type. An
inline arrow function is a new type on every render, which unmounts the open
editor and discards what was being typed.

Wrong:

```tsx
meta: { edit: { editor: ({ field }) => <Slider value={field.state.value} /> } },
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

meta: { edit: { editor: SalaryEditor } },
```

Source: `src/docs/editors.md`, `src/tmdatagrid/core/editEngine.ts`.

### HIGH A cross-field rule under `editing.mode: "cell"`

Under `"cell"` each cell commits on its own, so a rule spanning two columns
cannot be satisfied by either one: the first cell edited is rejected against the
other column's old value, and the row cannot be saved.

Wrong:

```tsx
useTMDataGrid({
  editing: { mode: "cell", rowValidators: { onSubmit: endAfterStart } },
});
```

Correct:

```tsx
// "row" (or "batch") validates the whole row in one commit.
useTMDataGrid({
  editing: { mode: "row", rowValidators: { onSubmit: endAfterStart } },
});
```

Source: `src/docs/editors.md` (Validation).

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
  meta: { label: "Full name", edit: { field: "lastName" } },
});
```

Source: `src/docs/editing.md` (Which cells edit).

### HIGH Swallowing the error in `editing.onCommit`

The draft is dropped when `editing.onCommit` resolves. A `try/catch` that logs
the failure resolves it, so a save that failed on the server clears the editor
and the grid shows the old value as though nothing happened.

Wrong:

```tsx
onCommit: async ({ rowId, changes }) => {
  try {
    await api.patch(rowId, changes);
  } catch (error) {
    console.error(error);
  }
},
```

Correct: no `catch` - let the rejection propagate, and the form stays open
with the error on the row.

Source: `src/tmdatagrid/useTMDataGrid.tsx` (`TMDataGridEditingCallbacks`).

### HIGH Submitting an outer form while the grid holds a draft

The outer form's array contains only committed rows. Under any mode a mid-edit
row is invisible to it, and under `"batch"` every edit is until `submitAll()`,
so a form submit saves stale rows and collection rules skip pending values.

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

### MEDIUM Expecting `editing.onRowDelete` to fire under batch

Under the immediate modes `edit.deleteRow` calls `editing.onRowDelete` at once.
Under `"batch"` it only toggles a deletion mark, and the ids arrive later in
`submitAll`'s `deleted`, so a batch grid that deletes through
`editing.onRowDelete` alone never removes anything. Handle `deleted` in
`editing.onCommitBatch`.

Source: `src/docs/editing.md` (Adding and deleting rows).

## References

- [Editors and validation](references/editors-and-validation.md) - the editor
  API, wrapping a built-in, what `mapValue` leaves alone, field and row
  validators, server-side errors.
- [Editing API](references/editing-api.md) - every option, callback, column meta
  field, export, CSS variable and data attribute belonging to editing.

See also: the `columns` skill for `meta.type` and the shared `meta.options`
source, and the `testing` skill for driving editors from a test.

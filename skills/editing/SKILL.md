---
name: editing
description: >
  Edit cells and rows in TMDataGrid. Covers the editing option with its four
  mode policies (cell, cellConfirm, row, draft), the required getRowId,
  editing.onCommit and editing.onCommitDrafts, why the grid never mutates data,
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
requires `getRowId`, and `editing.onCommitDrafts` exists only under
`editing.mode: "draft"`. Draft _without_ `onCommitDrafts` is fine: `submitAll`
falls back to the per-row `editing.onCommit` loop.

## The four modes

All four use the same engine and the same forms. `editing.mode` sets what counts
as a commit, and which controls trigger it.

| Mode | Commits on | Cancels on | Controls |
| --- | --- | --- | --- |
| `"cell"` | Enter, Tab, blur | Escape | none |
| `"cellConfirm"` | ✓ or Enter; blur keeps the draft | ✕ or Escape | ✓ / ✕ beside the input |
| `"row"` | Save in the edit lane, or Ctrl+Enter | Cancel, or Escape | generated edit lane |
| `"draft"` | `edit.submitAll()` | `edit.cancelAll()`, or per row in the lane | `TMDataGrid.EditActions` + the edit lane |

Which to pick: `"cell"` for saved-as-you-go spreadsheet feel; `"cellConfirm"`
when a stray click must not fire a request; `"row"` when the row is the unit of
the save or a rule spans two columns; `"draft"` for many edits sent as one
transaction.

An editor opens on double-click, or with the cell cursor on the cell: Enter, F2,
or typing, where the first character replaces the value. Delete or Backspace
clears the value and commits without opening an editor; under `"draft"` the
cleared value is held with the other drafts instead. Editing implies cell
selection: `cellSelection` defaults to `"single"` while `editing` is set. The
grid places the caret in the cell that was opened, and `edit.addRow()` places it
in the new row's first editable cell, so a `meta.edit.editor` receives focus
without handling it itself.

Under `"row"` the pencil, or a double-click on any cell, which puts the caret in
the cell clicked, opens every editable cell of the row, and ✓ saves them as one
commit. Rows accumulate: opening a second row leaves the first open, and each
row's ✓ and ✕ act on that row alone.

Under `"draft"` nothing reaches a callback until `submitAll`. Enter and Tab hold
the draft, Tab moving on to the next editable cell, Escape drops that one draft,
and drafts accumulate across rows, surviving filters, sorts and scrolling.
`edit.commit(rowId)` validates and holds the draft too, so there is no per-row
escape hatch to the consumer. A held draft is displayed: the cell renders the
draft value through the column's own `cell` renderer, with the blue corner
marking it dirty and `data-dirty` on the row.

The edit lane is the change indicator and the per-row undo: an edited row shows
a pencil icon and Revert, which drops that row's draft; a new row a plus icon, a
pencil that reopens it, and ✕; a row marked for deletion a trash icon and
Restore. A row holding a dirty draft hides the trash - revert first, then
delete. A row blocked by validation turns its icon red with the message in the
tooltip.

`submitAll` then commits every pending change: through the per-row
`editing.onCommit` / `editing.onRowAdd` / `editing.onRowDelete` loop by default,
or through one `editing.onCommitDrafts({ rows, added, deleted })` call when that
is set. Rows failing validation stay open either way, and a rejected save keeps
every draft.

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

// Form level, inside `editing`. Cross-field rules, under "row" or "draft".
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
`editing.onRowAdd` under the immediate modes; under draft mode it enters the
row, which is validated, held with the other drafts, and reported in
`submitAll`'s `added`. Escape, or ✕, discards the entry.

Under `"draft"` an entered row renders as a value row with no inputs, marked
`data-new` and `data-confirmed` and tinted with `--dg-row-new-bg`. By default it
joins the scrolling flow above the body rows; `editing.newRowsSticky: true`
keeps entered rows pinned in the entry block until Save all. Double-click, or
the lane's pencil, reopens it; ✕ removes it. To limit how many entry rows are
open at once, gate the Add button on
`useSelector(grid.edit.store, (s) => s.newRows.some((n) => !n.confirmed))`.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "draft",
    newRowDefaults: () => ({ id: 0, firstName: "", salary: 30_000 }),
    onCommitDrafts: async ({ rows, added, deleted }) => {
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
draft mode it toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane shows Restore, and `submitAll` reports the ids in
`deleted`. You apply adds and deletes, the same as edits. The engine's `tempId`
(`__new__1`, …) does not need to become a real id.

## The built-in controls

The generated edit lane (`EDIT_COLUMN_ID`, pinned right) appears when
`editing.mode` is `"row"` or `"draft"`, or when `editing.onRowDelete` is set.
Nothing else adds it, and `"cell"` mode renders no controls of its own. Under
`"row"` it holds Save and Cancel while a row is open; under `"draft"` it holds
the row-state marker with Revert and Restore, and Save and Cancel never appear.
Every control carries a tooltip from the labels.

`TMDataGrid.EditActions` is Save with the pending count plus Discard. It greys
out while nothing is pending, spins while a submit is in flight, renders nothing
while editing is off, and works under any mode, not only draft.

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

Each one compiles and raises no warning. The reason and the fix for every entry
are in [references/common-mistakes.md](references/common-mistakes.md).

| Severity | Mistake |
| --- | --- |
| CRITICAL | Expecting the grid to write into `data` - without `editing.onCommit` the cell reverts |
| CRITICAL | `getRowId` built from the row index - drafts follow the index, not the record |
| HIGH | A cell editor defined inside the component - a new type per render unmounts the editor |
| HIGH | A cross-field rule under `mode: "cell"` - `rowValidators` needs `"row"` or `"draft"` |
| HIGH | An `accessorFn` column with no `meta.edit.field` - it maps to nothing and stays read-only |
| HIGH | Swallowing the error in `editing.onCommit` - a resolved catch drops the draft |
| HIGH | Submitting an outer form while the grid holds a draft - it saves stale rows |
| MEDIUM | Reading a commit's result as the saved value - it is a `boolean` about the form |
| MEDIUM | Expecting `editing.onRowDelete` to fire under draft - the mark waits for `submitAll` |

## References

- [Editors and validation](references/editors-and-validation.md) - the editor
  API, wrapping a built-in, what `mapValue` leaves alone, field and row
  validators, server-side errors.
- [Editing API](references/editing-api.md) - every option, callback, column meta
  field, export, CSS variable and data attribute belonging to editing.
- [Common mistakes](references/common-mistakes.md) - the failure modes above,
  each with its wrong and correct form.

See also: the `columns` skill for `meta.type` and the shared `meta.options`
source, and the `testing` skill for driving editors from a test.

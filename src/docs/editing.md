# Cell editing

Set `editMode` and the grid's cells open editors. One TanStack Form is
created per editing row — "one row, one form" — and the grid never mutates
`data`: `onEditCommit` applies the change wherever the data lives, and the
new rows flow back in through `data` as always.

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

`getRowId` is required: drafts are keyed by row id, and the index fallback
would point a draft at a different record after any sort. `@tanstack/react-form`
is a peer dependency once editing is used.

The editing options travel together, and the types state it: setting any of
them without `editMode` is a compile error (they would act on nothing), the
moment `editMode` is set `getRowId` stops being optional, and
`onEditCommitBatch` only exists under `editMode: "batch"` — the one mode
whose `submitAll` calls it. Batch *without* `onEditCommitBatch` stays legal:
`submitAll` falls back to the per-row `onEditCommit` loop.

## Modes

`editMode` is one axis; each mode is a policy over the same engine.

| Mode | Commit | Cancel | Chrome |
| --- | --- | --- | --- |
| `"cell"` | Enter, Tab, blur — Sheets | Escape | none |
| `"cellConfirm"` | ✓ or Enter only; blur keeps the draft | ✕ or Escape | ✓ / ✕ beside the input |
| `"row"` | Save in the edit lane, or Ctrl+Enter | Cancel, or Escape | generated edit lane |
| `"batch"` | `edit.submitAll()` | `edit.cancelAll()` | `TMDataGrid.EditActions` |

### Batch

Under `"batch"` nothing commits until you say so: Enter and Tab park the
draft (dirty-marked, Tab moving on to the next editable cell), Escape drops
the one draft, and drafts accumulate across rows — surviving filters, sorts
and scrolling, since they live outside the DOM. `TMDataGrid.EditActions` in
the toolbar is the chrome: Save with the dirty-row count, and Discard.

`edit.submitAll()` commits every open row — through the per-row
`onEditCommit` loop by default, or through one `onEditCommitBatch({ rows })`
call when that is set. Rows failing validation stay open either way, and a
rejected batch keeps every draft.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.editField` for a column built on `accessorFn`. Dot paths reach into
nested records — `accessorKey: "address.city"` edits `values.address.city`,
and a nested schema's issues land on the right column.

| Gate | Effect |
| --- | --- |
| `meta.editable: false` | column never edits |
| `meta.editable: (row) => boolean` | per-row, per-column |
| `isRowEditable: (row) => boolean` | whole row, every mode |

Group rows and the generated lanes never edit.

## Editors

`meta.type` picks the built-in editor; `meta.options` feeds the select
editors the same way it feeds the filter panel.

| `meta.type` | Editor |
| --- | --- |
| `string` (default) | text input |
| `number` | number input |
| `boolean` | checkbox |
| `date` | native `<input type="date">` |
| `select` | searchable select, from `meta.options` (commits on pick under `"cell"`) |
| `multiSelect` | multi-select, same source |

Opening: double-click, or with the cell cursor on the cell — Enter, F2, or
just typing (the character replaces the value, as in a spreadsheet).
Delete/Backspace clears the value and commits without opening anything.
Editing brings cell selection along: `cellSelection` defaults to `"single"`
while `editMode` is set.

### Custom editors

`meta.renderEditor` fills the same slot the built-ins do, and receives the
live TanStack Form `field` API — bind any control to it exactly as inside a
form:

```tsx
meta: {
  renderEditor: ({ field, commit, cancel }) => (
    <Slider
      value={field.state.value}
      onChange={field.handleChange}
      onChangeEnd={() => void commit()}
    />
  ),
}
```

The built-ins are exported (`TMDataGridStringEditor`, …) so a custom editor
can wrap one instead of starting over.

## Validation

Nothing invented — validators are TanStack Form's own, Standard Schema
included, so a Zod schema passes straight through:

```tsx
// Per column: field-level validators. Bare schema = { onChange: schema }.
meta: { validate: z.string().min(2, "Too short") }

// Per row: form-level validators — cross-field rules live here.
useTMDataGrid({
  editMode: "cell",
  rowValidators: {
    onSubmit: z.object({ salary: z.number().positive() })
      .refine((r) => r.status !== "Terminated" || r.salary === 0, {
        message: "A terminated employee has no salary",
      }),
  },
});
```

Pathed issues land on the matching cells; pathless ones on the row. A commit
blocked by validation keeps the editor open with the message on the input. A
rejected `onEditCommit` keeps the draft too, with the error on the row —
server-side field errors can also be returned natively through
`rowValidators.onSubmitAsync`'s `{ form, fields }` shape.

## Drafts and virtualization

Forms live outside the DOM, keyed by row id. Scrolling an editing row away
unmounts the editor; the form keeps its values, dirty state and errors, and
the editor remounts over the same form when the row returns. Cell corners
mark the state meanwhile: blue for a dirty draft, red for a validation error.

## Adding and deleting rows

`edit.addRow()` opens an **entry row** in a sticky block under the header —
the one place stickiness is genuinely required, since a row being typed into
exists nowhere else to scroll back to. Entry cells are real editors over a
form seeded from `newRowDefaults`; Enter (or the lane's ✓) commits the add
through `onRowAdd` under the immediate modes, while batch parks it for
`submitAll`. Escape (or ✕) discards the entry.

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

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` straight away
under the immediate modes — confirmation, if wanted, belongs in that
callback. Under batch it toggles a mark instead: the row renders struck
through and inert (`data-deleted`), the lane's trash becomes a restore, and
`submitAll` reports the ids in `deleted`. Setting `onRowDelete` puts the
trash can in the edit lane, which appears in any mode that has a use for it.

The grid still never mutates `data`: adds and deletes are applied by the
consumer, and the new rows arrive back through `data`. The engine's `tempId`
(`__new__1`, …) never needs to become a real id — mint one when creating the
record.

## The engine — `api.edit`

Everything the chrome does goes through `edit`, which is public:

| Member | Does |
| --- | --- |
| `edit.begin({ rowId, columnId })` | opens an editor |
| `edit.commit(rowId)` | commits — resolves `false` if blocked |
| `edit.cancel(rowId)` / `edit.cancelAll()` | drops drafts |
| `edit.submitAll()` | commits every open row (batch) |
| `edit.addRow()` / `edit.deleteRow(rowId)` | rows in and out |
| `edit.getForm(rowId)` | the row's live `FormApi` |
| `edit.store` | open rows, active cell, dirty/error projections, entry rows, deletion marks |

`getForm` is the "one row, one form" promise made public: render the same
form in a drawer or side panel and it shares values, dirty state and errors
with the inline cells, because it is the same `FormApi`.

The demo site's *Editable grid* page runs every built-in editor with Zod
validation per column.

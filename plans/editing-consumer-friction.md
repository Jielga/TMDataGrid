# Editing: consumer friction notes

> **Status: notes, not decisions.** Gathered 2026-08-19 from a consumer
> session building a parent/child editor against 1.0.x. Nothing here is
> approved or scheduled; more field evidence is being collected before any
> of it becomes a proposal. Every item names the code it is about, so a
> later reader can check whether it still holds.

The session: a child-row grid with two modes - **create** (the parent entity
does not exist yet, rows are built locally and POST in one go with the parent
form) and **update** (the parent exists, rows are saved by themselves through
PUT/POST/DELETE). Plus a spreadsheet import feeding rows into the grid.

Ordered by how much time each one cost, worst first.

## 1. Delete chrome is inferred from which save callback you passed

Both gates read intent out of the callbacks rather than taking it as an
option, and they disagree by mode:

- `editColumnEnabled` - [useTMDataGrid.tsx:906](../src/tmdatagrid/useTMDataGrid.tsx)
- `canDeleteRows()` - [editEngine.ts:720](../src/tmdatagrid/core/editEngine.ts)

```
batch:                onRowDelete ?? onEditCommitBatch
row / cell / cellConfirm:  onRowDelete only
```

This cost the consumer time **twice in one session**, in both directions:

- `editMode: "batch"` wired to `onEditCommit` (the per-row callback) - batch
  editing works, `submitAll` falls back to the per-row loop, and the lane
  column is silently never generated.
- then `editMode: "cell"` while `onEditCommitBatch` was still the only
  callback set - same silent outcome, because outside batch that callback
  counts for nothing.

There is also no opt-out. Under batch with `onEditCommitBatch` set, the trash
is unconditional (modulo the per-row gates below), so a consumer who wants
their own delete affordance ends up with two.

**Why a dev warning is the wrong fix.** Tempting to fold this into P3's
framework, but `editMode: "batch"` with no delete callback is a legitimate,
deliberate configuration - pinned as legal in
[optionUnions.test.ts:27](../src/tmdatagrid/core/optionUnions.test.ts), and
coherent: batch edits, no deletes. A rule here would fire on valid setups.
Nothing distinguishes "meant to have deletes" from "doesn't want deletes"
except an explicit statement from the consumer.

**Candidate direction (not a decision).** `enableRowDelete?: boolean`
defaulting to today's inference, so both cases can say what they mean. Public
API, so it needs a proposal.

## 2. The per-row gates take the trash away with the pencil

Inside the lane cell, two more conditions hide delete, both in
[TMDataGridEditColumn.tsx](../src/tmdatagrid/components/TMDataGridEditColumn.tsx):

- **line 104** - `if (!edit.canEditRow(row)) return null;` runs before the
  delete branch, so `isRowEditable: false` removes the trash along with the
  pencil. Not editable and not deletable are different claims; today they are
  the same switch.
- **line 106** - the trash only renders in the `!isOpen` branch. Under batch a
  row is open from its first keystroke until `submitAll`, so an edited row has
  no delete affordance for the rest of the batch session. Under the immediate
  modes it is transient, one row at a time.

## 3. "Never saved" is reachable only through `addRow()`

`deleteRow` already does the right thing for a row that was never persisted -
it discards rather than marking
([editEngine.ts:699](../src/tmdatagrid/core/editEngine.ts)) - but `isNew: true`
is set at exactly one call site, `addRow` at line 688. Both other `createForm`
calls pass `false`, so anything arriving through `data` is by construction
"a row the server knows about".

Consequence for the create mode: rows built locally and held in `data` get
marked struck-through on delete instead of vanishing, and their locally minted
ids turn up in `submitAll`'s `deleted`, where the consumer has to filter them
out before they reach a server that never had them.

The consumer's own words - *"they were never saved in the first place, so
adding the new rows to data seems wrong"* - are the library's own rule; there
is just no way to state it from outside.

**Candidate direction (not a decision).** `isRowNew?: (row) => boolean`
feeding the existing `isNew` branch. Public API, so it needs a proposal.

## 4. The entry block has no bulk path

[TMDataGridEntryRows.tsx:95](../src/tmdatagrid/components/TMDataGridEntryRows.tsx)
renders every new row, unvirtualized, and every entry cell mounts a live
`TMDataGridCellEditor`. The block is `position: sticky` under the header with
no max-height
([TMDataGridTable.module.css:347](../src/tmdatagrid/components/TMDataGridTable.module.css)).

A 200-row spreadsheet import therefore has no good route:

- through `addRow()` in a loop - 200 sticky rows and ~1200 mounted editors,
  and the "sticky" block is taller than the viewport;
- through `data` - fine at any size, but the rows lose the `added` channel, so
  a server that needs INSERTs cannot tell them from UPDATEs.

Options to weigh later: cap and scroll the block, an `addRows(seeds)` bulk
entry point, item 3 above (which makes the `data` route correct), or simply
documenting the ceiling.

## 5. `addRow()` cannot be seeded per call

`addRow: () => string`
([editEngine.ts:315](../src/tmdatagrid/core/editEngine.ts)) takes no arguments;
the only seed channel is `newRowDefaults`. Two workarounds exist and both
work - mutate a ref that the defaults function reads (it is called
synchronously at line 684), or `edit.getForm(tempId)?.setFieldValue(...)`
afterwards - but neither is documented. The ref version is the better one: it
seeds before first paint, so no flash of the default value.

## 6. The docs understate the delete gate

[editing.md:156](../src/docs/editing.md) says only:

> Setting `onRowDelete` puts the trash can in the edit lane, which appears in
> any mode that has a use for it.

"any mode that has a use for it" hides the `onEditCommitBatch` path under
batch and both per-row gates from item 2. This is the one item here that is
cheap, non-breaking and independent of every other - a table stating the
gate would have saved the session outright, whatever happens to items 1-5.

## 7. No recipe for the two-mode parent/child editor

The shape the consumer landed on is a common one and is currently
un-illustrated. Adjacent to
[query-builder.md](../src/docs/query-builder.md), which shows a grid inside a
TanStack Form:

| | Create (parent unsaved) | Update (parent exists) |
| --- | --- | --- |
| `editMode` | `"cell"` | `"batch"` |
| Commit target | local array; the parent form POSTs everything | `onEditCommitBatch` → PUT / POST / DELETE |
| Delete | `onRowDelete` removes from the array, immediately | marks, resolved at Save |
| Adds | local ids (negatives or uuid) | `addRow()`, arriving in `added` |
| `EditActions` | omit - the pending count is always 0 under `"cell"`, so Save sits permanently disabled | include; the Save is real |

Two transition facts belong in any such recipe:

- changing `editMode` runs `edit.cancelAll()`
  ([useTMDataGrid.tsx:1100](../src/tmdatagrid/useTMDataGrid.tsx)) - deliberate,
  since a batch draft carried into `"cell"` would silently commit;
- row identity changes when the parent is created (local ids become server
  ids), invalidating anything keyed by row id, so remounting on the parent id
  is the simple answer.

## Still to gather

- Whether items 1 and 3 are worth public options, or whether the docs fix
  (item 6) plus the recipe (item 7) absorb most of the cost.
- How large real imports are - item 4's answer differs a lot between "a few
  dozen" and "a few thousand".
- Whether anyone wants delete on rows that `isRowEditable` closes (item 2), or
  whether coupling them is in fact what people expect.

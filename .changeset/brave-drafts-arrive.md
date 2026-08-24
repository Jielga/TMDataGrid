---
"@jielga/tmdatagrid": major
---

**Breaking.** The `"batch"` edit mode is now `"draft"`, reworked: a held draft
renders its value through the column's own `cell` renderer (in `cellConfirm`
too), an entered new row stays in the grid as a value row until Save all, and
the edit lane becomes the change indicator and per-row revert - a state icon
(new/edited/deleted) beside Revert, Restore or remove. Nothing reaches a
callback before `edit.submitAll()`: the lane's per-row save and
Delete-to-clear no longer commit under draft mode.

| Before | After |
| --- | --- |
| `editing.mode: "batch"` | `editing.mode: "draft"` |
| `editing.onCommitBatch` | `editing.onCommitDrafts` |
| `TMDataGridEditCommitBatchArgs` | `TMDataGridEditCommitDraftsArgs` |
| `edit.state.newRows[]` `{ tempId }` | `{ tempId, confirmed }` |

New: `editing.newRowsSticky` (entered rows scroll by default), row
`data-dirty`, entry-row `data-new` / `data-confirmed`, parts `row-state` /
`revert-row`, `edit.state.rows[id].values`, labels `revertRow` /
`rowStateNew` / `rowStateEdited` / `rowStateDeleted`, `--dg-row-new-bg`.
The edit lane now appears under draft mode without `onCommitDrafts`.

Fixed: Restore on a deletion-marked row was unclickable in real browsers
(`pointer-events`).

---
"@jielga/tmdatagrid": minor
---

Under `editing.draft`, `edit.deleteRow` marks idempotently instead of toggling:
deleting a marked row again leaves it marked, and the new `edit.restoreRow(rowId)`
is the undo (the lane's Restore now calls it). A deletion mark is also refused
for ids the grid cannot save - an unknown id, or an entry row's temp id named
again after the entry was discarded - which used to inflate the Save count.

- New `edit.deleteRows(rowIds)` - `deleteRow` over a list in one call, safe to
  feed a selection as it stands.
- A cancel or delete racing a pending commit no longer leaves a ghost id in
  `committedRowIds`.

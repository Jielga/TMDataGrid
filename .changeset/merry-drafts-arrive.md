---
"@jielga/tmdatagrid": minor
---

Under `editing.draft`, committed drafts and committed new rows are the table's
rows: they sort, filter, group and aggregate on their draft values, and
`edit.getRows()` and `editing.tableValidators` read the same collection.
`editing.newRowsSticky` keeps committed new rows in the entry block instead.

- Body rows publish `data-new`; a committed new row is a `row` part, no longer
  an `entry-row`, and `data-dg-entry-flow-block` is gone.
- New `TMDataGridEditState.committedValues` - the draft store's values, kept
  across a reopen so the row holds its place.
- Row callbacks now receive the draft as `row.original`; a new row carries its
  temp id.

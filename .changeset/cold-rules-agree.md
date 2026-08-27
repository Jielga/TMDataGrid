---
"@jielga/tmdatagrid": minor
---

`editing.tableValidators` - cross-row validation.

- `onSubmit` / `onSubmitAsync` receive `{ value, rowId, isNew, rows }`, where `rows` is the collection as it would stand if the commit landed: every draft overlaid, entry rows appended, deletion-marked rows removed.
- Same result vocabulary as `rowValidators`; pathed issues land on the committing row's cells, pathless ones on the row.
- Runs at every commit after the row's own validators, and again per parked row during `saveDrafts`, so a draft a later edit invalidated blocks the save.

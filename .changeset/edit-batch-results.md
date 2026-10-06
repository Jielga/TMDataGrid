---
"@jielga/tmdatagrid": major
---

Per-row results from the batch edit calls:

- `edit.commitAll()` resolves `{ ok, committed, open }`.
- `edit.saveDrafts()` resolves `{ ok, saved, kept, reopened }`; a check like `if (await grid.edit.saveDrafts())` is now always true - read `.ok`.
- `addRows`' result gains `ok`.
- The `onSaveDrafts` return type is renamed `TMDataGridSaveDraftsResponse`; `TMDataGridSaveDraftsResult` is now the type `saveDrafts()` resolves.

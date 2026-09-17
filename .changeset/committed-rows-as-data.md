---
"@jielga/tmdatagrid": minor
---

A committed row is data, not a form: a row that commits into the draft store drops its TanStack Form and is held as a snapshot of its values, so ten thousand imported rows cost a few megabytes instead of about eighty. Reopening a committed row - `begin`, `setCellValue`, `setRowValues`, `clearCell` - builds a fresh form seeded with the committed values. Closes [#81](https://github.com/Jielga/TMDataGrid/issues/81).

- **Breaking.** `edit.getForm(rowId)` returns `undefined` for a committed row. A drawer over one calls `begin` first.
- `saveDrafts` re-runs `editing.tableValidators` only; column rules and `rowValidators` ran at commit on the same values. A committed row that fails a table rule at Save, or whose `onCommit` / `onRowAdd` rejects on the per-row path, is reopened with the error instead of staying committed with errors on its form.

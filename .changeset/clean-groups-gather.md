---
"@jielga/tmdatagrid": major
---

The editing options of `useTMDataGrid` are namespaced under one `editing`
object, matching the 2.0 `meta.edit` column namespacing.

- `editMode: X` becomes `editing: { mode: X }`
- `onEditCommit` becomes `editing.onCommit`
- `onEditCommitBatch` becomes `editing.onCommitBatch`
- `rowValidators`, `isRowEditable`, `newRowDefaults`, `onRowAdd` and
  `onRowDelete` keep their names and move inside `editing`
- `getRowId` stays top-level and is still required once `editing` is set

`TMDataGridEditingOptions` is now the type of the `editing` object itself.
`TMDataGridEditMode`, the `edit` engine and the feature flags are unchanged.

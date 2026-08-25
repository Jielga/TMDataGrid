---
"@jielga/tmdatagrid": minor
---

`edit.addRow` takes the values the entry row starts from.

`addRow(values)` overrides `editing.newRowDefaults` field by field, so one call
opens the default row and another opens it filled in - or duplicates an existing
row by passing it whole. `addRow()` is unchanged.

---
"@jielga/tmdatagrid": patch
---

A group row leaves a column without `aggregationFn` or `aggregatedCell` blank again, instead of calling the column's `cell` with an `undefined` value.
A column that wants content on group rows without aggregating declares `aggregatedCell`.

---
"@jielga/tmdatagrid": major
---

`meta.options` and `meta.edit.enabled` callbacks receive rows typed as `TData` when the column is built with `createTMDataGridColumnHelper<TData>()`; `row.original` needs no cast. A callback annotated with the untyped row type no longer compiles there - drop the annotation. `TMDataGridColumnMeta`, `TMDataGridOptionsSource`, `TMDataGridOptionsArgs` and `TMDataGridColumnEditOptions` take an optional `TData`, and the helper type is exported as `TMDataGridColumnHelper`.

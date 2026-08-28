---
"@jielga/tmdatagrid": patch
---

Committed entry rows under `editing.draft`:

- A cell that takes no edit (`meta.edit.enabled: false`, or a column with no field) no longer reopens the row on double-click, the same as a body cell.
- The row now gets the value-row padding, border and `--dg-row-new-bg` tint; the stylesheet still keyed on the old `data-confirmed` name.

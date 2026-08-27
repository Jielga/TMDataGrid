---
"@jielga/tmdatagrid": minor
---

Programmatic edits and a column allowlist.

- `edit.setCellValue(rowId, columnId, value)` and `edit.setRowValues(rowId, values)` write through the edit engine, so a toolbar action or bulk fill lands in the draft store as a typed edit does - change markers, per-row revert and all. Rows need not be mounted. `meta.edit.validate` runs; `meta.edit.mapValue` does not, as with `clearCell`.
- `editing.columns` names the columns that take edits, instead of switching every other column off with `meta.edit.enabled: false`. Unset, every column mapping to a data path stays editable.
- `edit.isColumnEditable(column)` answers the column's half of the rule with no row in hand.
- `aggregateColumn` reads the filtered model's `flatRows`, so a tree built with `getSubRows` totals its children instead of only its roots. Flat and grouped grids are unchanged.
- The `number` editor no longer writes `NaN` when the text is not yet a number - partial input such as `-` or `1e` leaves the field empty and stays on screen.

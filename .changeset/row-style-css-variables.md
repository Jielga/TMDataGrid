---
"@jielga/tmdatagrid": minor
---

`TMDataGrid.Table`'s `rowStyle` accepts CSS custom properties, and the type behind it is exported as `TMDataGridRowStyle`. Setting `--row-bg` is the documented way to colour a row, but the prop was typed as plain `CSSProperties`, so the documented usage did not compile.

---
"@jielga/tmdatagrid": minor
---

Add `rowSelectionMode`. `"checkbox"` (the default) keeps the checkbox column;
`"row"` drops it and toggles a row on click. `highlightSelectedRows` controls
the selected-row background and follows the mode. Fixes the selection
checkboxes not re-rendering when a row was selected.

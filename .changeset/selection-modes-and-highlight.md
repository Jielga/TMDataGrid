---
"@jielga/tmdatagrid": minor
---

Add `selectionMode`, replacing `rowSelectionMode`: `"checkbox"` (the default),
`"row"`, `"checkboxAndHighlight"` and `"highlight"`. The last two introduce a
highlighted row — state of its own, so a checkbox multi-selection and a single
highlighted row can coexist for a detail panel. Row-click selection gains the
usual Ctrl/Shift modifiers, and the select-all box is dropped under
`enableMultiRowSelection: false`, where it selected every row.

Breaking renames:

- `rowSelectionMode` → `selectionMode` (`"checkbox"` and `"row"` unchanged)
- `highlightSelectedRows` → `showSelectedBackground`
- `data-highlighted` → `data-selected-bg`; `data-highlighted` now marks the
  highlighted row
- New `--dg-row-highlight-bg` alongside `--dg-row-selected-bg`

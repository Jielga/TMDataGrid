---
"@jielga/tmdatagrid": patch
---

Column resizing, the cell range drag and the filter popup's click-away now work when the grid is rendered through a portal into a window opened with `window.open`.
Their listeners attach to the grid's own document and window rather than the global ones.

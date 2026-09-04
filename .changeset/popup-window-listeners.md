---
"@jielga/tmdatagrid": patch
---

Column resizing, the cell range drag and the filter popup's click-away now work when the grid is rendered through a portal into a window opened with `window.open`.
Their listeners attach to the grid's own document and window rather than the global ones.

Focus checks, editor focus handling, select-column click detection and autosize measurement use the grid's own document and window as well, so they behave the same in a popup window as inline.

---
"@jielga/tmdatagrid": minor
---

`scrollToRow({ rowId, align })` on the api returned by `useTMDataGrid`. The grid is always virtualized, so a row far down the list has no element to scroll to — this moves the virtualizer instead. Answers `false` when the row is not in the current view (filtered out, on another page, or an unknown id) and scrolls nothing; a pinned row answers `true` without scrolling.

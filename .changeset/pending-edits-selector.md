---
"@jielga/tmdatagrid": minor
---

New `hasPendingEdits(state)` export: `true` while the grid holds unsaved work (an open row with a changed value, an entry row, the draft store, or a save in flight). Use it as `useSelector(grid.edit.store, hasPendingEdits)` to block navigation.

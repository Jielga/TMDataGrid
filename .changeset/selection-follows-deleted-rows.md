---
"@jielga/tmdatagrid": patch
---

A row the engine takes out of the table now leaves `rowSelection` with it: an entry row discarded by `deleteRow`, `deleteRows` or `cancel`, or saved by `saveDrafts`, and a marked row once its deletion is saved. A stale id used to keep the select-all box indeterminate and the selection non-empty after a bulk delete of selected rows.

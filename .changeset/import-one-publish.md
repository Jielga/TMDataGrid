---
"@jielga/tmdatagrid": patch
---

`edit.addRows(rows, { commit: true })` under `editing.draft` is one publish for the whole import: the rows are validated together and land in the draft store in the same render that shows them. Ten thousand rows take about a second; before, each row cost a render and a copy of the store, so the same import took minutes. `saveDrafts`, `commitAll`, `cancelAll` and `deleteRows` publish once for their batch the same way.

- The engine no longer registers its row forms with TanStack Form devtools - three `window` listeners per row, and a broadcast on every change of every row.

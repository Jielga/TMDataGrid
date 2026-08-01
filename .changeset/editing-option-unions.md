---
"@jielga/tmdatagrid": major
---

Types: the editing options are now a discriminated union. BREAKING for TypeScript consumers who passed an editing callback without `editMode`, `onEditCommitBatch` outside `editMode: "batch"`, or `editMode` without `getRowId` — all previously broken at runtime, now compile errors.

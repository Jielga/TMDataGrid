---
"@jielga/tmdatagrid": patch
---

Unticking the header checkbox clears every row the filters show again, including a ticked row that `enableRowSelection` turns down. Since TanStack 9.2 such a row stayed ticked and the header checkbox could never clear.

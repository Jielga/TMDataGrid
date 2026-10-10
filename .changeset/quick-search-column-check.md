---
"@jielga/tmdatagrid": patch
---

The quick search decides which columns it reads once per data change instead of on every render. A column empty in every row no longer costs a scan of all rows per header render.

---
"@jielga/tmdatagrid": patch
---

`getRowCanExpand` decides which data rows have a detail panel: a row it turns down shows no chevron, and expand-all skips it. A group row always expands, whatever the predicate says of its first record.

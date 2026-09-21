---
"@jielga/tmdatagrid": patch
---

Fixed: an entry row rendered nothing in the cells it does not open, a display column or one with `meta.edit.enabled` off, both when first added and when a committed new row was reopened. They now render through the column's own `cell` renderer over the row as shown, as on a body row.

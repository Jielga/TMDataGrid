---
"@jielga/tmdatagrid": patch
---

`meta.autoSize` waits for the column's first cells.

It ran once on the mounting commit, so a grid whose rows are fetched had a
header and no cells to measure and the column kept that width. The
double-click gesture and the **Autosize column** menu item are unchanged.

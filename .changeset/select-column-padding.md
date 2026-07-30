---
"@jielga/tmdatagrid": patch
---

Fix the checkbox being clipped in the select column at `size="xl"`. The column
is a fixed 48px track, which the cell padding — 18px a side at `xl` — left too
little room for. It no longer takes that padding and centres its box instead.

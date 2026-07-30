---
"@jielga/tmdatagrid": patch
---

Debounce persistence writes so a column resize no longer writes to storage on
every pointer move, and drop restored state that fails a shape check instead of
feeding it to the table. The footer's page-size Select now keeps a current size
that is not in `pageSizeOptions` rather than rendering blank, and headers expose
`aria-sort` alongside `aria-rowcount` / `aria-colcount` / `aria-rowindex` on the
virtualized grid.

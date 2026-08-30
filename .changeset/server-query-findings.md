---
"@jielga/tmdatagrid": minor
---

Server-side ergonomics, from building the server-backed search recipe.

- Under `manualPagination` the grid takes itself back to the first page when the query changes - a column filter, the quick search or the sort - in the same event as the change, so one request goes out. A filter row with an empty value is not a query change. `resetPageOnQueryChange: false` switches it off.
- `activeColumnFilters(columnFilters | table)` returns the filters that narrow anything, with `value` typed as `TMDataGridFilterValue` instead of `unknown`.
- `Controls.PageNumber` renders "Page 3 of 200" for a `renderPagination` layout, with a `pageNumber` label. Not in the default footer.
- `SummaryCount` renders the matched count alone under `manualFiltering` or `manualPagination` without `meta.totalRowCount`. The fallback denominator was the current page, so a server-side grid read "25 / 25".
- The controlled-state sync no longer publishes the table store during the consumer's render, which React reported as "Cannot update a component (…) while rendering a different component (…)" on the first sort or filter of any grid owning a state slice.
- The last column's resize divider no longer hangs 5px past the last track, which put a permanent horizontal scrollbar under a grid whose columns fit.
- A column resolving `meta.options: "faceted"` under `manualFiltering` or `manualPagination` warns once: the distinct values of one page are not the distinct values of the result set.

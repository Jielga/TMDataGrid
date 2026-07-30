---
"@jielga/tmdatagrid": minor
---

Filter panel: a "Filters" header with a close button, Escape and a click outside
to dismiss, and a "Clear all" next to "Add filter", which is now disabled once
every filterable column has a filter.

New `TMDataGrid.FilterPills` (also exported as `TMDataGridFilterPills`) — one
pill per active filter, `First name: Sofia ✕`, with the ✕ clearing that filter
and a click on the label reopening the panel on its column. It takes the grid as
an `api` prop instead of reading context, so it can be rendered outside the
grid. `formatFilterLabel` is exported for building your own.

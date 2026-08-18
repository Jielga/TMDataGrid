---
"@jielga/tmdatagrid": minor
---

**Breaking.** Every render surface is now a `render*` prop over one typed args object, and the chrome slots hand over the pieces of what they replace instead of only the data behind it.

- `TMDataGrid.Footer`'s `pagination` becomes **`renderPagination`**, and its argument becomes `{ state, actions, Controls }`. The flat `TMDataGridPaginationApi` members split across `state` (`pageIndex`, `pageSize`, `pageCount`, `rowCount`, `canPreviousPage`, `canNextPage`, plus the new `isPagingActive`, `from` and `to`) and `actions` (`setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`, `lastPage`). `Controls.PageSize`, `Controls.Range` and `Controls.Pager` are the built-in pieces, so a custom pager keeps the parts it likes rather than rebuilding them. `getTMDataGridPaginationApi(table)` returns the same `{ state, actions }` shape.
- `TMDataGrid.Table`'s `rowContextMenu` becomes **`renderRowContextMenu`**, and the type `TMDataGridRowContextMenu` becomes `TMDataGridRowContextMenuRenderer`. Its args gain `internalItems`: reading it hands the composition over, so the menu is exactly what you return; ignoring it keeps today's behavior, the grid's copy and export items above a divider and yours below.
- `TMDataGrid.Table` gains **`renderColumnMenuItems`**, which receives `{ column, table, internalItems }` and returns the full item list. Returning an empty list leaves the column with no menu button.
- `TMDataGrid.EditActions` gains **`renderActions`**, over `{ state, actions, Controls }` with `state.pendingCount`, `state.isSubmitting` and the built-in `Controls.Save` / `Controls.Discard`.

Migrating: `pagination={(api) => …}` becomes `renderPagination={({ state, actions }) => …}` with `api.pageIndex` reading as `state.pageIndex` and `api.nextPage()` as `actions.nextPage()`; `rowContextMenu={…}` becomes `renderRowContextMenu={…}` with the same arguments.

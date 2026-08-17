---
name: server-side
description: >
  Drive TMDataGrid from a server with TanStack manual modes - manualPagination,
  manualSorting, manualFiltering, rowCount, controlled state and onXChange
  callbacks. Covers the loading and totalRowCount meta fields, forwarding the
  plain-JSON columnFilters model to an API with isFilterActive, persistence
  interaction, and row selection across pages. Load when the grid is backed by a
  paginated API rather than a local array.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.0.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/server-side.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/useTMDataGrid.tsx'
---

# TMDataGrid - Server-side data

The grid reads rows through `getPaginatedRowModel()` and totals through
`getRowCount()` and `getPageCount()`, all of which respect TanStack's manual
modes. A server-driven grid therefore needs only the standard `manual*`
configuration - no grid-specific options. `manualPagination: true` also
switches the grid's pagination flag on, so `TMDataGrid.Footer` renders its
pager without `enablePagination`. Declare `pageCount: -1` when the total is
unknown; the next button then stays enabled.

## Setup

```tsx
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";

const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
const [sorting, setSorting] = useState([]);
const [columnFilters, setColumnFilters] = useState([]);

const { data, isFetching } = useQuery({
  queryKey: ["employees", pagination, sorting, columnFilters],
  queryFn: () => fetchEmployees({ pagination, sorting, columnFilters }),
  placeholderData: keepPreviousData,
});

const grid = useTMDataGrid({
  columns,
  data: data?.rows ?? [],
  getRowId: (row) => String(row.id),

  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  rowCount: data?.total ?? 0,

  state: { pagination, sorting, columnFilters },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,

  meta: { loading: isFetching, totalRowCount: data?.totalUnfiltered },
});
```

## Differences from client-side data

| Concern | Client-side | Server-side |
| --- | --- | --- |
| Rendered rows | The current page, sliced locally | The rows returned by the server |
| Footer total | Pre-paginated row count | `options.rowCount` |
| `SummaryCount` total | Pre-filtered row count | `meta.totalRowCount` |
| Loading state | Not applicable | `meta.loading` |

Column menus, the filter panel and the column manager behave identically in both
modes.

## Sending filters

Filter values are plain JSON, so `columnFilters` forwards without transformation:

```json
[
  { "id": "lastName", "value": { "operator": "contains", "value": "holm" } },
  { "id": "age", "value": { "operator": "greaterThan", "value": "30" } }
]
```

Translate at the API boundary, and skip entries whose value is still empty -
those match all rows:

```ts
import { isFilterActive } from "@jielga/tmdatagrid";

const active = columnFilters.filter((filter) => isFilterActive(filter.value));
```

Debounce requests. The filter value input updates on every keystroke.

## Persistence

`persist` works unchanged. `dataKey` restores filters, sorting and pagination
before the first request, so reloading repeats the query the user last ran.

If the same state is also held in your own `useState`, initialise it from the
same source or let the grid own it. Do not maintain both independently.

## Row selection

Selection is keyed by `getRowId`, so ids must be stable across pages. Under
`manualPagination`, rows selected on an earlier page stay in `rowSelection` even
though they are no longer mounted. Read the state, not the row models:

```ts
import { useSelector } from "@tanstack/react-store";

const selectedIds = useSelector(grid.table.store, (state) =>
  Object.keys(state.rowSelection),
);
```

## Common mistakes

### Omitting rowCount under manualPagination

Without `rowCount` the table derives the total from the rows it was handed -
one page - so `getPageCount()` returns 1. The footer shows "1–25 of 25" and the
next-page button is disabled, with no error. Pass the server total.

### Filters sent without isFilterActive

An empty filter value stays in `columnFilters` while the user is still typing.
Forwarded verbatim it becomes `operator: "contains", value: ""` at the API,
which most backends translate into a real predicate. Filter with
`isFilterActive` first.

### SummaryCount without meta.totalRowCount

`SummaryCount` falls back to the pre-filtered row count, which under manual
filtering is just the current page. It reads "25 of 25" regardless of how many
rows the server holds. Pass the unfiltered total as `meta.totalRowCount`.

### Unstable getRowId across pages

Defaulting to the row index means row 0 of page 2 shares an id with row 0 of
page 1, so paging silently transfers the selection to different records. Always
set `getRowId` from a stable primary key when paginating on the server.

### Duplicating grid state in local state

Holding `pagination` in `useState` *and* letting `persist.dataKey` restore it
gives two sources of truth: the grid restores the stored page while `useState`
starts at 0, and the first query runs for the wrong page. Initialise the local
state from the same store, or drop `pagination` from the persisted slices.

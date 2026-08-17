# Server-side data

When the client holds one page and the server does the work: paging, sorting
and filtering all become round trips, and the grid stops doing them itself.

The grid reads rows through `getPaginatedRowModel()` and totals through
`getRowCount()` and `getPageCount()`, all of which respect TanStack's manual
modes. A server-driven grid therefore requires only the standard `manual*`
configuration - `manualPagination: true` also switches the grid's pagination
flag on, so `TMDataGrid.Footer` renders its pager without `enablePagination`.

When the total is unknown, declare `pageCount: -1`: the next button stays
enabled and the `pagination` render prop receives `pageCount: -1`.

## Usage

```tsx
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

```demo
file: data/ServerSide.tsx
hint: Sorting, searching and paging are all round trips against a server with 500 ms of latency.
extraSources: data/orders.ts
```

## Differences from client-side data

| Concern | Client-side | Server-side |
| --- | --- | --- |
| Rendered rows | The current page, sliced locally | The rows returned by the server |
| Footer total | Pre-paginated row count | `options.rowCount` |
| `SummaryCount` total | Pre-filtered row count | `meta.totalRowCount` |
| Loading state | Not applicable | `meta.loading` |

No additional configuration is required. Column menus, the filter panel and the
column manager behave identically in both modes.

## Sending filters

Filter values are plain JSON:

```json
[
  { "id": "lastName", "value": { "operator": "contains", "value": "holm" } },
  { "id": "age", "value": { "operator": "greaterThan", "value": "30" } },
  { "id": "status", "value": { "operator": "isAnyOf", "value": ["Paid", "Pending"] } },
  { "id": "hired", "value": { "operator": "onOrAfter", "value": "2026-01-01" } }
]
```

Forward `columnFilters` unchanged and translate it at the API boundary. Use
`isFilterActive` to skip entries whose value is still empty, since those match
all rows:

```ts
import { isFilterActive } from "./tmdatagrid";

const active = columnFilters.filter((filter) => isFilterActive(filter.value));
```

Debounce requests. The filter value input updates on every keystroke.

## Persistence

`persist` works unchanged. `dataKey` restores filters, sorting and pagination
before the first request, so reloading the page repeats the query the user last
ran.

If the same state is also held in your own `useState`, initialise it from the
same source or let the grid own it. Do not maintain both independently.

## Row selection

Row selection is keyed by `getRowId`, so ids must be stable across pages. With
`manualPagination`, rows selected on an earlier page remain in `rowSelection`
even though they are no longer mounted. Read the state rather than the row
models:

```ts
const selectedIds = Object.keys(grid.table.store.state.rowSelection);
```

## Infinite scroll

The pager's alternative: keep every fetched row in `data` and let the scroll
ask for more. `onReachEnd` on `TMDataGrid.Table` fires as the scroll nears the
last row - append the next page and the virtualizer keeps its position:

```tsx
const [rows, setRows] = useState<Order[]>([]);

const grid = useTMDataGrid({
  data: rows,
  columns,
  getRowId: (row) => String(row.id),
  meta: { loading: isFetching, totalRowCount: total },
  enableSorting: false,
  enableColumnFilters: false,
});

<TMDataGrid.Table onReachEnd={() => void fetchNextPage()} />
```

```demo
file: data/InfiniteScroll.tsx
hint: Scroll to the bottom and keep going - 100 rows arrive at a time and the scroll position holds.
extraSources: data/orders.ts
height: 460
```

Fetch page zero yourself on mount - `onReachEnd` stays quiet on an empty
grid, since "the end" of nothing is not a scroll position.

`onReachEnd` fires once per row count, so a pending fetch is not asked again
until its rows land; `reachEndThreshold` (default 10) sets how many rows
before the end it fires. `TMDataGrid.LoadingIndicator` in the toolbar is the
natural fetch signal - the body keeps showing the rows it has.

Two rules come with the pattern:

- **Sorting and filtering must be server-side** (`manualSorting` /
  `manualFiltering`) or disabled - the client only holds a prefix of the
  data, so a client-side sort would order a fraction of it and present the
  result as the whole. When a server-side sort or filter changes, reset the
  accumulated rows and start from page zero.
- **Not compatible with `enablePagination`** - the pager slices the same
  scroll the callback watches, so the end it reaches is the page's. The grid
  warns once if both are set.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `manualPagination` | Table option | `boolean` | `false` | The server pages. Implies `enablePagination`. |
| `manualSorting` | Table option | `boolean` | `false` | The server sorts. |
| `manualFiltering` | Table option | `boolean` | `false` | The server filters, column filters and quick search alike. |
| `manualGrouping` | Table option | `boolean` | `false` | The rows arrive grouped. See [Grouping](/docs/grouping#server-side-grids). |
| `rowCount` | Table option | `number` | – | The true total. `pageCount: -1` when it is unknown. |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. See [Loading and empty](/docs/loading-and-empty). |
| `meta.totalRowCount` | Option | `number` | – | The unfiltered total, for `SummaryCount`. |
| `onReachEnd` | Table prop | `() => void` | – | Fires as the scroll nears the last row. Latches per row count. |
| `reachEndThreshold` | Table prop | `number` | `10` | How many rows before the end it fires. |
| `isFilterActive` | Export | `(value) => boolean` | – | Skip filter entries whose value is still empty. |

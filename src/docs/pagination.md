# Pagination

**Off by default.** The grid renders every filtered and sorted row and relies
on [virtualization](/docs/scrolling), which handles any row count — so paging
is a choice about how the reader navigates, not a performance workaround.

There are three modes.

**No pagination** — the default. `TMDataGrid.Footer` renders nothing.

```tsx
const grid = useTMDataGrid({ data, columns });
```

**Client pagination** — the table pages the data itself, and the Footer renders
its pager. Initial page size is 25, configurable through
`initialState.pagination`.

```tsx
const grid = useTMDataGrid({ data, columns, enablePagination: true });
```

**Manual pagination** — the server pages, and the grid stops.
`manualPagination: true` implies `enablePagination`, so no extra flag is
needed. See [Server-side data](/docs/server-side).

```tsx
const grid = useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  rowCount: page.total,
  state: { pagination },
  onPaginationChange: setPagination,
});
```

```demo
file: data/Pagination.tsx
extraSources: data/employeeColumns.tsx
```

`enablePagination` is one of the two switches the grid defines itself —
TanStack ships the state and the APIs but no `enable` option — and it is the
one switch that defaults to **off**.

## Replacing the pager

`TMDataGrid.Footer` takes a `pagination` render prop, handed the same API the
built-in pager is built on:

```tsx
<TMDataGrid.Footer
  pagination={(api) => (
    <Group>
      <Button onClick={api.previousPage} disabled={!api.canPreviousPage}>
        Back
      </Button>
      <Text>
        {api.pageIndex + 1} / {api.pageCount}
      </Text>
      <Button onClick={api.nextPage} disabled={!api.canNextPage}>
        Next
      </Button>
    </Group>
  )}
/>
```

`getTMDataGridPaginationApi(table)` returns the same object outside the Footer,
for a pager that lives somewhere else on the page entirely.

## Grouping suspends it

**Grouping and the built-in pager do not work together, and grouping wins.**
The pager greys itself out and the range is replaced with `Grouped · all N
rows`. The reasoning — and what to do if you need both — is on
[Grouping](/docs/grouping#grouping-suspends-pagination).

A custom pager can grey itself out the same way:

```tsx
import { isPagingActive } from "@jielga/tmdatagrid";

<TMDataGrid.Footer
  pagination={(api) => (
    <MyPager {...api} disabled={!isPagingActive(table, features)} />
  )}
/>
```

`isPagingActive` is live state — whether the pager is currently slicing
anything. `getGridCapabilities(...).canPaginate` is the *configuration*: whether
paging is switched on at all. The two differ exactly while a grouping is
active.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enablePagination` | Option | `boolean` | `false` | Client-side paging and the Footer's pager. Grid-defined. |
| `manualPagination` | Table option | `boolean` | `false` | The server pages. Implies `enablePagination`. |
| `rowCount` | Table option | `number` | – | The true total, required under `manualPagination`. |
| `initialState.pagination` | Table option | `{ pageIndex, pageSize }` | `{ 0, 25 }` | Where paging starts. A data slice, so it persists. |
| `onPaginationChange` | Table option | `OnChangeFn` | – | Controls the pagination state. |
| `TMDataGrid.Footer` | Component | – | – | The footer bar. Renders nothing when paging is off. |
| `Footer` `pagination` | Render prop | `(api) => ReactNode` | Built-in pager | Replaces the pager. |
| `getTMDataGridPaginationApi` | Export | `(table) => TMDataGridPaginationApi` | – | The pager API, outside the Footer. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything right now. |

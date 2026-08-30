# Pagination

**Off by default.** The grid renders every filtered and sorted row and relies
on [virtualization](/docs/scrolling), which handles any row count. Turn paging
on when users should move through the data a page at a time, not to keep a
large grid responsive.

There are three modes.

**No pagination** - the default. `TMDataGrid.Footer` renders nothing.

```tsx
const grid = useTMDataGrid({ data, columns });
```

**Client pagination** - the table pages the data itself, and the Footer renders
its pager. Initial page size is 25, configurable through
`initialState.pagination`.

```tsx
const grid = useTMDataGrid({ data, columns, enablePagination: true });
```

**Manual pagination** - the server pages, and the grid stops.
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

`enablePagination` is defined by the grid rather than by TanStack, which ships
the pagination state and APIs but no `enable` option.

## Replacing the pager

`TMDataGrid.Footer` takes a `renderPagination` slot, handed three things: the
`state` the pager is showing, the `actions` it can take, and `Controls` - the
built-in pieces, already wired.

```tsx
<TMDataGrid.Footer
  renderPagination={({ state, actions, Controls }) => (
    <Group>
      <Controls.PageSize />
      <Button onClick={actions.previousPage} disabled={!state.canPreviousPage}>
        Back
      </Button>
      <Text>
        {state.pageIndex + 1} / {state.pageCount}
      </Text>
      <Button onClick={actions.nextPage} disabled={!state.canNextPage}>
        Next
      </Button>
    </Group>
  )}
/>
```

The default footer renders `PageSize`, `Range` and `Pager`, in that order. A
control kept from `Controls` behaves as it does in the default footer, including
greying out while a grouping suspends paging.

| Member | Renders |
| --- | --- |
| `Controls.PageSize` | "Rows per page" and its select |
| `Controls.Range` | The "1–25 of 300" label |
| `Controls.PageNumber` | The "Page 3 of 200" label |
| `Controls.Pager` | The previous and next buttons |

`PageNumber` is not in the default footer.
It is the label a server-paged grid usually shows in place of a row range, so it is put in through the slot:

```tsx
<TMDataGrid.Footer
  renderPagination={({ Controls }) => (
    <>
      <Controls.PageSize />
      <Controls.PageNumber />
      <Controls.Pager />
    </>
  )}
/>
```

It reads `pageCount`, so a grid declaring `pageCount: -1` shows "Page 3" alone.

`state` carries `pageIndex`, `pageSize`, `pageCount`, `rowCount`,
`canPreviousPage`, `canNextPage`, the `from` / `to` bounds of the current page,
and `isPagingActive`. `actions` carries `setPageIndex`, `setPageSize`,
`previousPage`, `nextPage`, `firstPage` and `lastPage`.

`getTMDataGridPaginationApi(table)` returns the same `{ state, actions }`
outside the Footer, for a pager that lives elsewhere on the page. `Controls` is
not included: those components are bound to the grid's context and work only
inside the slot.

## Grouping

While a column is grouped the pager greys itself out and the range is replaced
with `Grouped · all N rows`. See
[Grouping](/docs/grouping#grouping-and-pagination).

A custom pager can grey itself out the same way:

```tsx
<TMDataGrid.Footer
  renderPagination={({ state, actions }) => (
    <MyPager {...state} {...actions} disabled={!state.isPagingActive} />
  )}
/>
```

`isPagingActive` is live state: whether the pager is currently slicing
anything. `getGridCapabilities(...).canPaginate` is configuration: whether
paging is switched on at all. The two differ while a grouping is active.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enablePagination` | Option | `boolean` | `false` | Client-side paging and the Footer's pager. Grid-defined. |
| `manualPagination` | Table option | `boolean` | `false` | The server pages. Implies `enablePagination`. |
| `rowCount` | Table option | `number` | – | The true total, required under `manualPagination`. |
| `initialState.pagination` | Table option | `{ pageIndex, pageSize }` | `{ 0, 25 }` | Where paging starts. A data slice, so it persists. |
| `onPaginationChange` | Table option | `OnChangeFn` | – | Controls the pagination state. |
| `TMDataGrid.Footer` | Component | – | – | The footer bar. Renders nothing when paging is off. |
| `Footer` `renderPagination` | Slot | `({ state, actions, Controls }) => ReactNode` | Built-in pager | Replaces the pager, and hands over its pieces. |
| `getTMDataGridPaginationApi` | Export | `(table) => { state, actions }` | – | The pager API, outside the Footer. |
| `TMDataGridPaginationState` · `TMDataGridPaginationActions` · `TMDataGridPaginationControls` | Exports | types | – | The three parts of the slot's argument. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything right now. |

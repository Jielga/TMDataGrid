---
name: data
description: >
  How a TMDataGrid presents the rows it has: pagination, virtualization, and
  having nothing to show. Covers the three pagination modes (off,
  enablePagination, manualPagination), the Footer's renderPagination slot over {
  state, actions, Controls }, getTMDataGridPaginationApi, isPagingActive versus
  canPaginate, always-on virtualization with overscan and meta.rowHeight,
  scrollToRow, the edge callbacks onScrollToBottom / onScrollToRight and why
  onReachEnd is better for loading more, the header and pinned-lane depth
  shadows, and the four empty states in precedence order with meta.loading,
  renderEmptyState, hasActiveFilters, TMDataGrid.LoadingIndicator and
  TMDataGrid.SummaryCount. Load when adding a pager, tuning scrolling, scrolling
  to a row, or deciding what an empty grid should say.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.0.0-beta.11'
sources:
  - 'Jielga/TMDataGrid:src/docs/pagination.md'
  - 'Jielga/TMDataGrid:src/docs/scrolling.md'
  - 'Jielga/TMDataGrid:src/docs/loading-and-empty.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/components/TMDataGridFooter.tsx'
---

# TMDataGrid - Pagination, scrolling and empty states

## Pagination

**Off by default.** The grid renders every filtered and sorted row and relies on
virtualization, which handles any row count. Paging is not needed for
performance. Three modes:

```tsx
// 1. None (default). TMDataGrid.Footer renders nothing.
const grid = useTMDataGrid({ data, columns });

// 2. Client. The table pages, the Footer renders its pager.
const grid = useTMDataGrid({ data, columns, enablePagination: true });

// 3. Manual. The server pages; manualPagination implies enablePagination.
const grid = useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  rowCount: page.total,
  state: { pagination },
  onPaginationChange: setPagination,
});
```

Initial page size is 25, through `initialState.pagination`. `enablePagination`
is defined by the grid rather than by TanStack, and is the only grid option that
defaults to off.

`TMDataGrid.Footer` takes a `renderPagination` slot handed three things: the
`state` the pager shows, the `actions` it can take, and `Controls`, the built-in
pieces, already wired.

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
      <Controls.Pager />
    </Group>
  )}
/>
```

`Controls.PageSize`, `Controls.Range` and `Controls.Pager` are what the default
footer renders, in that order, so a custom layout can keep the parts it wants
instead of rebuilding them. They behave exactly as before, including greying out
under a suspended pager.

`state` carries `pageIndex`, `pageSize`, `pageCount`, `rowCount`,
`canPreviousPage`, `canNextPage`, `from`, `to` and `isPagingActive`. `actions`
carries `setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`
and `lastPage`. `getTMDataGridPaginationApi(table)` returns the same
`{ state, actions }` outside the Footer. `Controls` is bound to the grid
context, so those components work only inside the slot.

Grouping suspends the pager: it greys out and the range becomes
`Grouped · all N rows`. `isPagingActive(table, features)` is the live state,
whether the pager is slicing anything right now, while
`getGridCapabilities(...).canPaginate` is the configuration. The two differ
while a grouping is active.

## Scrolling

Virtualization is **always on**. There is no flag and no threshold: only the
rows within the viewport plus a small overscan are mounted.

`overscan` (default `6`) is the only setting: raise it if a fast scroll flashes
blank rows, lower it when rows are expensive. Row height comes from
`meta.rowHeight`, or from `size` when that is not set, and rows are **fixed
height**, so the virtualizer's estimate is exact and the scrollbar does not
drift. Row details are the exception: a row showing a panel is measured after it
mounts.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  overscan: 12,
  meta: { rowHeight: 64 },
});

grid.scrollToRow({ rowId: "42", align: "center" });
```

`scrollToRow` exists because the target row may not be mounted, and
`element.scrollIntoView()` cannot find an element that is not rendered. `align`
is `"start"`, `"center"`, `"end"` or `"auto"`. It answers whether the row could
be reached: `false` when it is filtered out, on another page or an id matching
no row, and a pinned row answers `true` without scrolling.

The hook reaches the virtualizer through `scrollerRef`, which
`TMDataGrid.Table` fills in. That is internal wiring, not an API - spread the
whole grid object onto `<TMDataGrid>` or nothing scrolls.

`TMDataGrid.Table` reports arrivals at each edge - `onScrollToTop`,
`onScrollToBottom`, `onScrollToLeft`, `onScrollToRight` - firing **once** on
arrival rather than on every scroll event. For loading more rows use
`onReachEnd` (the `server-side` skill) instead: it fires a number of rows before
the bottom, and latches per row count so a pending fetch is not requested twice.

Two depth cues are scroll-driven animations run on the compositor, with no
scroll listener and no React render: a shadow under the sticky header once rows
scroll beneath it, and a band beside a pinned lane while it is covering
content.

## Empty states

There are four ways to have nothing to show, and an empty body shows exactly one
of them, in this order:

1. **Loading** - `meta.loading` is true: a centred loader. A grid that is
   fetching never reports itself as empty.
2. **Entry rows** - an open entry row from `edit.addRow()`: the entry block
   only, with no message beside the form.
3. **`renderEmptyState`** - your node, centred where the message would be.
4. **Filtered-empty** - a filter or search is active: `labels.noResults`, since
   clearing the filter will bring rows back.
5. **Truly-empty** - no data at all: `labels.noRows`.

`renderEmptyState` replaces the last two with one render prop, and
`hasActiveFilters` says which it is standing in for:

```tsx
<TMDataGrid.Table<Employee>
  renderEmptyState={({ hasActiveFilters, table }) =>
    hasActiveFilters ? (
      <Button variant="light" onClick={() => table.resetColumnFilters()}>
        Clear filters
      </Button>
    ) : (
      <Button onClick={openCreateModal}>Add the first employee</Button>
    )
  }
/>
```

An empty grid is a good place to offer the action that fills it, such as
clearing the filters or creating the first record.

The body's loading state only appears while the grid is **empty**. A
server-driven grid refetching with rows still on screen keeps showing them.
`TMDataGrid.LoadingIndicator` covers that case: a small spinner while
`meta.loading` is true. `TMDataGrid.SummaryCount` shows visible rows out of
total, where the total is `meta.totalRowCount` when provided and the pre-filtered
count otherwise.

## Common mistakes

### CRITICAL Turning pagination on to make a large grid fast

Virtualization is already unconditional, so paging a 200 000-row grid changes
nothing about rendering cost. It only changes how users navigate. Enable it when
they should move page by page, not for performance.

Source: `src/docs/pagination.md`, `src/docs/scrolling.md`.

### CRITICAL A variable row height

The virtualizer needs one number, and rows are fixed height so the scrollbar
stays accurate. Styling a taller row through CSS leaves the measurement and the
render disagreeing: rows overlap or gaps open as you scroll, and the effect
depends on scroll position, so it appears intermittent.

Wrong:

```css
[data-dg-part="row"] { height: 64px; }
```

Correct:

```tsx
useTMDataGrid({ data, columns, meta: { rowHeight: 64 } });
```

Source: `src/docs/scrolling.md` (Row height).

### HIGH `scrollIntoView` on a row that is not mounted

Only the viewport's rows exist in the DOM, so a query for row 4 000 returns
nothing and the call silently does nothing.

Correct:

```tsx
grid.scrollToRow({ rowId: "4000", align: "center" });
```

`scrollToRow` returns `false` when the row is not in the current view (filtered
out, on another page, or an id matching no row) and nothing scrolled.

Source: `src/docs/scrolling.md` (Scrolling to a row).

### HIGH Loading more rows from `onScrollToBottom`

It fires at the very bottom, so the user waits at the end of the list for the
fetch. `onReachEnd` fires a number of rows earlier and latches per row count, so
a pending fetch is not requested twice.

Source: `src/docs/scrolling.md` (Edge callbacks).

### HIGH `SummaryCount` reporting the page under manual pagination

The client only holds one page, so without `meta.totalRowCount` the total is
whatever arrived. It shows "25 of 25" over a table of thousands.

Correct:

```tsx
useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  rowCount: page.total,
  meta: { totalRowCount: page.total },
});
```

Source: `src/docs/loading-and-empty.md` (Counting what is there).

### MEDIUM Rendering an empty message while data is loading

The order exists so a fetching grid never reports itself as empty. A hand-rolled
`data.length === 0 ? <Empty /> : <Grid />` outside the grid flashes "No rows to
show" on every load.

Correct:

```tsx
useTMDataGrid({ data, columns, meta: { loading: isFetching } });
```

Source: `src/docs/loading-and-empty.md` (What wins).

### MEDIUM Trusting the pager while grouped

`getPageCount()` still returns a number, but the pager is greyed out and the
grid is rendering the whole tree. A custom pager must read
`isPagingActive(table, features)` rather than the page count.

Source: `src/docs/pagination.md` (Grouping suspends it).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enablePagination` | Option | `boolean` | `false` | Client-side paging and the Footer's pager. Grid-defined. |
| `manualPagination` | Table option | `boolean` | `false` | The server pages. Implies `enablePagination`. |
| `rowCount` | Table option | `number` | – | The true total, required under `manualPagination`. |
| `initialState.pagination` | Table option | `{ pageIndex, pageSize }` | `{ 0, 25 }` | Where paging starts. A `data` slice, so it persists. |
| `onPaginationChange` | Table option | `OnChangeFn` | – | Controls the pagination state. |
| `TMDataGrid.Footer` | Component | `pageSizeOptions`, `pagination` | `[10, 25, 50, 100]` | The footer bar. Renders nothing when paging is off. |
| `Footer` `renderPagination` | Slot | `({ state, actions, Controls }) => ReactNode` | Built-in pager | Replaces the pager, and hands over its pieces. |
| `getTMDataGridPaginationApi` | Export | `(table) => { state, actions }` | – | The pager API, outside the Footer. |
| `TMDataGridPaginationState` · `TMDataGridPaginationActions` · `TMDataGridPaginationControls` | Exports | types | – | The three parts of the slot argument. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything right now. |
| `overscan` | Option | `number` | `6` | Rows kept mounted beyond each edge of the viewport. |
| `meta.rowHeight` | Option | `number` | From `size` | Row height in pixels. The virtualizer needs a number. |
| `scrollToRow` | Hook return | `({ rowId, align? }) => boolean` | `align: "auto"` | Scrolls a row into view, mounted or not. |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | Table props | `() => void` | – | Fire once on arriving at that edge. |
| `TMDataGridScrollAlign` | Export | `"start" \| "center" \| "end" \| "auto"` | – | The `align` argument. |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. Takes precedence over every empty message. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | The filtered-empty message, without a render prop. |
| `meta.totalRowCount` | Option | `number` | Pre-filtered count | The total `SummaryCount` reports. |
| `renderEmptyState` | Table prop | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. |
| `TMDataGrid.LoadingIndicator` | Component | – | – | Spinner while `meta.loading`, for when the body has rows. |
| `TMDataGrid.SummaryCount` | Component | `children` replaces the text | – | Visible rows out of total. |
| `--dg-header-shadow-color` | CSS variable | colour | Themed | The shadow under the sticky header. |
| `--dg-sticky-edge-range` | CSS variable | length | `20px` | How far the pinned-lane band takes to fade in. |

See also: the `server-side` skill for `manualPagination` and `onReachEnd`, and
the `grouping` skill for why the pager suspends.

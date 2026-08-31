# Grid anatomy

A grid is a tree of components inside the `TMDataGrid` wrapper. Parts are
opt-in: a grid containing only `<TMDataGrid.Table />` has no toolbar, footer or
search. Add the built-in parts you need, configure them, or add components of
your own.

`useTMDataGrid` returns the props `TMDataGrid` takes:

```tsx
const grid = useTMDataGrid({ data, columns });

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }} size="xs">
  <TMDataGrid.Toolbar>
    <TMDataGrid.Search />
    <TMDataGrid.Spacer />
    <TMDataGrid.FilterButton />
    <TMDataGrid.Menu>
      <TMDataGrid.Menu.Columns />
    </TMDataGrid.Menu>
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
  <TMDataGrid.Footer />
</TMDataGrid>
```

## `TMDataGrid` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `table` | `TMDataGridTable<TData>` | – | From `useTMDataGrid`. |
| `ui` | `TMDataGridUiStore` | – | From `useTMDataGrid`. |
| `features` | `TMDataGridFeatureFlags` | – | From `useTMDataGrid`. |
| `size` | `MantineSize` | `"md"` | The [size scale](/docs/styling#the-size-scale). |
| `children` | `ReactNode` | – | The grid's parts, in render order. |
| `className` · `style` · `id` | – | – | On the root element. Set a bounded height - see [Layout](/docs/styling#layout). |
| `data-testid` | `string` | – | Names the grid for [tests](/docs/testing). Set it when a page holds more than one grid. |

## The parts

Every component below reads the grid from context and must be rendered inside
`TMDataGrid`.

| Component                                       | What it is                                                                   | Documented on                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TMDataGrid.Table`                              | The scrollable surface: header, virtualized body, filter panel               | This page                                             |
| `TMDataGrid.Toolbar`                            | A flex row above the grid                                                    | [Toolbar](/docs/toolbar)                              |
| `TMDataGrid.Footer`                             | The pager bar below it                                                       | [Pagination](/docs/pagination)                        |
| `TMDataGrid.Search`                             | Quick search input                                                           | [Quick search](/docs/quick-search)                    |
| `TMDataGrid.FilterButton` · `.FilterPanel`      | The filter UI                                                                | [Filtering](/docs/filtering)                          |
| `TMDataGrid.FilterPills`                        | Active filters as pills                                                      | [Filtering](/docs/filtering#tmdatagridfilterpills) |
| `TMDataGrid.Menu` · `.ColumnsPanel`             | The burger menu, and the column chooser                                      | [Grid menu](/docs/menu)                               |
| `TMDataGrid.Spacer`                             | Pushes following toolbar items right                                         | [Toolbar](/docs/toolbar)                              |
| `TMDataGrid.LoadingIndicator` · `.SummaryCount` | Fetch spinner, and the row count                                             | [Loading and empty](/docs/loading-and-empty)          |
| `TMDataGrid.DraftActions`                        | Save and Discard for pending edits. Also exported as `TMDataGridDraftActions` | [Editing](/docs/editing#the-draft-store)                |

`FilterPills` is the exception: it takes the grid as an `api` prop and can be
rendered outside `TMDataGrid`, since an active-filter strip often sits above
the grid it describes.

## `TMDataGrid.Table`

The scrollable surface.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onRowClick` | `(row) => void` | – | Called when a body row is clicked. See [Row interaction](/docs/row-interaction). |
| `onCellClick` · `onCellDoubleClick` · `onCellContextMenu` | `(args) => void` | – | Cell click, double-click and right-click. Receive `{ cell, row, column, event }`. See [Row interaction](/docs/row-interaction). |
| `renderRowContextMenu` | `({ table, row, cell, close, internalItems }) => ReactNode` | – | Contents of the row's context menu. See [Context menus](/docs/row-interaction#context-menus). |
| `rowContextMenuProps` | `MenuProps` | – | Passed to the Mantine `Menu` behind the context menu. |
| `renderColumnMenuItems` | `({ column, table, internalItems }) => ReactNode[]` | – | Contents of a column's menu. See [Column layout](/docs/column-layout#the-column-menu). |
| `rowClassName` | `string \| (row) => string` | – | Class for a body row. See [Row styling](/docs/row-styling). |
| `rowStyle` | `TMDataGridRowStyle \| (row) => TMDataGridRowStyle` | – | Inline style for a body row. See [Row styling](/docs/row-styling). |
| `striped` | `boolean` | `false` | Every second row takes `--dg-row-striped-bg`. See [Row styling](/docs/row-styling#striping). |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | `() => void` | – | Fire once on arriving at that edge. See [Scrolling](/docs/scrolling#edge-callbacks). |
| `onReachEnd` | `() => void` | – | Fires as the scroll nears the last row. See [Infinite scroll](/docs/server-side#infinite-scroll). |
| `reachEndThreshold` | `number` | `10` | Rows before the end at which `onReachEnd` fires. |
| `renderEmptyState` | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both empty messages. See [Loading and empty](/docs/loading-and-empty). |
| `cellExport` | `TMDataGridCellExportOptions` | Nordic Excel | Separator, decimal mark, headers, file name. See [Cell selection](/docs/cell-selection#the-csv). |
| `aria-label` · `aria-labelledby` | `string` | – | The grid's accessible name; see below. |

Pass the row type so the handlers are typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

`aria-label` is the accessible name: what a screen reader announces on entry,
and what `getByRole("grid", { name })` matches. Set it on any page holding more
than one grid.

### Which rows it renders

With pagination off (the default) rows come from
`getPrePaginatedRowModel()`: every filtered and sorted row, virtualized. With
pagination on they come from `getPaginatedRowModel()`, so a
[`manualPagination`](/docs/server-side) grid renders exactly the page the server
returned.

## What the hook returns

| Field                                                   | What it is                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `table`                                                 | The TanStack table instance. State lives in `table.store`.                                      |
| `ui`                                                    | The grid's own UI store - panels, drag state, focused cell, cell range.                         |
| `edit`                                                  | The [editing engine](/docs/editing#the-engine-edit). Inert until `editing` is set.              |
| `features`                                              | Feature flags, re-derived each render. See [Toolbar](/docs/toolbar#reading-options-reactively). |
| `labels`                                                | The resolved [dictionary](/docs/localization).                                                  |
| `resetSettings`                                         | [Clears the layout](/docs/column-layout#reset-the-layout).                                      |
| `scrollToRow`                                           | [Scrolling](/docs/scrolling#scrolling-to-a-row).                                                |
| `renderDetails` · `renderDetailsEstHeight` · `overscan` | Passed through to the Table.                                                                    |

Read state through TanStack Store's
[`useSelector(table.store, …)`](https://tanstack.com/store/latest/docs/framework/react/reference)
rather than calling methods on `table`. The table identity is stable across
renders, so the React Compiler caches a bare method call and the component
stops updating.

## Reference

| Name                                                                                 | Kind      | Type                           | Default | What it does                                         |
| ------------------------------------------------------------------------------------ | --------- | ------------------------------ | ------- | ---------------------------------------------------- |
| `useTMDataGrid`                                                                      | Hook      | `(options) => TMDataGridApi`   | –       | Creates the grid's table, UI state and edit engine.  |
| `TMDataGrid`                                                                         | Component | –                              | –       | The root element. Provides the grid through context. |
| `TMDataGrid.Table`                                                                   | Component | –                              | –       | Header, virtualized body and filter panel.           |
| `data-testid`                                                                        | Prop      | `string`                       | –       | Names the grid for tests.                            |
| `aria-label` · `aria-labelledby`                                                     | Props     | `string`                       | –       | The grid's accessible name.                          |
| `useTMDataGridContext`                                                               | Hook      | `() => TMDataGridContextValue` | –       | The grid, from inside any child.                     |
| `TMDataGridApi` · `TMDataGridTable` · `TMDataGridUiStore` · `TMDataGridFeatureFlags` | Exports   | types                          | –       | The hook's result and its parts.                     |

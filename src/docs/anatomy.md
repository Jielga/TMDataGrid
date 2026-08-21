# Grid anatomy

A grid is a hook and a tree of components. The hook holds the state; the
components read it from context and render only what you include.

```tsx
const grid = useTMDataGrid({ data, columns });

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.Search />
    <TMDataGrid.Spacer />
    <TMDataGrid.FilterButton />
    <TMDataGrid.ColumnsButton />
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
  <TMDataGrid.Footer />
</TMDataGrid>
```

**Only the parts you render exist.** There is nothing to switch off: a grid
containing only `<TMDataGrid.Table />` has no toolbar, footer or search.

## Spreading the hook

```tsx
<TMDataGrid {...grid} size="sm">
```

The spread passes `table`, `ui`, `features` and the rest in one go. Passing
them individually works, but spreading is the supported form.

| Prop | Type | Description |
| --- | --- | --- |
| `table` | `TMDataGridTable<TData>` | From `useTMDataGrid`. |
| `ui` | `TMDataGridUiStore` | From `useTMDataGrid`. |
| `features` | `TMDataGridFeatureFlags` | From `useTMDataGrid`. |
| `size` | `MantineSize` | The [size scale](/docs/styling#the-size-scale). Defaults to `"md"`. |
| `children` | `ReactNode` | The grid's parts, in the order you want them. |
| `className` · `style` · `id` | – | On the root element. Set a bounded height - see [Layout](/docs/styling#layout). |
| `data-testid` | `string` | Names the grid for [tests](/docs/testing). Set it when a page holds more than one grid. |

## The parts

Every component below reads the grid from context and must be rendered inside
`TMDataGrid`.

| Component | What it is | Documented on |
| --- | --- | --- |
| `TMDataGrid.Table` | The scrollable surface: header, virtualized body, filter panel | This page |
| `TMDataGrid.Toolbar` | A flex row above the grid | [Toolbar](/docs/toolbar) |
| `TMDataGrid.Footer` | The pager bar below it | [Pagination](/docs/pagination) |
| `TMDataGrid.Search` | Quick search input | [Quick search](/docs/quick-search) |
| `TMDataGrid.FilterButton` · `.FilterPanel` | The filter UI | [Filtering](/docs/filtering) |
| `TMDataGrid.FilterPills` | Active filters as pills - **takes the grid as an `api` prop**, so it can live anywhere on the page | [Filtering](/docs/filtering#filters-outside-the-grid) |
| `TMDataGrid.ColumnsButton` · `.ColumnsPanel` | Manage columns, and Reset layout | [Column layout](/docs/column-layout#hiding) |
| `TMDataGrid.Spacer` | Pushes following toolbar items right | [Toolbar](/docs/toolbar) |
| `TMDataGrid.LoadingIndicator` · `.SummaryCount` | Fetch spinner, and the row count | [Loading and empty](/docs/loading-and-empty) |
| `TMDataGrid.EditActions` | Save and Discard for pending edits. Also exported as `TMDataGridEditActions` | [Editing](/docs/editing#batch-editing) |

`FilterPills` is the exception to the context rule: an active-filter strip
often belongs in a page header, outside the grid it describes.

## `TMDataGrid.Table`

The scrollable surface. Its props are grouped by concern, and each group is
documented with the feature it belongs to.

| Props | Concern |
| --- | --- |
| `onRowClick` · `onCellClick` · `onCellDoubleClick` · `onCellContextMenu` · `renderRowContextMenu` · `rowContextMenuProps` · `renderColumnMenuItems` | [Clicks and context menus](/docs/row-interaction) |
| `rowClassName` · `rowStyle` · `striped` | [Row styling](/docs/row-styling) |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | [Scrolling](/docs/scrolling#edge-callbacks) |
| `onReachEnd` · `reachEndThreshold` | [Server-side data](/docs/server-side#infinite-scroll) |
| `renderEmptyState` | [Loading and empty](/docs/loading-and-empty) |
| `cellExport` | [Cell selection](/docs/cell-selection#the-csv) |
| `aria-label` · `aria-labelledby` | Below |

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

| Field | What it is |
| --- | --- |
| `table` | The TanStack table instance. State lives in `table.store`. |
| `ui` | The grid's own UI store - panels, drag state, focused cell, cell range. |
| `edit` | The [editing engine](/docs/editing#the-engine-edit). Inert until `editMode` is set. |
| `features` | Feature flags, re-derived each render. See [why](/docs/toolbar#why-features-is-a-second-argument). |
| `labels` | The resolved [dictionary](/docs/localization). |
| `resetSettings` | [Clears the layout](/docs/column-layout#putting-it-back). |
| `scrollToRow` · `scrollerRef` | [Scrolling](/docs/scrolling#scrolling-to-a-row). |
| `renderDetails` · `renderDetailsEstHeight` · `overscan` | Passed through to the Table. |

Read state through `useSelector(table.store, …)` rather than calling methods on
`table` - the instance identity is stable across renders, so the React Compiler
will cache a bare method call and your component will stop updating.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `useTMDataGrid` | Hook | `(options) => TMDataGridApi` | – | Builds the grid. Every option is on its feature's page. |
| `TMDataGrid` | Component | – | – | The root. Provides context; takes the hook's result spread. |
| `TMDataGrid.Table` | Component | – | – | Header, virtualized body and filter panel. |
| `data-testid` | Prop | `string` | – | Names the grid for tests. |
| `aria-label` · `aria-labelledby` | Props | `string` | – | The grid's accessible name. |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | The grid, from inside any child. |
| `TMDataGridApi` · `TMDataGridTable` · `TMDataGridUiStore` · `TMDataGridFeatureFlags` | Exports | types | – | The hook's result and its parts. |

# Components

Every component below reads the grid from context and must be rendered inside
`TMDataGrid`. Their order and presence are up to you: the root is a plain flex
column.

`TMDataGrid.FilterPills` is the one exception — it takes the grid as an `api`
prop, so it can be rendered anywhere on the page.

## TMDataGrid

Root component. Provides `{ table, ui, features }` to its children.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `table` | `TMDataGridTable<TData>` | – | From `useTMDataGrid`. |
| `ui` | `TMDataGridUiStore` | – | From `useTMDataGrid`. |
| `features` | `TMDataGridFeatureFlags` | – | From `useTMDataGrid`. |
| `size` | `MantineSize` | `"md"` | Size scale, see below. |
| `children` | `ReactNode` | – | Grid components. |
| `className` | `string` | – | Added to the root element class. |
| `style` | `CSSProperties` + `--*` variables | – | Root element styles. Set a bounded height. |

Spread the hook result rather than assigning the first three props individually:

```tsx
<TMDataGrid {...grid} size="sm" style={{ flex: 1, minHeight: 0 }}>
```

### CSS variables

`style` accepts custom properties, which is how the grid's own values are
themed. They can equally be set from a stylesheet through `className`.

| Variable | Default | Applies to |
| --- | --- | --- |
| `--dg-row-selected-bg` | `--mantine-primary-color-light` | Background of a highlighted row, see [Features](#features) |
| `--dg-row-height` | From `size` | Row height. `meta.rowHeight` is the supported way to change it, since the virtualizer needs the number |
| `--dg-header-height` | From `size` | Header row height |
| `--dg-font-size` | From `size` | Cell and header font size |
| `--dg-padding` | From `size` | Horizontal cell padding. The generated checkbox column is exempt — it is a fixed 48px track, so it centres its box instead |

```tsx
<TMDataGrid
  {...grid}
  style={{ flex: 1, minHeight: 0, "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
>
```

### size

Standard Mantine size scale. It controls row height, header height, font size
and cell padding, and selects the size of the Mantine controls rendered by the
grid, including the page size select, the filter inputs and the column
checkboxes.

| `size` | Row height | Header height | Font size | Cell padding |
| --- | --- | --- | --- | --- |
| `xs` | 34px | 32px | `xs` | 6px |
| `sm` | 42px | 38px | `sm` | 8px |
| `md` | 52px | 44px | `sm` | 10px |
| `lg` | 62px | 52px | `md` | 14px |
| `xl` | 72px | 60px | `lg` | 18px |

Row height is also required by the virtualizer as a number, so it cannot be
defined in CSS alone. `SIZE_ROW_HEIGHT` is the exported source of these values
and the stylesheet mirrors them. Set `meta.rowHeight` to use a height outside
the scale.

## TMDataGrid.Table

The scrollable grid surface: header row, virtualized body and filter panel.

| Prop | Type | Description |
| --- | --- | --- |
| `onRowClick` | `(row: Row<TMDataGridFeatures, TData>) => void` | Row click handler. Rows show a pointer cursor when set. Under `rowSelectionMode: "row"` it runs in addition to the selection. |

Pass the row type to keep `onRowClick` typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

With pagination off (the default) rows come from `getPrePaginatedRowModel()`:
every filtered and sorted row, virtualized. With pagination on they come from
`getPaginatedRowModel()`, so a table using `manualPagination` renders exactly
the page returned by the server.

## TMDataGrid.Footer

Pagination controls: rows per page, current range and previous/next buttons.
Renders nothing unless pagination is enabled (`enablePagination: true` or
`manualPagination: true`) — the footer is a pager; other footer content belongs
in your own layout.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pageSizeOptions` | `readonly number[]` | `[10, 25, 50, 100]` | Available page sizes. |
| `pagination` | `(api: TMDataGridPaginationApi) => ReactNode` | – | Replaces the built-in pager. |

Totals are read from `table.getRowCount()`, which prefers `options.rowCount`.
Server-paginated tables therefore display the server total without further
configuration.

The `pagination` render prop receives the distilled pagination API — state
values plus plain-number setters — and renders inside the footer bar:

```tsx
<TMDataGrid.Footer
  pagination={(api) => (
    <Pagination
      total={api.pageCount}
      value={api.pageIndex + 1}
      onChange={(page) => api.setPageIndex(page - 1)}
    />
  )}
/>
```

`TMDataGridPaginationApi` carries `pageIndex`, `pageSize`, `pageCount`
(`-1` when a manual grid declares an unknown total), `rowCount`,
`canPreviousPage`, `canNextPage`, and the actions `setPageIndex`, `setPageSize`,
`previousPage`, `nextPage`, `firstPage` and `lastPage`. A pager living outside
the footer can read the same object with
`getTMDataGridPaginationApi(grid.table)` — subscribe to `table.store` first so
it re-renders.

## TMDataGrid.Toolbar

Flex row rendered above the grid.

| Prop | Type | Description |
| --- | --- | --- |
| `children` | `ReactNode` | Toolbar content. |

## TMDataGrid.Spacer

Pushes subsequent toolbar items to the right. Accepts no props.

## TMDataGrid.SummaryCount

Displays visible rows out of total rows.

| Prop | Type | Description |
| --- | --- | --- |
| `children` | `ReactNode` | Replaces the default text. |

The default total is `meta.totalRowCount` when provided, otherwise the
pre-filtered row count.

## TMDataGrid.FilterButton

Toggles the filter panel and adds a filter row for the first filterable column.
Shows an active state while any filter is set.

Renders nothing if no column can be filtered. Accepts no props.

## TMDataGrid.ColumnsButton

Menu button in the top-right corner of the grid. Opens the column manager in a
popover, the same panel opened by "Manage columns" in a column menu.

Renders nothing if no column can be hidden. Accepts no props.

## TMDataGrid.FilterPanel

Column, operator and value rows, under a "Filters" header with a close button
and above "Add filter" / "Clear all". Escape and a click outside close it too —
`TMDataGrid.FilterButton` is exempt from the click-away, so it stays a toggle.
Rendered by `TMDataGrid.Table` and exported for custom layouts. Positions itself
against the nearest positioned ancestor. Accepts no props.

Closing only hides the panel; the filters stay. "Clear all" drops every filter,
half-typed ones included, and closes the panel — the same exit as removing the
last filter row by hand.

## TMDataGrid.FilterPills

One pill per active filter — `First name: Sofia ✕` — where the ✕ clears that
filter and a click on the label reopens the filter panel on its column. Renders
nothing while no filter is active.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `api` | `TMDataGridApi<TData>` | – | The object returned by `useTMDataGrid`. |
| `size` | `MantineSize` | `"sm"` | Pill size. |
| `showClearAll` | `boolean` | `true` | "Clear all" button, shown once two filters are active. |
| `onPillClick` | `(columnId: string) => void` | – | Replaces the default click behaviour. |
| `className` | `string` | – | Added to the wrapper class. |

The only grid component that takes the api as a prop rather than reading
context, so it can live outside the grid — a page header, a card title, a
breadcrumb row:

```tsx
const grid = useTMDataGrid({ data, columns });

<Group>
  <Title order={3}>Employees</Title>
  <TMDataGrid.FilterPills api={grid} />
</Group>

<TMDataGrid {...grid}>…</TMDataGrid>
```

It is also exported as `TMDataGridFilterPills`, which is the import to use when
nothing else in that file touches `TMDataGrid`.

Half-typed filters are left out: a filter that is not narrowing the rows yet has
nothing to report. The label spells the operator out unless it is the column
type's default — `Age is greater than 30`, but `First name: Sofia`.

## TMDataGrid.ColumnsPanel

Search field, column checkboxes, show/hide all and reset. Rendered by
`TMDataGrid.ColumnsButton` and exported for custom layouts. Accepts no props.

## Hooks and helpers

| Export | Description |
| --- | --- |
| `useTMDataGridContext()` | Returns the enclosing grid context. Throws if used outside `TMDataGrid`. |
| `openColumnFilter(api, columnId)` | Adds an empty filter for a column and opens the panel. |
| `getGridCapabilities(table, features)` | Grid-level capability checks. See [Features](#features). |
| `getColumnCapabilities(column, features)` | Column-level capability checks. |
| `getColumnLabel(column)` | `meta.label`, a string header, or the column id. |
| `formatFilterLabel({ label, type, filter })` | The one-line filter description used on the pills. |
| `getColumnType(column)` | `meta.type`, defaulting to `"string"`. |
| `isColumnReorderable(column)` | `meta.enableOrdering`, and not inside a header group. |
| `moveColumn({ table, columnId, targetId, side })` | Moves a column next to another. See [Features](#features). |
| `moveColumnByStep({ table, columnId, direction })` | Moves a column one position within its region. |
| `getStepTargetColumn({ table, columnId, direction })` | The column a step would swap with, or `null`. |
| `getColumnRegion(columnPinning, columnId)` | `"left"`, `"center"` or `"right"`. |
| `SELECT_COLUMN_ID` | Id of the generated checkbox column. |

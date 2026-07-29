# Components

Every component below reads the grid from context and must be rendered inside
`TMDataGrid`. Their order and presence are up to you: the root is a plain flex
column.

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
| `style` | `CSSProperties` | – | Root element styles. Set a bounded height. |

Spread the hook result rather than assigning the first three props individually:

```tsx
<TMDataGrid {...grid} size="sm" style={{ flex: 1, minHeight: 0 }}>
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
| `onRowClick` | `(row: Row<TMDataGridFeatures, TData>) => void` | Row click handler. Rows show a pointer cursor when set. |

Pass the row type to keep `onRowClick` typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

Rows come from `getPaginatedRowModel()`, so a table using `manualPagination`
renders exactly the page returned by the server.

## TMDataGrid.Footer

Pagination controls: rows per page, current range and previous/next buttons.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pageSizeOptions` | `readonly number[]` | `[10, 25, 50, 100]` | Available page sizes. |

Totals are read from `table.getRowCount()`, which prefers `options.rowCount`.
Server-paginated tables therefore display the server total without further
configuration.

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

Column, operator and value rows. Rendered by `TMDataGrid.Table` and exported for
custom layouts. Positions itself against the nearest positioned ancestor.
Accepts no props.

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
| `getColumnType(column)` | `meta.type`, defaulting to `"string"`. |
| `SELECT_COLUMN_ID` | Id of the generated checkbox column. |

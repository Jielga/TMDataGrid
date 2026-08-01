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
| `--dg-padding` | From `size` | Horizontal cell padding. The generated system lanes — checkbox, details — are exempt: they are fixed 36px tracks that centre their control instead |

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
| `onRowClick` | `(row: Row<TMDataGridFeatures, TData>) => void` | Row click handler. Rows show a pointer cursor when set. Runs in addition to whatever the click already does under the `selectionMode` — selection or highlight, never instead of it. |
| `rowContextMenu` | `({ table, row, cell, close }) => ReactNode` | Contents of the menu a right-click on a row opens. |
| `rowContextMenuProps` | `MenuProps` | Passed to the Mantine `Menu` behind `rowContextMenu`. |
| `cellExport` | `TMDataGridCellExportOptions` | How Ctrl+C and the export item write values, under `cellSelection: "range"`. Nordic Excel defaults — `{ separator: ";", decimalComma: true, includeHeaders: true, fileName: "export" }`. |

Pass the row type to keep `onRowClick` typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

### rowContextMenu

Right-clicking a row opens a Mantine `Menu` at the pointer. The grid owns the
`Menu` and its `Menu.Dropdown` — opening it at the cursor, closing it on Escape,
on an outside click, on a body scroll and after an item is picked. The render
prop only says what goes inside, so anything valid in a dropdown works:
`Menu.Item`, `Menu.Label`, `Menu.Divider`, `Menu.Sub`, or your own components.

```tsx
<TMDataGrid.Table<Employee>
  rowContextMenu={({ row, cell }) => (
    <>
      <Menu.Label>{row.original.firstName}</Menu.Label>
      <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
      <Menu.Item
        onClick={() =>
          navigator.clipboard.writeText(String(cell?.getValue() ?? ""))
        }
      >
        Copy cell value
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" onClick={() => remove(row.original.id)}>
        Delete
      </Menu.Item>
    </>
  )}
/>
```

| Argument | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | The table, for actions that read the wider state — `getSelectedRowModel()`, for instance. |
| `row` | `Row<TMDataGridFeatures, TData>` | The right-clicked row. |
| `cell` | `Cell<...> \| null` | The cell under the pointer, so a per-cell action such as "copy value" is possible. `null` only if a custom cell renderer stopped the event. |
| `close` | `() => void` | Closes the menu. `Menu.Item` already closes on click, so this is for content that is not a menu item. |

Called during render, and only for the row whose menu is open — so keep it a
pure function of its arguments and do the work in the item handlers.

Return `null` to leave a row without a menu. The browser's own context menu
stays suppressed over the grid either way:

```tsx
rowContextMenu={({ row }) => (row.original.locked ? null : <Menu.Item>Edit</Menu.Item>)}
```

Right-clicking does not change the selection or the highlighted row — it only
marks the row with `data-context-menu` while its menu is open, which is what gives
it the hover background. An action that should apply to a multi-selection can
read it off `table` and fall back to the clicked row:

```tsx
rowContextMenu={({ table, row }) => {
  const selected = table.getSelectedRowModel().rows;
  const targets = selected.some((r) => r.id === row.id) ? selected : [row];
  return <Menu.Item onClick={() => archive(targets)}>Archive {targets.length}</Menu.Item>;
}}
```

Set the dropdown's own options through `rowContextMenuProps`, which reaches the
`Menu` untouched apart from its open state:

```tsx
<TMDataGrid.Table<Employee>
  rowContextMenu={items}
  rowContextMenuProps={{ width: 260, shadow: "lg", position: "right-start" }}
/>
```

On touch devices a long press (500 ms) opens the same menu. Mantine sets
`user-select: none` on the element it hangs a context menu off, so body cell
text is no longer selectable with the mouse in a grid that has one — the trade
for a long press opening the menu rather than selecting text.

One `Menu` serves the whole body, not one per row: a closed Mantine `Popover`
still runs its hooks on every render, and the virtualized body re-renders on
every scroll frame.

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

While the rows are grouped the built-in pager greys itself out and shows
`Grouped · all N rows` instead of a range, because grouping suspends client-side
paging — see [Grouping suspends pagination](/docs/features#grouping-suspends-pagination).
The `pagination` render prop is left alone; a custom pager decides for itself,
and `isPagingActive(table, features)` is exported so it can grey out the same
way.

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

The toolbar is plain composition: anything can sit between the built-in parts,
and `Spacer` pushes what follows to the right. Your own buttons in the top-right
corner are just children after it:

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
  <Button size="xs" variant="light" onClick={exportAll}>
    Export
  </Button>
  <TMDataGrid.FilterButton />
  <TMDataGrid.ColumnsButton />
</TMDataGrid.Toolbar>
```

## TMDataGrid.Spacer

Pushes subsequent toolbar items to the right. Accepts no props.

## TMDataGrid.LoadingIndicator

A small spinner shown while `meta.loading` is true, and nothing otherwise.
Accepts no props.

The body shows its own loading state only while the grid is empty; a
server-driven grid refetching with rows on screen keeps showing them. This is
the signal for that case — place it wherever it should sit, typically after
`Spacer`.

## TMDataGrid.SummaryCount

Displays visible rows out of total rows.

| Prop | Type | Description |
| --- | --- | --- |
| `children` | `ReactNode` | Replaces the default text. |

The default total is `meta.totalRowCount` when provided, otherwise the
pre-filtered row count.

## TMDataGrid.Search

Quick search over every column — a debounced input writing the table's
`globalFilter` state.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` | `labels.searchPlaceholder` | Input placeholder. |
| `debounce` | `number` | `250` | Pause before the filter applies, in ms. `0` filters per keystroke. |
| `w` | `number \| string` | `220` | Input width. |

Renders nothing under `enableGlobalFilter: false`. Columns opt out with their
own `enableGlobalFilter: false`; the generated lanes already do. The state is
TanStack's `globalFilter` — `manualFiltering` grids forward it to the server,
and it is one of the persisted `data` slices. A custom search input skips this
component and calls `table.setGlobalFilter` itself.

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
| `DETAILS_COLUMN_ID` | Id of the generated details column. See [Features](#features). |
| `isControlColumn(columnId)` | Whether an id is a generated control lane — the checkbox or the details chevron. |
| `resolveExpandAll({ rows, expanded, target, expand })` | Next `expanded` state after expanding or collapsing every group, or every detail, leaving the other kind alone. |
| `areAllRowsExpanded({ rows, expanded, target })` | Whether every group, or every detail, is open. |
| `buildGridCellMatrix({ table, includeHeaders?, decimalComma? })` | The whole grid — every filtered and sorted row, all pages, every visible non-control column — as rows of text. |
| `exportGridToCsv({ table, options? })` | Downloads the whole grid as a CSV for Excel, same options and Nordic defaults as the cell-range export. No built-in button — wire it to your own toolbar (see [TMDataGrid.Toolbar](#components)). |

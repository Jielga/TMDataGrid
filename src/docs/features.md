# Features

The grid does not define its own feature switches. Every control is bound to the
TanStack capability check for that feature, so setting the standard table or
column option removes the corresponding interface. Empty menus and inactive
buttons are never rendered.

## Option reference

| Option | Level | Interface removed |
| --- | --- | --- |
| `enableSorting: false` | Table, column | Sort indicator, sort menu items, click-to-sort |
| `enableColumnFilters: false` | Table | Filter menu item, `FilterButton`, filter panel |
| `enableColumnFilter: false` | Column | That column's filter menu item and panel entry |
| `enableHiding: false` | Table, column | Hide column, Manage columns, `ColumnsButton` |
| `enableColumnPinning: false` | Table | Pin and unpin menu items |
| `enablePinning: false` | Column | That column's pin menu items |
| `enableColumnResizing: false` | Table | Resize dragging. The divider remains as a separator |
| `enableResizing: false` | Column | That column's resize dragging |
| `enableRowSelection: false` | Table | The checkbox column |

A column whose menu has no remaining items renders no menu button. Dividers are
never left at the end of a menu.

```tsx
// Read-only grid: no selection, hiding, pinning or filtering.
const grid = useTMDataGrid({
  data,
  columns,
  enableRowSelection: false,
  enableHiding: false,
  enableColumnPinning: false,
  enableColumnFilters: false,
});
```

Pagination is not controlled by an option. Omit `TMDataGrid.Footer` and no
pagination controls are rendered.

## Capability helpers

Use these to apply the same checks in your own toolbar components.

```tsx
import { getGridCapabilities, useTMDataGridContext } from "./tmdatagrid";

function ExportButton() {
  const { table, features } = useTMDataGridContext();
  const { canFilterAny } = getGridCapabilities(table, features);

  if (!canFilterAny) return null;
  // …
}
```

`getGridCapabilities(table, features)`:

| Field | Description |
| --- | --- |
| `canSortAny` | At least one leaf column can be sorted. |
| `canFilterAny` | At least one leaf column can be filtered. |
| `canHideAny` | At least one leaf column can be hidden. |
| `canPinAny` | At least one leaf column can be pinned. |
| `canSelectRows` | `enableRowSelection` is not `false`. |

`getColumnCapabilities(column, features)` returns the same information for a
single column as `canSort`, `canFilter`, `canHide`, `canPin` and `canResize`.

### The features argument

`features` is returned by `useTMDataGrid` and re-derived from the options object
on every render. It is required in addition to TanStack's `getCanX()` methods
because it is what makes the result reactive.

`column.getCanSort()` is a method call on a column object whose identity is
preserved across an options change. Under the React Compiler the call is
memoized, so a grid whose `enableSorting` changes to `false` would continue to
render sort indicators. Passing `features` provides a value that changes, while
`getCanX()` still determines the outcome and applies per-column overrides.

The same rule applies to values derived from the table elsewhere in an
application. Read state through `useSelector(table.store, …)` and options
through `features`, rather than calling methods on a long-lived object.

## Column pinning

Pin to left and Pin to right are available in each column menu. The current
position is marked, and selecting it again unpins the column. Pinned columns are
sticky within the scroll container and the boundary is marked with a divider and
a short gradient.

Headers, cells and grid tracks are ordered left, centre, right from the same
source, so pinning does not change a column's position relative to its group.

Pinning is stored in `columnPinning`, one of the slices covered by `settingsKey`
in [persistence](#use-tm-data-grid).

## Virtualization

Always enabled and not configurable. Only rows within the viewport, plus a small
overscan, are mounted, so page size does not affect how much is rendered.

Row height is taken from `meta.rowHeight`, or from the `size` prop when it is not
set. Rows are fixed height; an accurate value keeps scrolling precise.

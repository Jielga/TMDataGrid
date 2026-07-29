---
name: features
description: >
  Enable or disable TMDataGrid interface elements through standard TanStack
  table and column options, and reuse the same checks in your own components.
  Covers the enableSorting/enableColumnFilters/enableHiding/enableColumnPinning/
  enableColumnResizing/enableRowSelection matrix, getGridCapabilities and
  getColumnCapabilities, why the features argument is required for reactivity
  under the React Compiler, column pinning, and always-on virtualization. Load
  when building a read-only grid, hiding grid chrome, or writing a custom
  toolbar button.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '0.0.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/features.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/capabilities.ts'
---

# TMDataGrid — Features and capabilities

The grid defines no feature switches of its own. Every control is bound to the
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

Pagination is not controlled by an option — omit `TMDataGrid.Footer` and no
pagination controls are rendered.

## Capability helpers

Use these to apply the same checks in your own components.

```tsx
import { getGridCapabilities, useTMDataGridContext } from "@jielga/tmdatagrid";

function ExportButton() {
  const { table, features } = useTMDataGridContext();
  const { canFilterAny } = getGridCapabilities(table, features);

  if (!canFilterAny) return null;
  return <Button onClick={exportRows}>Export</Button>;
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

`readFeatureFlags(options)` derives the flags from a table options object.

## Why capabilities take a features argument

`features` is returned by `useTMDataGrid` and re-derived from the options object
on every render. It is required *in addition to* TanStack's `getCanX()` methods
because it is what makes the result reactive.

`column.getCanSort()` is a method call on a column object whose identity is
preserved across an options change. Under the React Compiler the call is
memoized, so a grid whose `enableSorting` flips to `false` would keep rendering
sort indicators. Passing `features` supplies a value that actually changes, while
`getCanX()` still determines the outcome and applies per-column overrides.

The same rule applies to any value derived from the table elsewhere in an
application: read state through `useSelector(table.store, …)` and options through
`features`, rather than calling methods on a long-lived object.

## Column pinning

Pin to left and Pin to right appear in each column menu. The current position is
marked, and selecting it again unpins. Pinned columns are sticky within the
scroll container, and the boundary is marked with a divider and a short gradient.

Headers, cells and grid tracks are ordered left, centre, right from the same
source, so pinning does not change a column's position relative to its group.

Pinning is stored in `columnPinning`, one of the slices covered by `settingsKey`
in the `options` skill.

## Virtualization

Always enabled and not configurable. Only rows within the viewport, plus a small
overscan, are mounted, so page size does not affect how much is rendered.

Row height comes from `meta.rowHeight`, or from the `size` prop when unset. Rows
are fixed height; an accurate value keeps scrolling precise.

## Common mistakes

### Calling getCanX() in a custom component

```tsx
// Wrong — memoized under the React Compiler, so the button
// never reappears when enableColumnFilters flips back to true.
const { table } = useTMDataGridContext();
if (!table.getAllLeafColumns().some((c) => c.getCanFilter())) return null;

// Right — features is a value that changes.
const { table, features } = useTMDataGridContext();
const { canFilterAny } = getGridCapabilities(table, features);
if (!canFilterAny) return null;
```

### Setting a custom row height in CSS only

The virtualizer needs the height as a number to position rows. Overriding row
height in a stylesheet leaves the virtualizer measuring the old value, so rows
overlap or leave gaps as you scroll. Set `meta.rowHeight` instead.

### Expecting a table-level flag to override a column

Table and column options compose — the table flag gates the feature, and the
column flag narrows it further. `enableSorting: true` on a column does not
re-enable sorting for a table that set `enableSorting: false`.

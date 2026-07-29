---
name: features
description: >
  Enable or disable TMDataGrid interface elements through standard TanStack
  table and column options, and reuse the same checks in your own components.
  Covers the enableSorting/enableColumnFilters/enableHiding/enableColumnPinning/
  enableColumnResizing/enableColumnOrdering/enableRowSelection matrix, the
  checkbox and row selection modes behind rowSelectionMode, the
  default-off enablePagination switch and its three modes (none, client,
  manual), getGridCapabilities and getColumnCapabilities, why the features
  argument is required for reactivity under the React Compiler, column pinning,
  column ordering with moveColumn and moveColumnByStep, and always-on
  virtualization. Load when building a read-only grid, hiding grid chrome,
  enabling pagination, reordering columns from code, or writing a custom
  toolbar button.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '0.1.0'
sources:
  - 'Jielga/TMDataGrid:src/docs/features.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/capabilities.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/columnOrdering.ts'
---

# TMDataGrid — Features and capabilities

Almost every control is bound to the TanStack capability check for that feature,
so setting the standard table or column option removes the corresponding
interface. Empty menus and inactive buttons are never rendered.

Column ordering and pagination are the two exceptions. TanStack ships state and
APIs for both but no `enable` option, so the grid defines `enableColumnOrdering`
(with `meta.enableOrdering`) and `enablePagination` itself. Ordering behaves
like the options around it; pagination is the one switch that defaults to off.

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
| `enableColumnOrdering: false` | Table | Header dragging and the move menu items |
| `meta.enableOrdering: false` | Column | That column's header dragging and move menu items |
| `enableRowSelection: false` | Table | The checkbox column |
| `rowSelectionMode: "row"` | Table | The checkbox column — the row itself selects instead. See Row selection |
| `enablePagination: true` | Table | Opt-in: adds paging and the `Footer` pager. Off by default |

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

## Row selection

On by default, in two modes. Both write to the same `rowSelection` state, so
everything downstream — the toolbar count, `getSelectedRowModel()`, persistence
— is unaffected by the choice.

**Checkbox** — the default. A checkbox column is added as the first column, with
a select-all box in its header. Clicking a row elsewhere does not select it.

```tsx
const grid = useTMDataGrid({ data, columns });
```

**Row** — no checkbox column. Clicking a row toggles it, and the row keeps the
selected highlight. Other rows keep their state, so a click never clears the
rest of the selection. Rows are focusable in this mode and Space or Enter
toggles the focused row.

```tsx
const grid = useTMDataGrid({ data, columns, rowSelectionMode: "row" });
```

`enableRowSelection: false` removes both, and `rowSelectionMode` is then
ignored. `TMDataGrid.Table`'s `onRowClick` still fires in either mode — under
`"row"` it runs in addition to the selection, not instead of it.

## Pagination

Off by default: the grid renders every filtered and sorted row and relies on
virtualization. Three modes:

```tsx
// No pagination (default) — TMDataGrid.Footer renders nothing.
const grid = useTMDataGrid({ data, columns });

// Client pagination — pages locally, Footer renders its pager.
const grid = useTMDataGrid({ data, columns, enablePagination: true });

// Manual pagination — manualPagination implies enablePagination.
const grid = useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  rowCount: page.total,
  state: { pagination },
  onPaginationChange: setPagination,
});
```

The built-in pager can be replaced with the Footer's `pagination` render prop
(see the `getting-started` skill) or built from scratch on the table API.

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
| `canReorderAny` | At least one leaf column can be moved. |
| `canSelectRows` | `enableRowSelection` is not `false`. The mode is in `features.rowSelectionMode`. |
| `canPaginate` | `enablePagination` or `manualPagination` is `true`. |

`getColumnCapabilities(column, features)` returns the same information for a
single column as `canSort`, `canFilter`, `canHide`, `canPin`, `canResize` and
`canReorder`.

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

## Column ordering

Enabled by default. Drag a column header sideways to move it; "Move left" and
"Move right" in the column menu do the same one step at a time, and are the path
that works without a pointer.

A column only moves within its own pinned region, so a header in another region
never accepts the drop. That follows TanStack's pipeline: pinning splits the
grid into left, centre and right, then `columnOrder` sequences the centre while
`columnPinning.left` / `.right` sequence the pinned lanes. Unpin first to move a
column out of a pinned region.

Ordering writes `columnOrder` as the complete leaf order — hidden and pinned
columns included — so a column keeps its position when it is later shown or
unpinned; moving a pinned column also rewrites its `columnPinning` array. Both
slices are covered by `settingsKey`.

A neighbour that cannot be moved acts as a wall rather than being stepped over,
which is what keeps the checkbox column at the start of the left region.
Columns inside a header group are never movable: `columnOrder` sequences leaf
columns, so moving one would leave the group header spanning columns that no
longer belong to it.

```tsx
import {
  getStepTargetColumn,
  moveColumn,
  moveColumnByStep,
} from "@jielga/tmdatagrid";

moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
moveColumnByStep({ table, columnId: "salary", direction: 1 });

// null at the edge of a region — what the move menu items disable themselves on.
const next = getStepTargetColumn({ table, columnId: "salary", direction: 1 });
```

Both movers are no-ops for a move that is not allowed, including one across
regions.

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

### Reordering a pinned column through columnOrder

```tsx
// Wrong — the left and right regions are sequenced by columnPinning,
// so this moves nothing on screen.
table.setColumnOrder(["__select__", "department", "id", …]);

// Right — moveColumn writes whichever slice the column's region uses.
moveColumn({ table, columnId: "department", targetId: "id", side: "before" });
```

### Rendering the Footer without enabling pagination

```tsx
// Wrong — pagination defaults to off, so the Footer renders nothing.
const grid = useTMDataGrid({ data, columns });
<TMDataGrid.Footer />

// Right — opt in (manualPagination: true also counts).
const grid = useTMDataGrid({ data, columns, enablePagination: true });
<TMDataGrid.Footer />
```

### Expecting a table-level flag to override a column

Table and column options compose — the table flag gates the feature, and the
column flag narrows it further. `enableSorting: true` on a column does not
re-enable sorting for a table that set `enableSorting: false`.

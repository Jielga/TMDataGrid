# Features

Almost every control is bound to the TanStack capability check for that feature,
so setting the standard table or column option removes the corresponding
interface. Empty menus and inactive buttons are never rendered.

Column ordering and pagination are the two exceptions. TanStack ships state and
APIs for both but no `enable` option, so the grid defines `enableColumnOrdering`
(with `meta.enableOrdering`) and `enablePagination` itself. Ordering behaves
like the options around it; pagination is the one switch that defaults to off —
see [Pagination](#pagination).

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
| `rowSelectionMode: "row"` | Table | The checkbox column — the row itself selects instead. See [Row selection](#row-selection) |
| `highlightSelectedRows: false` | Table | The highlight background on selected rows. Follows the selection mode by default |
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
a select-all box in its header. Clicking a row elsewhere does not select it, and
a selected row is not highlighted: the checkbox already says so.

```tsx
const grid = useTMDataGrid({ data, columns });
```

**Row** — no checkbox column. Clicking a row toggles it, and the row takes the
highlight background — the only feedback a click gives. Other rows keep their
state, so a click never clears the rest of the selection. Rows are focusable in
this mode and Space or Enter toggles the focused row.

```tsx
const grid = useTMDataGrid({ data, columns, rowSelectionMode: "row" });
```

`enableRowSelection: false` removes both, and `rowSelectionMode` is then
ignored. `TMDataGrid.Table`'s `onRowClick` still fires in either mode — under
`"row"` it runs in addition to the selection, not instead of it.

### Highlighting selected rows

`highlightSelectedRows` follows the mode: on for `"row"`, off for `"checkbox"`.
Set it to override that — checkboxes *and* a highlight, or row selection with no
background change.

```tsx
// Checkbox column, and selected rows are highlighted too.
const grid = useTMDataGrid({ data, columns, highlightSelectedRows: true });
```

The colour is the `--dg-row-selected-bg` CSS variable, which defaults to
`--mantine-primary-color-light`. Change it on the grid element — no need to
touch the flag:

```tsx
<TMDataGrid
  {...grid}
  style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
/>
```

Rows carry `data-selected` whenever they are selected and `data-highlighted`
only when they are also highlighted, so custom styling can key off either.

## Pagination

Off by default: the grid renders every filtered and sorted row and relies on
virtualization, which handles any row count. There are three modes.

**No pagination** — the default. `TMDataGrid.Footer` renders nothing.

```tsx
const grid = useTMDataGrid({ data, columns });
```

**Client pagination** — set `enablePagination: true`. The table pages the data
itself (initial page size 25, configurable through `initialState.pagination`)
and `TMDataGrid.Footer` renders its pager.

```tsx
const grid = useTMDataGrid({ data, columns, enablePagination: true });
```

**Manual pagination** — set the standard TanStack options for server-driven
paging. `manualPagination: true` implies `enablePagination`, so no extra flag is
needed; see [server-side](#server-side).

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

The built-in pager can be replaced through the Footer's `pagination` render
prop, or bypassed entirely by building on the table API — see
[components](#components).

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
| `canReorderAny` | At least one leaf column can be moved. |
| `canSelectRows` | `enableRowSelection` is not `false`. The mode is in `features.rowSelectionMode`. |
| `canPaginate` | `enablePagination` or `manualPagination` is `true`. |

`getColumnCapabilities(column, features)` returns the same information for a
single column as `canSort`, `canFilter`, `canHide`, `canPin`, `canResize` and
`canReorder`.

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

## Column ordering

Enabled by default. Drag a column header sideways to move it: the header being
dragged dims and a bar marks the edge the column will land against. "Move left"
and "Move right" in the column menu do the same thing one step at a time, which
is the path that works without a pointer. Both move the header, its cells and
its filter entry together.

### Regions

A column can only be moved within its own pinned region, so a header in another
region never accepts the drop. This follows TanStack's ordering pipeline:
pinning splits the grid into left, centre and right, then `columnOrder`
sequences the centre while `columnPinning.left` and `.right` sequence the pinned
lanes. Unpin a column first to move it out of a pinned region.

A neighbour that cannot be moved acts as a wall rather than being stepped over.
The checkbox column sets `meta.enableOrdering: false`, so nothing can be placed
in front of it.

Columns inside a header group are not movable either, in either direction:
`columnOrder` sequences leaf columns, so moving one would leave the group header
spanning columns that no longer belong to it.

### State

Ordering writes `columnOrder` as the complete leaf order, including hidden and
pinned columns, so a column keeps its position when it is later shown or
unpinned. Moving a pinned column also rewrites its `columnPinning` array.

Both slices are covered by `settingsKey`, so with persistence configured the
column layout is restored on the next mount alongside widths and visibility. A
column added to the definitions later is not in the stored order and is appended
at the end until it is moved.

```tsx
// Ordering off; everything else as it comes.
const grid = useTMDataGrid({ data, columns, enableColumnOrdering: false });
```

To move a column from your own code, use the same helpers the chrome uses:

```tsx
import { moveColumn, moveColumnByStep } from "./tmdatagrid";

moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
moveColumnByStep({ table, columnId: "salary", direction: 1 });
```

Both are no-ops for a move that is not allowed, including one across regions.
`getStepTargetColumn({ table, columnId, direction })` returns the column a step
would swap with, or `null` at the edge of a region — that is what the menu items
use to disable themselves.

## Virtualization

Always enabled and not configurable. Only rows within the viewport, plus a small
overscan, are mounted, so page size does not affect how much is rendered.

Row height is taken from `meta.rowHeight`, or from the `size` prop when it is not
set. Rows are fixed height; an accurate value keeps scrolling precise.

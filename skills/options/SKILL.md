---
name: options
description: >
  useTMDataGrid options, return value and state persistence. Covers passthrough
  of TanStack TableOptions, the default initialState (pagination, columnPinning,
  globalFilterFn), the meta object (loading, noResultsLabel, rowHeight,
  totalRowCount), the grid's own persist, enableColumnOrdering,
  enablePagination, rowSelectionMode and highlightSelectedRows options, the
  persist option with dataKey/settingsKey slice selection and storageMode, the
  returned table/ui/features triple, ui panel and column drag actions, and
  reading grid state with useSelector. Load when configuring the hook,
  persisting column layout or filters, or reacting to grid state from a parent.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.0.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/use-tm-data-grid.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/useTMDataGrid.tsx'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/persistence.ts'
---

# TMDataGrid - useTMDataGrid

Creates the table instance and the state used by the grid interface.

```tsx
const grid = useTMDataGrid<TData>(options);
// { table, ui, features }
```

Spread the result onto `TMDataGrid`.

## Options

All TanStack `TableOptions` are supported and passed through unchanged, including
`data`, `columns`, `getRowId`, `state`, the `onXChange` callbacks, the `manual*`
flags and `rowCount`. The `features` option is supplied internally and cannot be
overridden.

`persist`, `enableColumnOrdering`, `enablePagination`, `rowSelectionMode` and
`highlightSelectedRows` are the grid's own options and are consumed by the hook
rather than forwarded to TanStack.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `TData[]` | – | Row data. Keep the reference stable with `useMemo`. |
| `columns` | `ColumnDef[]` | – | Created with `createTMDataGridColumnHelper`. |
| `getRowId` | `(row, index) => string` | Row index | Used by row selection and virtualization. |
| `enableRowSelection` | `boolean \| (row) => boolean` | `true` | `false` removes row selection and its checkbox column. |
| `rowSelectionMode` | `"checkbox" \| "row"` | `"checkbox"` | `"row"` drops the checkbox column and selects on row click. Defined by the grid. |
| `highlightSelectedRows` | `boolean` | Follows the mode | Highlight background on selected rows: off for `"checkbox"`, on for `"row"`. Colour is the `--dg-row-selected-bg` CSS variable. Defined by the grid. |
| `enableSorting` | `boolean` | `true` | Enables sorting for the table. |
| `enableColumnFilters` | `boolean` | `true` | Enables filtering for the table. |
| `enableHiding` | `boolean` | `true` | Enables column visibility for the table. |
| `enableColumnPinning` | `boolean` | `true` | Enables pinning for the table. |
| `enableColumnResizing` | `boolean` | `true` | Enables resizing for the table. |
| `enableColumnOrdering` | `boolean` | `true` | Enables header dragging and the move menu items. Defined by the grid. |
| `enablePagination` | `boolean` | `false` | Enables client-side paging and the `Footer` pager. Implied by `manualPagination`. Defined by the grid. |
| `cellSelection` | `"none" \| "single" \| "range"` | `"none"` | Cell cursor; `"range"` adds a drag-selectable rectangle, Ctrl+C and CSV export. Defined by the grid. |
| `onFocusedCellChange` | `(cell \| null) => void` | – | Fires whenever the focused cell moves. |
| `overscan` | `number` | `6` | Rows the virtualizer keeps mounted above and below the viewport. Defined by the grid. |
| `columnResizeMode` | `"onChange" \| "onEnd"` | `"onChange"` | Resize update strategy. |
| `initialState` | `Partial<TableState>` | See below | Merged over the grid defaults. |
| `meta` | `TMDataGridTableMeta` | `{}` | Grid configuration, see below. |
| `persist` | `TMDataGridPersistence` | – | State persistence, see below. |

### Default initial state

| Slice | Default |
| --- | --- |
| `pagination` | `{ pageIndex: 0, pageSize: 25 }` - inert until pagination is enabled |
| `columnPinning.left` | The checkbox column, followed by any columns you provide |
| `globalFilterFn` | `"includesString"` |

## meta

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | – | Displays a loader instead of the empty state. |
| `noResultsLabel` | `string` | `"No rows match your filters"` | Empty state text. |
| `rowHeight` | `number` | From `size` | Row height in px. Overrides the size scale. |
| `totalRowCount` | `number` | – | Unfiltered total used by `SummaryCount`. Required for server-side data. |

## persist

Restores table state on mount and writes it back on every change. State is split
across two keys because the groups have different lifetimes: column configuration
stays valid indefinitely, while filters and pagination go stale as the data
changes. Separate keys let one group be cleared without touching the other.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `string \| [string, DataSlice[]]` | – | Storage key for the data group. |
| `settingsKey` | `string \| [string, SettingsSlice[]]` | – | Storage key for the settings group. |
| `storageMode` | `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage area. |
| `serialize` | `(value) => string` | `JSON.stringify` | Serializes before storing. |
| `deserialize` | `(value: string) => unknown` | `JSON.parse` | Parses a stored payload. |

Both keys are optional.

```tsx
import type { TMDataGridPersistence } from "@jielga/tmdatagrid";

// Module scope: the object is a dependency of the write subscription.
const persist = {
  dataKey: "employees.data",
  settingsKey: "employees.settings",
} satisfies TMDataGridPersistence;

const grid = useTMDataGrid({ data, columns, persist });
```

### Selecting slices

A bare key persists every slice in its group. Pass `[key, slices]` for a subset:

```tsx
const persist = {
  // Restore filters and sorting, but always start on the first page.
  dataKey: ["employees.data", ["columnFilters", "sorting"]],
  // Restore column layout but not widths.
  settingsKey: ["employees.settings", ["columnVisibility", "columnOrder"]],
  storageMode: "sessionStorage",
} satisfies TMDataGridPersistence;
```

| Group | Available slices |
| --- | --- |
| `dataKey` | `columnFilters`, `globalFilter`, `sorting`, `pagination` |
| `settingsKey` | `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning` |

`DATA_STATE_SLICES` and `SETTINGS_STATE_SLICES` export the same values. Slice
names are typed per group, so only valid names are accepted.

Restoring happens once on mount through `initialState`. Writing is a subscription
to the table store, so state changed directly through the table API is persisted
too. Only selected slices are read back, and unrecognised keys are ignored. All
storage access is guarded - if storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

## Return value

| Field | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | The TanStack table instance. |
| `ui` | `Store<TMDataGridUiState, TMDataGridUiActions>` | State of the filter and column panels. |
| `features` | `TMDataGridFeatureFlags` | Table-level feature switches, re-read on each render. |

Both stores are subscribable, which is how a parent reacts to grid state without
owning it:

```tsx
import { useSelector } from "@tanstack/react-store";

const selectedCount = useSelector(
  grid.table.store,
  (state) => Object.keys(state.rowSelection).length,
);

const filterPanelOpen = useSelector(grid.ui, (state) => state.filterPanelOpen);
```

### ui actions

| Action | Signature |
| --- | --- |
| `openFilterPanel` | `(columnId?: string \| null) => void` |
| `closeFilterPanel` | `() => void` |
| `setColumnsPanelOpen` | `(open: boolean) => void` |
| `toggleColumnsPanel` | `() => void` |
| `startColumnDrag` | `(columnId: string) => void` |
| `endColumnDrag` | `() => void` |
| `setHighlightedRow` | `(rowId: string \| null) => void` |
| `setSelectionAnchor` | `(rowId: string \| null) => void` |
| `setFocusedCell` | `(cell: TMDataGridCellPosition \| null) => void` |
| `setCellRange` | `(range: TMDataGridCellRange \| null) => void` |

The last two move the cell cursor and the selected rectangle under
`cellSelection`; DOM focus follows `focusedCell` and scrolls its row into view.

`startColumnDrag` / `endColumnDrag` are called by the header cells while a column is being dragged, and
`ui.draggedColumnId` holds the column being moved - browsers keep `dataTransfer`
unreadable until the drop.

`openColumnFilter(grid, columnId)` combines the two steps the column menu uses:
add an empty filter row for the column if none exists, then open the panel.

## Common mistakes

### Reading store state during render

`grid.table.store.state` is a plain read - it does not subscribe the component,
so the value is correct on first render and then never updates.

```tsx
// Wrong - never re-renders when the selection changes.
const count = Object.keys(grid.table.store.state.rowSelection).length;

// Right.
const count = useSelector(
  grid.table.store,
  (state) => Object.keys(state.rowSelection).length,
);
```

### persist object built during render

The object is a dependency of the write subscription. A fresh literal on every
render tears down and re-establishes the subscription each time. Define it at
module scope, or `useMemo` it if the keys depend on props.

### Unnamespaced storage keys

Storage keys are not namespaced automatically. Where several users can share a
browser profile, one user's column layout and filters are restored for the next.
Include a tenant or user identifier in the key.

### Unstable data reference

A new array identity on each render re-runs the row model. `data={rows ?? []}`
allocates a fresh `[]` every render when `rows` is undefined - hoist the empty
array to a module-scope constant or `useMemo` the expression.

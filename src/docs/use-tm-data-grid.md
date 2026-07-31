# useTMDataGrid

Creates the table instance and the state used by the grid interface.

```tsx
const grid = useTMDataGrid<TData>(options);
// { table, ui, features }
```

Spread the result onto `TMDataGrid`.

## Options

All TanStack `TableOptions` are supported and passed through unchanged,
including `data`, `columns`, `getRowId`, `state`, the `onXChange` callbacks, the
`manual*` flags and `rowCount`. The `features` option is supplied internally and
cannot be overridden.

`persist`, `enableColumnOrdering`, `enablePagination`, `rowSelectionMode`,
`highlightSelectedRows`, `renderDetails`, `renderDetailsEstHeight`, `overscan`,
`cellSelection` and `onFocusedCellChange` are the grid's own options and are
consumed here rather than forwarded to TanStack.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `TData[]` | – | Row data. Keep the reference stable with `useMemo`. |
| `columns` | `ColumnDef[]` | – | Created with `createTMDataGridColumnHelper`. |
| `getRowId` | `(row, index) => string` | Row index | Used by row selection and virtualization. |
| `enableRowSelection` | `boolean \| (row) => boolean` | `true` | `false` removes row selection and its checkbox column. |
| `rowSelectionMode` | `"checkbox" \| "row"` | `"checkbox"` | `"row"` drops the checkbox column and selects on row click. Defined by the grid, see [Features](#features). |
| `highlightSelectedRows` | `boolean` | Follows the mode | Highlight background on selected rows: off for `"checkbox"`, on for `"row"`. Colour is the `--dg-row-selected-bg` CSS variable. Defined by the grid, see [Features](#features). |
| `enableSorting` | `boolean` | `true` | Enables sorting for the table. |
| `enableColumnFilters` | `boolean` | `true` | Enables filtering for the table. |
| `enableHiding` | `boolean` | `true` | Enables column visibility for the table. |
| `enableColumnPinning` | `boolean` | `true` | Enables pinning for the table. |
| `enableColumnResizing` | `boolean` | `true` | Enables resizing for the table. |
| `enableColumnOrdering` | `boolean` | `true` | Enables header dragging and the move menu items. Defined by the grid, see [Features](#features). |
| `enablePagination` | `boolean` | `false` | Enables client-side paging and the `Footer` pager. Implied by `manualPagination`. Defined by the grid, see [Features](#features). |
| `renderDetails` | `({ row, table }) => ReactNode` | – | Panel rendered under an expanded row, spanning every column. Setting it is what turns row details on, and what adds the pinned chevron lane. Defined by the grid, see [Features](#features). |
| `renderDetailsEstHeight` | `number` | `160` | What the virtualizer assumes for a panel it has not measured yet. Panels are measured, so this only has to be roughly right. |
| `cellSelection` | `"none" \| "single" \| "range"` | `"none"` | Cell cursor and, under `"range"`, a selectable rectangle with Ctrl+C and CSV export. Defined by the grid, see [Features](#features). |
| `onFocusedCellChange` | `(cell: TMDataGridCellPosition \| null) => void` | – | Called whenever the focused cell moves, by key, click or `setFocusedCell`. |
| `overscan` | `number` | `6` | Rows the virtualizer keeps mounted above and below the viewport. Raise it if fast scrolling flashes blank rows, lower it when rows are expensive to render. |
| `columnResizeMode` | `"onChange" \| "onEnd"` | `"onChange"` | Resize update strategy. |
| `initialState` | `Partial<TableState>` | See below | Merged over the grid defaults. |
| `meta` | `TMDataGridTableMeta` | `{}` | Grid configuration, see below. |
| `persist` | `TMDataGridPersistence` | – | State persistence, see below. |
| `labels` | `TMDataGridLabelsOverride` | English | Overrides for the grid's strings, see [Localization](#localization). |

### Default initial state

| Slice | Default |
| --- | --- |
| `pagination` | `{ pageIndex: 0, pageSize: 25 }` — inert until pagination is enabled |
| `columnPinning.left` | The checkbox, tree and details columns, followed by any columns you provide |
| `globalFilterFn` | `"includesString"` |

## meta

Grid configuration passed through the `meta` option.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | – | Displays a loader instead of the empty state. |
| `noResultsLabel` | `string` | `"No rows match your filters"` | Empty state text. |
| `rowHeight` | `number` | From `size` | Row height in px. Overrides the size scale. |
| `totalRowCount` | `number` | – | Unfiltered total used by `SummaryCount`. Required for server-side data. |

## Localization

Every string the grid renders — menu items, panels, tooltips, the pager and the
`aria-label`s — comes from one labels object, English by default. The `labels`
option takes any subset and merges it over the defaults:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  labels: { noResults: "Inga rader matchar dina filter" },
});
```

Labels that carry a value are functions, so a language can put the value where
its grammar wants it:

```tsx
labels: {
  groupBy: (column) => `Gruppera på ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
}
```

Keep the object referentially stable (module scope or `useMemo`) — the chrome
re-renders when its identity changes.

The full dictionary type is `TMDataGridLabels`; the English defaults are
exported as `TMDATAGRID_LABELS_EN`. `meta.noResultsLabel` still works as a
per-instance override of `labels.noResults`.

The resolved dictionary is returned from the hook as `grid.labels`, so custom
toolbar components can read the same strings the built-in chrome does.

## persist

Restores table state on mount and writes it back on every change. State is
split across two keys because the two groups have different lifetimes. Column
configuration remains valid indefinitely, while filters and pagination can
become stale as the underlying data changes. Separate keys allow one group to
be cleared without affecting the other.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `string \| [string, DataSlice[]]` | – | Storage key for the data group. |
| `settingsKey` | `string \| [string, SettingsSlice[]]` | – | Storage key for the settings group. |
| `storageMode` | `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage area. Use `"sessionStorage"` for per-tab state. |
| `serialize` | `(value) => string` | `JSON.stringify` | Serializes a payload before storing. |
| `deserialize` | `(value: string) => unknown` | `JSON.parse` | Parses a stored payload. |

Both keys are optional.

```tsx
// Defined at module scope: the object is a dependency of the write subscription.
const persist = {
  dataKey: "employees.data",
  settingsKey: "employees.settings",
} satisfies TMDataGridPersistence;

const grid = useTMDataGrid({ data, columns, persist });
```

### Selecting slices

Passing a key on its own persists every slice in its group. Pass a tuple of
`[key, slices]` to persist only some of them:

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
| `dataKey` | `columnFilters`, `globalFilter`, `sorting`, `pagination`, `expanded` |
| `settingsKey` | `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning`, `grouping` |

The exported `DATA_STATE_SLICES` and `SETTINGS_STATE_SLICES` arrays contain the
same values. Slice names are typed per group, so only valid names are accepted.

### Behaviour

Restoring happens once on mount through `initialState`. Writing is implemented
as a subscription to the table store, so state changed directly through the
table API is persisted as well.

Only the selected slices are read back. A payload written before the selection
was narrowed cannot reintroduce slices you have since opted out of. Unrecognised
keys are ignored.

All storage access is guarded. If storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

Storage keys are not namespaced automatically. Include a tenant or user
identifier if several users can share a browser profile.

### Relationship to useLocalStorage

Persistence does not use Mantine's `useLocalStorage`. That hook owns a piece of
state and returns `[value, setValue]`, whereas here the table already owns the
state and storage only mirrors it. Routing writes through the hook would keep a
second copy and trigger a React state update on every change, including every
pointer move during a column resize. Its defaults also conflict with this use:
`getInitialValueInEffect: true` delivers the stored value after mount, while
`initialState` is only read on the first render, and `sync: true` would let two
open tabs overwrite each other's column layout.

The option names follow Mantine's `UseStorageOptions` where they apply, and
`storageMode` takes the same values as its `StorageType`.

## Return value

| Field | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | The TanStack table instance. |
| `ui` | `Store<TMDataGridUiState, TMDataGridUiActions>` | State of the filter and column panels. |
| `features` | `TMDataGridFeatureFlags` | Table-level feature switches, re-read from options on each render. See [Features](#features). |
| `renderDetails` | `TMDataGridDetailsRenderer<TData> \| undefined` | The detail renderer, passed through for `TMDataGrid.Table` to call. |
| `renderDetailsEstHeight` | `number` | The estimate, resolved to its default when the option was not set. |
| `overscan` | `number` | The overscan, resolved to its default when the option was not set. |

Both stores are subscribable, which is how a parent component reacts to grid
state without owning it:

```tsx
import { useSelector } from "@tanstack/react-store";

const selectedCount = useSelector(
  grid.table.store,
  (state) => Object.keys(state.rowSelection).length,
);

const filterPanelOpen = useSelector(grid.ui, (state) => state.filterPanelOpen);
```

Read state with `useSelector` rather than accessing `grid.table.store.state`
during render. A direct read does not subscribe the component, so it will not
re-render when the value changes.

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
`cellSelection` — see [Cell selection](#cell-selection). DOM focus follows
`focusedCell` while the grid holds it, scrolling the row into view when it is
off screen.

The last two are called by the header cells while a column is being dragged.
`ui.draggedColumnId` holds the column being moved, because browsers keep
`dataTransfer` unreadable until the drop.

`openColumnFilter(grid, columnId)` combines two steps used by the column menu:
it adds an empty filter row for the column if none exists, then opens the panel.

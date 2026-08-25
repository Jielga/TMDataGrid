# useTMDataGrid

Creates the table instance and the state used by the grid interface.

```tsx
const grid = useTMDataGrid<TData>(options);
// { table, ui, features }
```

Spread the result onto `TMDataGrid`.

## Options

All TanStack `TableOptions` are supported and passed through unchanged,
including `data`, `columns`, `getRowId`, `state` and the `onXChange` callbacks
(see [Controlled state](#controlled-state)), the `manual*` flags and `rowCount`.
The `features` option is supplied internally and cannot be overridden.

`persist`, `enableColumnOrdering`, `enablePagination`, `selectionMode`,
`showSelectedBackground`, `defaultHighlightedRowId`, `onHighlightedRowChange`,
`renderDetails`, `renderDetailsEstHeight`, `overscan`, `cellSelection`,
`onFocusedCellChange`, `quickSearchMode`, `labels` and `editing`
(see [Editing](/docs/editing)) are the grid's own options and are consumed here
rather than forwarded to TanStack.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `TData[]` | – | Row data. When the reference changes the table reprocesses the row models, so keep it stable with `useMemo`. |
| `columns` | `ColumnDef[]` | – | Created with `createTMDataGridColumnHelper`. |
| `getRowId` | `(row, index) => string` | Row index | Used by row selection and virtualization. |
| `enableRowSelection` | `boolean \| (row) => boolean` | `true` | `false` removes row selection and its checkbox column. |
| `selectionMode` | `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` | `"checkbox"` | What selecting looks like and what a bare row click does. Defined by the grid, see [Row selection](/docs/row-selection). |
| `showSelectedBackground` | `boolean` | On for `"row"`, off for `"checkbox"` | Determines whether selected rows take a background tint, coloured by `--dg-row-selected-bg`. Defined by the grid, see [Row selection](/docs/row-selection). |
| `defaultHighlightedRowId` | `string \| null` | – | Row highlighted on mount, under a mode with a highlight. Read once, like `initialState`. |
| `onHighlightedRowChange` | `(rowId: string \| null) => void` | – | Follows the highlighted row, from clicks and from `ui.actions.setHighlightedRow`. |
| `enableSorting` | `boolean` | `true` | Enables sorting for the table. |
| `enableColumnFilters` | `boolean` | `true` | Enables filtering for the table. |
| `enableHiding` | `boolean` | `true` | Enables column visibility for the table. |
| `enableColumnPinning` | `boolean` | `true` | Enables pinning for the table. |
| `enableColumnResizing` | `boolean` | `true` | Enables resizing for the table. |
| `enableColumnOrdering` | `boolean` | `true` | Enables header dragging and the move menu items. Defined by the grid, see [Column layout](/docs/column-layout#ordering). |
| `enablePagination` | `boolean` | `false` | Enables client-side paging and the `Footer` pager. Implied by `manualPagination`. Defined by the grid, see [Pagination](/docs/pagination). |
| `enableRowNumbers` | `boolean` | `false` | The row-number gutter, outermost left. Defined by the grid, see [Row pinning and numbering](/docs/row-pinning). |
| `enableRowPinning` | `boolean \| (row) => boolean` | `false` | Rows can be pinned to sticky edge blocks with `row.pin()`. See [Row pinning and numbering](/docs/row-pinning). |
| `quickSearchMode` | `"fuzzy" \| "contains"` | `"fuzzy"` | How `Search` matches. Fuzzy forgives typos and orders unsorted results by match quality; `"contains"` is plain substring matching. Defined by the grid, see [Quick search](/docs/quick-search). |
| `enableMatchHighlighting` | `boolean` | `false` | Cells mark the matched text while a contains-family filter or the quick search is active. Defined by the grid, see [Quick search](/docs/quick-search#match-highlighting). |
| `renderDetails` | `({ row, table }) => ReactNode` | – | Panel rendered under an expanded row, spanning every column. Setting it turns row details on and adds the pinned chevron lane. Defined by the grid, see [Row details](/docs/row-details). |
| `renderDetailsEstHeight` | `number` | `160` | What the virtualizer assumes for a panel it has not measured yet. Panels are measured once mounted, so an approximation is enough. |
| `cellSelection` | `"none" \| "single" \| "range"` | `"none"` | Cell cursor and, under `"range"`, a selectable rectangle with Ctrl+C and CSV export. Defined by the grid, see [Cell selection](/docs/cell-selection). |
| `onFocusedCellChange` | `(cell: TMDataGridCellPosition \| null) => void` | – | Called whenever the focused cell moves, by key, click or `setFocusedCell`. |
| `overscan` | `number` | `6` | Rows the virtualizer keeps mounted above and below the viewport. Raise it if fast scrolling flashes blank rows, lower it when rows are expensive to render. |
| `columnResizeMode` | `"onChange" \| "onEnd"` | `"onChange"` | Resize update strategy. |
| `initialState` | `Partial<TableState>` | – | The state the grid starts from, read once on mount. Merged over the [grid defaults](#default-initial-state). |
| `state` | `Partial<TableState>` | – | State you hold yourself. Needs the matching `onXChange`, see [Controlled state](#controlled-state). |
| `atoms` | `Partial<Record<slice, Atom>>` | – | TanStack's other way of owning a slice: an atom the table writes through. Outranks `state`. |
| `meta` | `TMDataGridTableMeta` | `{}` | Grid configuration. See [meta](#meta). |
| `persist` | `TMDataGridPersistence` | – | State persistence. See [persist](#persist). |
| `labels` | `TMDataGridLabelsOverride` | English | Overrides for the grid's strings, see [Localization](#localization). |

### Default initial state

| Slice | Default |
| --- | --- |
| `pagination` | `{ pageIndex: 0, pageSize: 25 }`. Inert until pagination is enabled |
| `columnPinning.left` | The checkbox, tree and details columns, followed by any columns you provide |
| `globalFilterFn` | `"tmDataGridFuzzy"`, the fuzzy matcher behind `quickSearchMode`. `"includesString"` under `quickSearchMode: "contains"` |

### Controlled state

`initialState` seeds a slice and hands it to the grid. `state` is the other
half of the pair: the slice stays yours, and the grid reads it back on every
render.

A controlled slice needs the callback that writes to it. TanStack routes every
write through `onXChange`, so a `state` entry passed on its own is frozen at the
value you gave it: the column menu, the filter panel and the pager all still act,
and the next render puts the old value back. The grid says so once, in the
console. Where you only want a starting value, `initialState` is the option.

```tsx
const [columnVisibility, setColumnVisibility] = useState({ play: false });

const grid = useTMDataGrid({
  data,
  columns,
  state: { columnVisibility },
  onColumnVisibilityChange: setColumnVisibility,
});
```

The slices are `columnFilters`, `columnOrder`, `columnPinning`, `columnResizing`,
`columnSizing`, `columnVisibility`, `expanded`, `globalFilter`, `grouping`,
`pagination`, `rowPinning`, `rowSelection` and `sorting`, each with its
`onXChange`. A key set to `undefined` is not controlled - the slice falls back
to the grid's own state, so `sorting: serverDriven ? sorting : undefined` reads
as it looks. `atoms` is TanStack's other route: an atom per slice, written
through directly and needing no callback. A slice named in both is owned by the
atom.

The grid compares a controlled slice structurally between renders, so the
object may be built inline. `Date`s compare by time; a `Map` or class instance
compares by identity, so hold a slice containing one in `useState` or `useMemo`
rather than building it in the render body.

Two things about a controlled `columnVisibility` in particular. The generated
lanes are not yours to hide, so entries naming them are dropped, and the tree
column's entry is the grid's own: it tracks `grouping`, and is re-applied after
whatever your map says. An atom owning the slice gets the same entry written
into it at mount, since `initialState` never reaches a slice the table does not
hold.

[persist](#persist) restores through `initialState`, which a controlled slice
overrides, so it cannot bring one back. It keeps writing the value on the way
out; reading it at mount and passing it in is yours to do.

## meta

Grid configuration, passed through the `meta` option.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | – | Displays a loader while the grid is empty. Takes precedence over every empty state. |
| `noResultsLabel` | `string` | `"No rows match your filters"` | The filtered-empty message. A grid with no data and no filters says `labels.noRows` instead; `renderEmptyState` on the Table replaces both. |
| `rowHeight` | `number` | From `size` | Row height in px. Overrides the size scale. |
| `totalRowCount` | `number` | – | Unfiltered total used by `SummaryCount`. Required for server-side data. |

## Localization

Every string the grid renders - menu items, panels, tooltips, the pager and the
`aria-label`s - comes from one labels object, English by default. The `labels`
option takes any subset and merges it over the defaults:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  labels: { noResults: "Inga rader matchar dina filter" },
});
```

Labels that carry a value are functions, so each language can place the value
where its grammar requires:

```tsx
labels: {
  groupBy: (column) => `Gruppera på ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
}
```

Keep the object referentially stable (module scope or `useMemo`); the grid
re-renders when its identity changes.

The full dictionary type is `TMDataGridLabels`; the English defaults are
exported as `TMDATAGRID_LABELS_EN`, and a complete Swedish dictionary as
`TMDATAGRID_LABELS_SV`:

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

`meta.noResultsLabel` still works as a per-instance override of
`labels.noResults`.

The resolved dictionary is returned from the hook as `grid.labels`, so custom
toolbar components can read the same strings as the built-in parts.

## persist

Restores table state on mount and writes it back on every change. State is
split across two keys: `settingsKey` for the column layout, `dataKey` for
filters, sorting and pagination. Either can be cleared without the other.

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

Payloads carry a version stamp, the exported `PERSIST_PAYLOAD_VERSION`. A
payload from a different version, including anything written by a 0.x build,
which had no stamp, is dropped whole rather than migrated.

Restored state is realigned against the columns that exist. Entries naming a
column removed between deploys are dropped: a stale id in the order, a width for
a column that no longer exists, or a sort or filter that would be active with no
column to show it. New columns need no handling, since TanStack appends columns
missing from `columnOrder` in definition order.

`resetSettings()` on the returned API puts the settings state back to what a
first visit with clean storage would have shown - your `initialState` plus the
structural lanes - and, with persistence configured, writes through to storage
like any other change. The columns panel's **Reset layout** button calls it.
TanStack's own `resetColumnX()` family cannot do it on a persisted grid: those
reset to `initialState`, which the mount built from the restored payload.

All storage access is guarded. If storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

Storage keys are not namespaced automatically. Include a tenant or user
identifier if several users can share a browser profile.

## Return value

| Field | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | The TanStack table instance. |
| `ui` | `Store<TMDataGridUiState, TMDataGridUiActions>` | State of the filter and column panels. |
| `edit` | `TMDataGridEditApi` | The edit engine, inert until `editing` is set. See [Editing](/docs/editing). |
| `features` | `TMDataGridFeatureFlags` | Table-level feature switches, re-read from options on each render. See [Toolbar](/docs/toolbar#reading-options-reactively). |
| `labels` | `TMDataGridLabels` | The resolved label set, overrides merged over English. See [Localization](/docs/localization). |
| `renderDetails` | `TMDataGridDetailsRenderer<TData> \| undefined` | The detail renderer, passed through for `TMDataGrid.Table` to call. |
| `renderDetailsEstHeight` | `number` | The estimate, resolved to its default when the option was not set. |
| `overscan` | `number` | The overscan, resolved to its default when the option was not set. |
| `resetSettings` | `() => void` | Puts the settings state back to a clean first visit. See [persist](#persist). |
| `scrollToRow` | `({ rowId, align? }) => boolean` | Scrolls a row into view; see below. |

### scrollToRow

The grid is always virtualized, so a row far down the list has no element and
`scrollIntoView` has nothing to act on. `scrollToRow` moves the virtualizer
instead:

```ts
grid.scrollToRow({ rowId: "42" });
grid.scrollToRow({ rowId: "42", align: "center" });
```

`align` is TanStack Virtual's: `"auto"` (the default: nearest edge, leaving a
visible row where it is), `"start"`, `"center"` or `"end"`.

It returns whether the row could be reached. `false` means the row is not in the
current view - filtered out, on another page, or an id matching no row - and
nothing scrolled. A pinned row returns `true` without scrolling.

The identity is stable, so it is safe in a dependency array. Before
`TMDataGrid.Table` has mounted there is nothing to scroll and it returns
`false`.

Both stores are subscribable, so a parent component can react to grid state
without holding it:

```tsx
import { useSelector } from "@tanstack/react-store";

const selectedCount = useSelector(
  grid.table.store,
  (state) => Object.keys(state.rowSelection).length,
);

const filterPanelOpen = useSelector(grid.ui, (state) => state.filterPanelOpen);
```

Read state with `useSelector` rather than `grid.table.store.state`. A direct
read does not subscribe the component to the store.

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

`setFocusedCell` and `setCellRange` move the cell cursor and the selected
rectangle under `cellSelection`. See [Cell selection](/docs/cell-selection). DOM
focus follows `focusedCell` while the grid holds it, scrolling the row into view
when it is off screen.

`startColumnDrag` and `endColumnDrag` are called by the header cells while a
column is being dragged. `ui.draggedColumnId` holds the column being moved,
since `dataTransfer` is unreadable until the drop.

`openColumnFilter(grid, columnId)` combines two steps used by the column menu:
it adds an empty filter row for the column if none exists, then opens the panel.

## What each switch removes

Almost every control is bound to the TanStack capability check for its feature,
so setting the standard table or column option removes the corresponding
interface. Empty menus and inactive buttons are never rendered.

Column ordering and pagination are the two exceptions: TanStack ships state and
APIs for both but no `enable` option, so the grid defines `enableColumnOrdering`
(with `meta.enableOrdering`) and `enablePagination` itself. Pagination defaults
to off; ordering, like the options around it, defaults to on.

| Option | Level | Interface removed |
| --- | --- | --- |
| `enableSorting: false` | Table, column | Sort indicator, sort menu items, click-to-sort. See [Sorting](/docs/sorting) |
| `enableColumnFilters: false` | Table | Filter menu item, `FilterButton`, filter panel. See [Filtering](/docs/filtering) |
| `enableColumnFilter: false` | Column | That column's filter menu item and panel entry |
| `enableGlobalFilter: false` | Table, column | `Search`: the whole input at table level, one column's participation at column level |
| `enableHiding: false` | Table, column | Hide column, Manage columns, `ColumnsButton`. See [Column layout](/docs/column-layout) |
| `enableColumnPinning: false` | Table | Pin and unpin menu items. See [Column layout](/docs/column-layout) |
| `enablePinning: false` | Column | That column's pin menu items |
| `enableColumnResizing: false` | Table | Resize dragging, double-click autosize, the Autosize menu item. The divider remains as a separator |
| `enableResizing: false` | Column | That column's resize dragging and autosize |
| `enableColumnOrdering: false` | Table | Header dragging and the move menu items. See [Column layout](/docs/column-layout#ordering) |
| `meta.enableOrdering: false` | Column | That column's header dragging and move menu items |
| `enableRowSelection: false` | Table | The checkbox column |
| `selectionMode: "row"` / `"highlight"` | Table | The checkbox column. The row click selects instead. See [Row selection](/docs/row-selection) |
| `showSelectedBackground: false` | Table | The highlight background on selected rows. Follows the selection mode by default |
| `enablePagination: true` | Table | Opt-in: adds paging and the `Footer` pager. Off by default |
| `enableRowNumbers: true` | Table | Opt-in: the row-number gutter, outermost left. Numbers the current view: sorted, filtered, continuing across pages. Group rows take no number |
| `enableRowPinning: true` | Table | Opt-in: rows can be pinned to sticky edge blocks with `row.pin()`. Also takes a per-row predicate. See [Row pinning](/docs/row-pinning) |
| `enableMatchHighlighting: true` | Table | Opt-in: cells mark the matched text while a contains-family filter or the quick search is active. See [Quick search](/docs/quick-search#match-highlighting) |
| `enableGrouping: false` | Table, column | Group by and Ungroup menu items. See [Grouping](/docs/grouping) |
| `renderDetails` | Table | Opt-in: adds the details lane, and an expanded row opens a panel underneath it. See [Row details](/docs/row-details) |

# Features

> **Live examples:** [Cell selection and export](/examples/cell-selection) · [Pagination](/examples/pagination) · [Quick search](/examples/quick-search)

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
| `enableSorting: false` | Table, column | Sort indicator, sort menu items, click-to-sort. See [Sorting](/docs/sorting) |
| `enableColumnFilters: false` | Table | Filter menu item, `FilterButton`, filter panel. See [Filtering](/docs/filtering) |
| `enableColumnFilter: false` | Column | That column's filter menu item and panel entry |
| `enableGlobalFilter: false` | Table, column | `Search` — the whole input at table level, one column's participation at column level |
| `enableHiding: false` | Table, column | Hide column, Manage columns, `ColumnsButton`. See [Column layout](/docs/column-layout) |
| `enableColumnPinning: false` | Table | Pin and unpin menu items. See [Column layout](/docs/column-layout) |
| `enablePinning: false` | Column | That column's pin menu items |
| `enableColumnResizing: false` | Table | Resize dragging, double-click autosize, the Autosize menu item. The divider remains as a separator |
| `enableResizing: false` | Column | That column's resize dragging and autosize |
| `enableColumnOrdering: false` | Table | Header dragging and the move menu items. See [Column layout](/docs/column-layout#ordering) |
| `meta.enableOrdering: false` | Column | That column's header dragging and move menu items |
| `enableRowSelection: false` | Table | The checkbox column |
| `selectionMode: "row"` / `"highlight"` | Table | The checkbox column — the row click acts instead. See [Row selection](/docs/row-selection) |
| `showSelectedBackground: false` | Table | The highlight background on selected rows. Follows the selection mode by default |
| `enablePagination: true` | Table | Opt-in: adds paging and the `Footer` pager. Off by default |
| `enableRowNumbers: true` | Table | Opt-in: the row-number gutter, outermost left. Numbers the current view — sorted, filtered, continuing across pages; group rows take no number |
| `enableRowPinning: true` | Table | Opt-in: rows can be pinned to sticky edge blocks with `row.pin()`. Also takes a per-row predicate. See [Row pinning](/docs/row-pinning) |
| `enableMatchHighlighting: true` | Table | Opt-in: cells mark the matched text while a contains-family filter or the quick search is active. See [Match highlighting](#match-highlighting) |
| `enableGrouping: false` | Table, column | Group by and Ungroup menu items. See [Grouping](/docs/grouping) |
| `renderDetails` | Table | Opt-in: adds the details lane, and an expanded row opens a panel underneath it. See [Row details](/docs/row-details) |

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
needed; see [Server-side data](/docs/server-side).

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
[Components](/docs/components).

> Client pagination is suspended while the rows are grouped, and the pager greys
> itself out to say so. See [Grouping suspends pagination](/docs/grouping#grouping-suspends-pagination).

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
| `canGroupAny` | At least one leaf column can be grouped on. |
| `canSelectRows` | `enableRowSelection` is not `false` and `selectionMode` is not `"highlight"`. The mode is in `features.selectionMode`. |
| `canPaginate` | `enablePagination` or `manualPagination` is `true`. Configuration, not live state — use `isPagingActive(table, features)` for whether the pager is currently slicing anything, which grouping suspends. |
| `canSearch` | At least one leaf column takes part in the global quick search. |

`getColumnCapabilities(column, features)` returns the same information for a
single column as `canSort`, `canFilter`, `canHide`, `canPin`, `canResize`,
`canReorder` and `canGroup`.

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

## Match highlighting

Opt-in with `enableMatchHighlighting: true`: while a `contains` / `starts
with` / `ends with` column filter or the quick search is active, cells mark
the matched slice of their text. What gets marked is the contiguous,
case-insensitive occurrence of the needle — so under the fuzzy quick search a
typo-match that has no contiguous occurrence simply shows no highlight, which
is the honest answer to what a non-contiguous match "is". Equality operators
highlight nothing: marking the whole cell says nothing the filter did not.

Default-rendered cells only. A column with its own `cell` renderer opts out
by existing — the grid replicates the default value-to-string render with the
marks added, and never rummages inside a custom renderer's output.

The mark colour is `--dg-match-highlight-bg`, a yellow that follows the
Mantine colour scheme by default.

While off — the default — the feature costs one flag check per render.

## Cell selection

Off by default. `cellSelection` turns it on, in one of two modes:

```tsx
const grid = useTMDataGrid({ data, columns, cellSelection: "range" });
```

| Mode | What it gives |
| ---- | ------------- |
| `"none"` | nothing — the default |
| `"single"` | one focused cell, moved with the arrow keys |
| `"range"` | as `"single"`, plus a rectangle of cells, Ctrl+C and the export menu |

Turning it on changes three things about the body. The tab stop moves from the
row to a cell, so the whole grid is one Tab stop and the arrow keys walk it.
The grid reports itself as a `grid` of `gridcell`s rather than a `table` of
`cell`s — which is what tells a screen reader those keys are live. And the
focused cell takes `data-focused`, the selected ones `data-selected` and
`data-edge-*`, which is what the stylesheet paints.

### Keys

| Key | Does |
| --- | --- |
| Arrows | moves one cell, clamped at the edges — no wrapping |
| Shift+arrows | extends the rectangle from its anchor (`"range"`) |
| PageUp / PageDown | moves one viewport of rows |
| Home / End | first / last cell of the row |
| Ctrl+Home / Ctrl+End | first / last cell of the grid |
| Enter or F2 | steps into the cell — its checkbox, link or button |
| Escape | steps back out, or drops the rectangle to the focused cell |
| Space | selects the row, as a row click does under `selectionMode: "row"` |
| Ctrl+C | copies the selection as tab-separated text |

Enter and F2 are the pair a cell editor will take over. Until then they focus
the first control in the cell, and the arrow keys go quiet while the focus is
in there — a cell's contents own their own keys.

### One tab stop

The body is a single tab stop: Tab from a cell leaves the grid, and Shift+Tab
leaves it backwards. What makes that true is that the controls inside body cells
— the checkbox, the tree chevron, the details chevron — take `tabindex="-1"`
while cell selection is on. Left tabbable, Tab would walk through one per
mounted row, and how many that is would depend on the scroll position.

They stay reachable: Enter or F2 steps into the cell, Escape steps back out, and
Space ticks the row from any of its cells without stepping in at all. Header
controls are untouched — the header row is not part of cell navigation, so Tab
is the only way to its sort buttons and menus.

A custom cell with a control in it wants the same treatment:

```tsx
import { useCellControlTabIndex } from "@jielga/tmdatagrid";

const OpenButton = ({ row }) => (
  <Button tabIndex={useCellControlTabIndex()} onClick={() => open(row.id)}>
    Open
  </Button>
);
```

The hook returns `-1` while cell selection is on and `0` otherwise, so the same
cell works either way.

### System lanes

The generated lanes — checkbox, tree, details — are part of the selection: they
take the tint and the outline, so the block stays a rectangle and the arrow keys
still reach the checkbox. They are never exported, since they hold controls
rather than values. A block covering nothing else has nothing to copy, and the
Copy and Export items say so by being disabled.

### Where the selection lives

`ui.state.focusedCell` is a `{ rowId, columnId }` pair and `ui.state.cellRange`
is two of them, the anchor and the moving corner. Ids rather than indices, so
sorting, filtering and column reordering carry the selection with the cells
instead of leaving it over whatever slid into those positions. A range whose
corner is filtered away paints nothing and comes back when the filter lifts.

Move either with `ui.actions.setFocusedCell` / `setCellRange`, follow them with
`onFocusedCellChange`, or read them with `useSelector`:

```tsx
const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);
```

One rectangle at a time. Ctrl+drag for a second, disjoint block is not
supported.

### Copy and export

Ctrl+C puts the selected block on the clipboard as tab-separated text with CRLF
between rows — the format Excel, Sheets and Numbers all put there themselves, so
a paste lands in cells rather than in one column. Values only: Excel's own copy
carries no header row either.

Right-clicking inside the selection opens a menu with **Copy**, **Export as CSV
for Excel** and an **Include headers** toggle. A right-click outside it moves the
selection there first, the way a spreadsheet does. A consumer's `rowContextMenu`
items are appended below a divider, so nothing is lost by turning cell selection
on.

The CSV is written for a Nordic Excel: a `sep=;` first line, a UTF-8 BOM, CRLF
endings, semicolons between fields and a comma as the decimal mark. That
combination is what makes the file open straight into columns with å ä ö intact.
`cellExport` on `TMDataGrid.Table` changes any of it:

```tsx
<TMDataGrid.Table cellExport={{ separator: ",", decimalComma: false, fileName: "employees" }} />
```

The generated lanes — the checkbox, the tree chevron, the details chevron — are
left out of both the clipboard and the file even when the rectangle covers them.
They hold controls, not data.

What gets written is the cell's *value*, not what it renders: a cell renders
React, and often a badge or a link rather than the value. Dates come out in the
`sv-SE` form (`2026-07-31`), which Excel reads as a date.

## Scroll edges

Once body rows scroll under the sticky header, a soft shadow appears along
its bottom edge — the depth cue that says "there are rows above the fold".
Like the pinned-lane gradients it is a scroll-driven animation, tracked on
the compositor with no listener and no render; a grid with nothing to scroll
shows none, and where `animation-timeline` is unsupported the header's border
alone draws the boundary. `--dg-header-shadow-color` recolours it.

`TMDataGrid.Table` also reports edge arrivals — `onScrollToTop`,
`onScrollToBottom`, `onScrollToLeft`, `onScrollToRight` — each firing once
when the scroll reaches that edge. See [Components](/docs/components).

## Pinned column edges

A pinned lane casts a soft band over the data beside it, and only while it is
actually covering something: the band fades in over the first 20px of horizontal
scroll and fades back out as the far end arrives. A grid with nothing to scroll
shows none at all.

It is a scroll-driven animation (`animation-timeline: scroll(nearest inline)`),
so the band tracks the scroll on the compositor with no listener, no state and no
render. Where that is unsupported the band is simply always on, which is what it
was before.

## Virtualization

Always enabled. Only rows within the viewport, plus a small overscan, are
mounted, so page size does not affect how much is rendered.

The overscan — how many rows are kept mounted on each side of the viewport — is
the one knob: `overscan` on `useTMDataGrid`, `6` by default. Raise it if a fast
scroll flashes blank rows, lower it when rows are expensive to render.

Row height is taken from `meta.rowHeight`, or from the `size` prop when it is not
set. Rows are fixed height, so the estimate is exact and scrolling is precise.

`renderDetails` is the exception: a row showing a panel is as tall as the panel,
so those rows are measured after they mount. Nothing else changes — a grid
without `renderDetails` mounts no observers at all.

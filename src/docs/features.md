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
| `enableGlobalFilter: false` | Table, column | `Search` — the whole input at table level, one column's participation at column level |
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
| `enableGrouping: false` | Table, column | Group by and Ungroup menu items. See [Row grouping](#row-grouping) |
| `renderDetails` | Table | Opt-in: adds the details lane, and an expanded row opens a panel underneath it. See [Row details](#row-details) |

### Multi-column sorting

Shift+click a second header to add it to the sort instead of replacing it —
TanStack's own `isMultiSortEvent`, so `enableMultiSort`, `maxMultiSortColCount`
and a custom `isMultiSortEvent` all pass straight through. While more than one
column sorts, each sorted header shows its priority (1, 2, …) beside the
arrow. A plain click still replaces the whole sort, and the menu's Sort items
do the same.

The menu opens from the ⋮ button on the header or from a right-click anywhere on
it — the same items either way, at the pointer for the right-click. A column
whose menu has no remaining items renders no menu button and takes no
right-click, so the browser's own menu comes up there instead. Dividers are
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

> Client pagination is suspended while the rows are grouped, and the pager greys
> itself out to say so. See [Grouping suspends pagination](#grouping-suspends-pagination).

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
| `canSelectRows` | `enableRowSelection` is not `false`. The mode is in `features.rowSelectionMode`. |
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

## Row grouping

**Group by X** in any column menu collapses the rows into a tree. On by default;
nothing changes until a column is picked. Grouping suspends the built-in pager —
see [below](#grouping-suspends-pagination).

Grouping a column removes it from the grid — its values have moved into the tree
lane — and a generated **Group** column appears at the front, pinned beside the
checkbox lane. Each group row shows its value, how many records are under it,
and a chevron. Group again from a second column's menu to nest.

Because a grouped column is no longer in the grid, **Ungroup** lives on the tree
column's menu, one item per grouped column. **Expand all groups** and **Collapse
all groups** are in every column menu while a grouping is active.

```tsx
// Grouped on mount. `grouping` is a settings slice, so a persisted grid comes
// back to the same tree; `expanded` is a data slice.
const grid = useTMDataGrid({
  data,
  columns,
  initialState: { grouping: ["department"] },
});
```

### Aggregation

Off unless asked for. A grouped grid is a tree, not a summary: a group row
leaves every cell blank except the tree lane. Give a column an `aggregationFn`
and it fills in.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  aggregationFn: "sum",
  meta: { type: "number", align: "right" },
});
```

`"sum"`, `"min"`, `"max"`, `"extent"`, `"mean"`, `"median"`, `"unique"`,
`"uniqueCount"` and `"count"` are registered, as is `"auto"` — which picks `sum`
for numbers and `extent` for dates. A function is accepted too. Pass
`aggregatedCell` to render the group row's value differently from the data rows.

> TanStack's grouping feature defaults every column to `aggregationFn: "auto"`.
> The grid clears that default so grouping does not silently start summing
> numeric columns. Setting `aggregationFn: "auto"` yourself restores it.

Grouping runs before sorting, so sorting a grouped grid sorts the rows inside
each group and orders the groups by their aggregated value. A column with no
aggregation has no value on a group row, so sorting on it reorders the rows
within each group but leaves the groups where they are.

### Selection

A group row's checkbox selects every record under it, at any depth, including
records inside collapsed sub-groups. It shows a tick once all of them are
selected and a dash while only some are. Only the records are written to
`rowSelection` — a group row is never in it, so `getSelectedRowModel()` and the
toolbar count are unaffected by how the tree is arranged.

Under `enableMultiRowSelection: false` group rows carry no checkbox: one box
cannot stand for several rows.

### Group rows and row clicks

A group row does not fire `onRowClick` and cannot be highlighted. TanStack builds
it on top of its first child's record, so a click would hand you a real-looking
row that is the wrong one. Rows carry `data-grouped` and `data-depth` for
styling, and `--dg-row-group-bg` sets their background.

### Grouping suspends pagination

**Grouping and the built-in pager do not work together, and grouping wins.** As
soon as a column is grouped the grid renders the whole tree and relies on
virtualization; `TMDataGrid.Footer` greys its pager out, replaces the range with
`Grouped · all N rows`, and explains itself on hover. Ungroup and paging resumes
where it left off.

This is deliberate rather than a limitation worked around. A page can only count
one kind of thing, and once the rows are a tree neither answer is usable:

- Counting **every row** splits a group across a page boundary, so opening one
  group fills the page with its children and strands every group after it on
  pages the user has to go looking for.
- Counting **top-level rows** quietly redefines "rows per page" as groups per
  page, so a page of 25 can hold thousands of rows and the number in the footer
  stops meaning anything.

Rendering the whole tree is also the grid's default mode — pagination is the
opt-in — so nothing is lost but the pager.

If you need both, page on the server: group the rows there and feed the grid one
page of a tree at a time with `manualPagination` and `manualGrouping`.

`isPagingActive(table, features)` is exported, so a custom pager can grey itself
out the same way:

```tsx
import { getTMDataGridPaginationApi, isPagingActive } from "./tmdatagrid";

<TMDataGrid.Footer
  pagination={(api) => <MyPager {...api} disabled={!isPagingActive(table, features)} />}
/>
```

### Server-side grids

`manualPagination: true` turns grouping off, because the client holds one page
and would build groups out of an arbitrary slice. A grid that groups server-side
can set `enableGrouping: true` alongside `manualGrouping: true`.

To keep a grouped column in the grid instead of removing it, pass
`groupedColumnMode: "reorder"` — TanStack's own default, which moves grouped
columns to the front rather than taking them out.

## Row details

Set `renderDetails` and the grid grows a chevron lane; expanding a row opens a
panel underneath it, spanning every column:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
});
```

The panel is as tall as whatever it renders — the grid measures each one, so
nothing has to be uniform. `renderDetailsEstHeight` (default `160`) is only what
the virtualizer assumes for a panel it has not seen yet, which keeps the
scrollbar honest for rows that open off screen.

### The details lane

Setting `renderDetails` prepends a generated chevron column, `DETAILS_COLUMN_ID`
(`"__details__"`), pinned to the left after the checkbox and tree columns —
`[checkbox, tree, details, …]`. It comes last of the three because it acts on
one record: the checkbox picks rows out and the tree says which group they are
in, and only then is there a row to open.

Like the other two it is structural: fixed width, and it cannot be hidden,
moved, resized or unpinned — a toggle that wandered to the far right, or hid
itself, would leave rows with panels no one can open.

It is a system lane: as wide as the chevron it holds, with no resize handle and
no column menu — its header is a control rather than a title. The chevron there
expands and collapses every panel, the way the checkbox column's header selects
and clears every row.

Group rows get no chevron: they expand into their children from the tree lane.

### The two kinds of expanding

TanStack keeps one `expanded` state, and the grid opens two unrelated things out
of it — a group row into its children, a data row into its panel. The controls
are kept apart all the same: the details header only opens and closes panels,
and "Expand all groups" in the tree menu only unfolds the tree. Neither disturbs
what the other was showing.

`table.toggleAllRowsExpanded()` is the one that does not distinguish them: it
writes the state's whole-table form, which is every group and every panel at
once. `resolveExpandAll` and `areAllRowsExpanded` are exported for anything
building its own control:

```tsx
table.setExpanded(
  resolveExpandAll({
    rows: table.getPrePaginatedRowModel().flatRows,
    expanded: table.store.state.expanded,
    target: "details",
    expand: true,
  }),
);
```

### Opening a row from elsewhere

Which rows are open is TanStack's own `expanded` state, so anything can open one
— a context menu item, a double-click, a button in your own cell:

```tsx
<Menu.Item onClick={() => row.toggleExpanded()}>Show details</Menu.Item>
```

Anything that *reads* `row.getIsExpanded()` inside a cell has to subscribe to the
store (`useSelector(row.table.store, () => row.getIsExpanded())`), or the React
Compiler will cache the call along with the `row` identity and the control will
never update.

Because it is the standard state, everything around it comes free:
`table.toggleAllRowsExpanded()`, `initialState.expanded`, and persistence — it is
one of the `data` slices, so open panels survive a reload where the grid is
persisted.

### What the panel is and is not

The panel is a cell spanning the row, inside the row element. So it takes the
row's background, moves with it, and is measured with it — but it is not a row:
`aria-rowcount` still counts records, and a click or right-click inside it stops
there rather than selecting or highlighting the row underneath. It carries
`data-testid="dg-details-<rowId>"`.

Group rows have no panel. Expanding one opens its children, and the record a
group row is built from is an arbitrary one of them — the same reason group rows
sit out `onRowClick`.

Details and `selectionMode: "highlight"` answer the same question differently.
A panel keeps the record in place and in context, which suits a handful of
fields or an action strip; a highlight-driven side panel has more room and stays
put while the grid scrolls. A grid can do both.

> TanStack resets `expanded` when the row structure changes, so replacing `data`
> closes open panels. Pass `autoResetExpanded: false` to keep them.

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

## Summary row

Give a column a `footer` and the grid grows a sticky row along its bottom edge
— TanStack's own column option, rendered by the grid the way the header is.
No flag: the row exists exactly when at least one visible column defines a
`footer`, and each cell renders that column's renderer with the header
context.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  footer: ({ table }) =>
    sek(Number(aggregateColumn({ table, columnId: "salary" }))),
});
```

`aggregateColumn({ table, columnId, fn })` computes over every *filtered* row
— all pages, following the filters live — through the registered aggregation
functions (`fn` defaults to `"sum"`). A `footer` can equally render anything:
a static label, a count, its own calculation.

Pinned columns keep their lanes in the summary row, and the row sits under
the pinned-lane gradients on the stacking ladder. The generated lanes define
no `footer`, so their summary cells stay blank.

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

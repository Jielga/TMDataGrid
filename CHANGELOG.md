# @jielga/tmdatagrid

## 0.5.0

### Minor Changes

- [`394b6c3`](https://github.com/Jielga/TMDataGrid/commit/394b6c380ae74969b233f7a5c144dbf327e2e3fa) Thanks [@Psvensso](https://github.com/Psvensso)! - Column autosizing: double-click the resize divider, an Autosize menu item, `meta.autoSize`, and an exported `autosizeColumn` helper.

- [`d0c6e0f`](https://github.com/Jielga/TMDataGrid/commit/d0c6e0f09250df9820a6daab8a3929573fdaa2d1) Thanks [@Psvensso](https://github.com/Psvensso)! - Cell selection: `cellSelection: "single"` gives the body a cell cursor moved
  with the arrow keys, `"range"` adds a rectangle selected by dragging, Shift+click
  or Shift+arrows. Ctrl+C copies the block as tab-separated text, so a paste lands
  in Excel's cells, and right-clicking it offers an Excel-compatible CSV export
  with an optional header row.

  The state is `ui.state.focusedCell` and `ui.state.cellRange`, both held as
  `{ rowId, columnId }` pairs. On, the grid reports `role="grid"` with `gridcell`
  children and the body becomes one tab stop: controls inside body cells take
  `tabindex="-1"`, reached with Enter or F2 instead. `useCellControlTabIndex()`
  does the same for a custom cell's controls.

  The generated lanes are selectable and navigable but never exported. Space ticks
  the row from any of its cells, which is what the checkbox's lost tab stop is
  replaced with.

- [`d399522`](https://github.com/Jielga/TMDataGrid/commit/d39952276c6bead9d63cef9bf6d1519436b73046) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `TMDataGrid.Search`, a debounced quick-search input over the global filter, plus a `canSearch` capability.

- [`2a50690`](https://github.com/Jielga/TMDataGrid/commit/2a506907a38f011a58d5476d4f0db7025016215d) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `buildGridCellMatrix` and `exportGridToCsv` for exporting the whole filtered grid, all pages, to Excel CSV.

- [`8f51c2a`](https://github.com/Jielga/TMDataGrid/commit/8f51c2a1c0db69b116a3ff720b945e4ee1740d56) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `onReachEnd` on `TMDataGrid.Table` for infinite scroll, with a demo page.

- [`c876388`](https://github.com/Jielga/TMDataGrid/commit/c876388e0e73014b0230b9aea3879861c6d2baa8) Thanks [@Psvensso](https://github.com/Psvensso)! - Add a `labels` option: every string in the grid can be overridden, merged over the English defaults (`TMDATAGRID_LABELS_EN`).

- [`1072980`](https://github.com/Jielga/TMDataGrid/commit/10729801e4b3c01354a13252fcecbdf8e744b6ae) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `TMDataGrid.LoadingIndicator`, a toolbar spinner for refetches that keep rows on screen.

- [`f9809e5`](https://github.com/Jielga/TMDataGrid/commit/f9809e5a3c6b442f913225c208f2e935fc2d9753) Thanks [@Psvensso](https://github.com/Psvensso)! - Shift+click adds a column to the sort; sorted headers show their priority while more than one column sorts.

- [`6503e7d`](https://github.com/Jielga/TMDataGrid/commit/6503e7ddfa5f6e2854dbd93a64ca5bece606a14c) Thanks [@Psvensso](https://github.com/Psvensso)! - Render a sticky summary row from column `footer` definitions, with an `aggregateColumn` helper over the filtered rows.

- [`df00c06`](https://github.com/Jielga/TMDataGrid/commit/df00c06ef06f59d1d8758abb4f0ad36684a277c6) Thanks [@Psvensso](https://github.com/Psvensso)! - Ship a complete Swedish dictionary as `TMDATAGRID_LABELS_SV`.

- [`9a47802`](https://github.com/Jielga/TMDataGrid/commit/9a478022331a53498d378df80fe458db53dec729) Thanks [@Psvensso](https://github.com/Psvensso)! - Column types boolean, date, select and multiSelect, with typed filter operators and value controls; `meta.options` + `resolveColumnOptions`. `TMDataGridFilterValue.value` widens to `string | ReadonlyArray<string>`.

### Patch Changes

- [`883579d`](https://github.com/Jielga/TMDataGrid/commit/883579d8d8ce5c0203806451d3227fc931fab095) Thanks [@Psvensso](https://github.com/Psvensso)! - Right-clicking a column header opens the same menu as the ⋮ button, at the
  pointer. Headers without a menu — the checkbox and details lanes — keep the
  browser's own.

## 0.4.0

### Minor Changes

- [`e6d35bf`](https://github.com/Jielga/TMDataGrid/commit/e6d35bf988e39d09887ff7b5b4e96372cb9fc583) Thanks [@Psvensso](https://github.com/Psvensso)! - `overscan` on `useTMDataGrid` sets how many rows the virtualizer keeps mounted
  above and below the viewport. Defaults to 6, the value that was hard-coded.

- [#8](https://github.com/Jielga/TMDataGrid/pull/8) [`da5da07`](https://github.com/Jielga/TMDataGrid/commit/da5da07db6d682f1e48dc44c5c36791249ea88f6) Thanks [@Psvensso](https://github.com/Psvensso)! - Row details: set `renderDetails` and an expanded row opens a panel underneath
  it, spanning every column. Panels are measured, so they can be any height —
  `renderDetailsEstHeight` is only what the virtualizer assumes before it has seen
  one. The option also adds a generated chevron lane (`DETAILS_COLUMN_ID`), pinned
  left after the checkbox and tree columns, whose header expands and collapses
  every panel.

  `resolveExpandAll` and `areAllRowsExpanded` are exported for building your own
  expand-all: TanStack keeps one `expanded` state for both group rows and detail
  panels, and these keep a control for one from disturbing the other.

  The checkbox and details lanes are now 36px and render no resize handle, and
  their cells carry `data-control-column` in place of `data-select-column`. Pinned
  column edges only show while they are covering something, and no longer draw a
  hard border.

## 0.3.0

### Minor Changes

- [#7](https://github.com/Jielga/TMDataGrid/pull/7) [`254709d`](https://github.com/Jielga/TMDataGrid/commit/254709d01df66936bedf1b2ac11bcc45eda13f5a) Thanks [@Psvensso](https://github.com/Psvensso)! - Filter panel: a "Filters" header with a close button, Escape and a click outside
  to dismiss, and a "Clear all" next to "Add filter", which is now disabled once
  every filterable column has a filter.

  New `TMDataGrid.FilterPills` (also exported as `TMDataGridFilterPills`) — one
  pill per active filter, `First name: Sofia ✕`, with the ✕ clearing that filter
  and a click on the label reopening the panel on its column. It takes the grid as
  an `api` prop instead of reading context, so it can be rendered outside the
  grid. `formatFilterLabel` is exported for building your own.

- [#6](https://github.com/Jielga/TMDataGrid/pull/6) [`9f39544`](https://github.com/Jielga/TMDataGrid/commit/9f39544ac48f8fc1f20e656aa79ebe9d364ab719) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `rowContextMenu` to `TMDataGrid.Table`: a render prop that fills a Mantine
  `Menu` the grid opens at the pointer on a right-click or long press. It receives
  `{ table, row, cell, close }`, and returning `null` leaves a row without a menu.
  `rowContextMenuProps` passes through to the `Menu`. The open row carries
  `data-context-menu`.

- [#7](https://github.com/Jielga/TMDataGrid/pull/7) [`040e4b3`](https://github.com/Jielga/TMDataGrid/commit/040e4b3f49c2f1f7be285ee299a568629d7bce88) Thanks [@Psvensso](https://github.com/Psvensso)! - Row grouping. **Group by X** in any column menu collapses the rows into a tree;
  the grouped column leaves the grid and a generated **Group** column takes its
  place, pinned beside the checkbox lane, showing each group's value, its record
  count and a chevron. Group from a second menu to nest. **Ungroup** lives on the
  tree column's menu, and **Expand/Collapse all groups** in every column menu. On
  by default, off under `manualPagination`; `enableGrouping: false` disables it.

  Aggregation is opt-in — a group row is blank until a column declares an
  `aggregationFn`. A group's checkbox selects every record under it at any depth,
  and only the records reach `rowSelection`. `grouping` persists with the settings
  slices, `expanded` with the data slices.

  Grouping suspends the built-in pager, which greys itself out rather than
  disappearing: a page cannot count both rows and groups without stranding part of
  the tree. `isPagingActive` is exported for custom pagers.

  Also fixes a hidden column leaving an empty grid track behind, from the column
  tracks being built from all leaf columns while the cells came from the visible
  ones.

- [#4](https://github.com/Jielga/TMDataGrid/pull/4) [`f947272`](https://github.com/Jielga/TMDataGrid/commit/f947272d7db6bcf78464050a89359f96ce57bacc) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `selectionMode`, replacing `rowSelectionMode`: `"checkbox"` (the default),
  `"row"`, `"checkboxAndHighlight"` and `"highlight"`. The last two introduce a
  highlighted row — state of its own, so a checkbox multi-selection and a single
  highlighted row can coexist for a detail panel. Row-click selection gains the
  usual Ctrl/Shift modifiers, and the select-all box is dropped under
  `enableMultiRowSelection: false`, where it selected every row.

  Breaking renames:

  - `rowSelectionMode` → `selectionMode` (`"checkbox"` and `"row"` unchanged)
  - `highlightSelectedRows` → `showSelectedBackground`
  - `data-highlighted` → `data-selected-bg`; `data-highlighted` now marks the
    highlighted row
  - New `--dg-row-highlight-bg` alongside `--dg-row-selected-bg`

### Patch Changes

- [#7](https://github.com/Jielga/TMDataGrid/pull/7) [`620a739`](https://github.com/Jielga/TMDataGrid/commit/620a739e10f3d73e77c5bd61aafd73721d4d226a) Thanks [@Psvensso](https://github.com/Psvensso)! - Fix the checkbox being clipped in the select column at `size="xl"`. The column
  is a fixed 48px track, which the cell padding — 18px a side at `xl` — left too
  little room for. It no longer takes that padding and centres its box instead.

## 0.2.0

### Minor Changes

- [`c98a857`](https://github.com/Jielga/TMDataGrid/commit/c98a85747a03b8cfc36aa859aa40a61190f320e9) Thanks [@Psvensso](https://github.com/Psvensso)! - Make pagination opt-in via `enablePagination` (implied by `manualPagination`);
  by default all rows render, virtualized. `TMDataGrid.Footer` gains a
  `pagination` render prop for custom pagers.

- [`c98a857`](https://github.com/Jielga/TMDataGrid/commit/c98a85747a03b8cfc36aa859aa40a61190f320e9) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `rowSelectionMode`. `"checkbox"` (the default) keeps the checkbox column;
  `"row"` drops it and toggles a row on click. `highlightSelectedRows` controls
  the selected-row background and follows the mode. Fixes the selection
  checkboxes not re-rendering when a row was selected.

### Patch Changes

- [`20c68ee`](https://github.com/Jielga/TMDataGrid/commit/20c68eeaa7d4ba9034f1c49b59ac253619da9e8b) Thanks [@Psvensso](https://github.com/Psvensso)! - Debounce persistence writes so a column resize no longer writes to storage on
  every pointer move, and drop restored state that fails a shape check instead of
  feeding it to the table. The footer's page-size Select now keeps a current size
  that is not in `pageSizeOptions` rather than rendering blank, and headers expose
  `aria-sort` alongside `aria-rowcount` / `aria-colcount` / `aria-rowindex` on the
  virtualized grid.

## 0.1.0

### Minor Changes

- [`e8090a4`](https://github.com/Jielga/TMDataGrid/commit/e8090a480f1fd944edecace2fd7d415b20b84244) Thanks [@Psvensso](https://github.com/Psvensso)! - Add column reordering. Drag a header to move a column, or move it a step at a
  time from the column menu. Order is respected per pinned region and persists
  through the `columnOrder` slice.

- [`280baf8`](https://github.com/Jielga/TMDataGrid/commit/280baf89e98c6cd5be087273c6532d3df3dcce3a) Thanks [@Psvensso](https://github.com/Psvensso)! - Ship agent skills with the package via TanStack Intent. Five skills under
  `skills/` — getting started, columns, options, features and server-side data —
  are published in the tarball, so coding agents read current guidance for the
  installed version straight from `node_modules` instead of relying on whatever
  their training data happened to include.

# @jielga/tmdatagrid

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

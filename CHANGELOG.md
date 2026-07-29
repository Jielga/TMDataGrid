# @jielga/tmdatagrid

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

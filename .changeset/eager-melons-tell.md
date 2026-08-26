---
"@jielga/tmdatagrid": patch
---

Fixed: a controlled `state` slice built inline in the render body caused an
infinite render loop. TanStack compares `options.state` slices by identity on
every render; the grid now forwards the previous render's value for a slice
whose contents are unchanged.

- A controlled slice passed without its `onXChange` logs a console warning in
  development. Without the callback the slice cannot change; use
  `initialState` for a starting value.
- A controlled `columnVisibility` no longer hides the generated columns. The
  tree column's entry is managed by the grid and follows `grouping`.
- The tree column's visibility entry is seeded into an external
  `atoms.columnVisibility` at mount. Previously the tree column rendered empty
  in an ungrouped grid when an atom owned the slice.
- A `state` key set to `undefined` is ignored instead of being written into
  the table state.
- `Date` values in controlled state compare by time.

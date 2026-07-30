---
"@jielga/tmdatagrid": minor
---

Row grouping. **Group by X** in any column menu collapses the rows into a tree;
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

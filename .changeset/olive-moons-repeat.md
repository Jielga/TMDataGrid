---
"@jielga/tmdatagrid": minor
---

Generated lanes are no longer user settings.

- The checkbox and edit lanes are `enableHiding: false`, like the other three.
- "Manage columns" lists only hideable columns; a column with
  `enableHiding: false` is left out rather than shown disabled.
- Show/hide all writes only the columns it lists. It used
  `table.toggleAllColumnsVisible`, which writes every leaf column: "show all"
  published the tree column and "hide all" forced it visible.
- A column pinned right lands to the left of the edit lane.
- A stale `columnVisibility` entry for a generated lane - persisted before
  this release, or passed in `initialState` - is dropped at mount and on
  Reset layout, since nothing in the grid could bring the lane back.

New export: `keepGeneratedColumnsOutermost`, `isGeneratedColumn`.

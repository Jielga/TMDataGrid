---
"@jielga/tmdatagrid": minor
---

Cell selection: `cellSelection: "single"` gives the body a cell cursor moved
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

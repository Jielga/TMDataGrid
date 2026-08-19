---
name: cell-selection
description: >
  Cell cursor, ranges, clipboard and CSV export in TMDataGrid. Covers the
  cellSelection option and its none / single / range modes, the keyboard map
  (arrows, Shift+arrows, PageUp/PageDown, Home/End, Enter, F2, Escape, Space,
  Ctrl+C), the one-tab-stop rule and useCellControlTabIndex for controls inside
  cells, the role flip from table/cell to grid/gridcell, ui.state.focusedCell
  and ui.state.cellRange keyed by id, onFocusedCellChange, the copy and export
  context menu, the cellExport options and their Nordic Excel defaults, and
  exportGridToCsv over every filtered row. Load when adding keyboard cell
  navigation, selecting blocks of cells, copying to a spreadsheet, exporting
  CSV, or when Tab walks through controls inside the grid body.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.1.0'
sources:
  - 'Jielga/TMDataGrid:src/docs/cell-selection.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/cellNavigation.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/cellRange.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/cellExport.ts'
---

# TMDataGrid - Cell selection

A cell cursor the arrow keys move, a rectangle of cells that can be dragged out,
and a Ctrl+C that pastes into Excel as cells rather than as one string. Off by
default.

```tsx
const grid = useTMDataGrid({ data, columns, cellSelection: "range" });
```

| Mode | What it gives |
| --- | --- |
| `"none"` (default) | Nothing |
| `"single"` | One focused cell, moved with the arrow keys |
| `"range"` | As `"single"`, plus a rectangle, Ctrl+C and the export menu |

Setting `editMode` defaults `cellSelection` to `"single"`, since editing
navigates by cursor. An explicit `cellSelection` always wins.

Turning it on changes three things about the body:

- The tab stop moves from the row to a cell, so the whole grid is **one** Tab
  stop and the arrow keys walk it.
- The grid reports itself as a `grid` of `gridcell`s rather than a `table` of
  `cell`s, which is what tells a screen reader those keys are live.
- The focused cell takes `data-focused`, selected ones `data-selected` and
  `data-edge-*`.

## Keys

| Key | Does |
| --- | --- |
| Arrows | Moves one cell, clamped at the edges, no wrapping |
| Shift+arrows | Extends the rectangle from its anchor (`"range"`) |
| PageUp / PageDown | Moves one viewport of rows |
| Home / End | First / last cell of the row |
| Ctrl+Home / Ctrl+End | First / last cell of the grid |
| Enter or F2 | Steps into the cell - its checkbox, link or button |
| Escape | Steps back out, or drops the rectangle to the focused cell |
| Space | Selects the row, as a row click does under `selectionMode: "row"` |
| Ctrl+C | Copies the selection as tab-separated text |

Enter and F2 are the pair a cell editor takes over. Until then they focus the
first control in the cell, and the arrow keys go quiet while focus is in there -
a cell's contents own their own keys.

## One tab stop

Tab from a cell leaves the grid. What makes that true is that controls inside
body cells - the checkbox, the tree chevron, the details chevron - take
`tabindex="-1"` while cell selection is on. Left tabbable, Tab would walk through
one per mounted row, and how many that is depends on the scroll position.

They stay reachable: Enter or F2 steps in, Escape steps out, and Space ticks the
row from any of its cells. Header controls are untouched - the header row is not
part of cell navigation.

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

## Where the selection lives

`ui.state.focusedCell` is a `{ rowId, columnId }` pair, and `ui.state.cellRange`
is two of them, the anchor and the moving corner. **Ids rather than indices**, so
sorting, filtering and column reordering carry the selection with the cells
instead of leaving it over whatever slid into those positions. A range whose
corner is filtered away paints nothing, and comes back when the filter lifts.

```tsx
const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);

grid.ui.actions.setFocusedCell({ rowId: "42", columnId: "salary" });
```

One rectangle at a time; Ctrl+drag for a second, disjoint block is not
supported.

The generated lanes (checkbox, tree, details) are part of the selection - they
take the tint and the outline so the block stays a rectangle - but are never
*exported*, since they hold controls rather than values. A block covering
nothing else has nothing to copy, and the Copy and Export items say so by being
disabled.

## Copy and export

Ctrl+C puts the block on the clipboard as tab-separated text with CRLF between
rows, the format Excel, Sheets and Numbers all produce themselves. Values only:
Excel's own copy carries no header row either.

Right-clicking inside the selection opens Copy, "Export as CSV for Excel" and an
"Include headers" toggle. A right-click outside it moves the selection there
first, the way a spreadsheet does. Your own `renderRowContextMenu` items are appended
below a divider, so nothing is lost by turning cell selection on.

The CSV is written for a Nordic Excel: a `sep=;` first line, a UTF-8 BOM, CRLF
endings, semicolons between fields and a comma as the decimal mark. That
combination is what makes the file open straight into columns with å ä ö intact.

```tsx
<TMDataGrid.Table
  cellExport={{ separator: ",", decimalComma: false, fileName: "employees" }}
/>
```

What gets written is the cell's **value**, not what it renders. Dates come out
in the `sv-SE` form (`2026-07-31`), which Excel reads as a date.

`exportGridToCsv({ table, options })` takes **every filtered row** instead of the
selected block, with the same options and defaults. There is no built-in button
for it:

```tsx
<Button onClick={() => exportGridToCsv({ table: grid.table })}>Export</Button>
```

## Common mistakes

### CRITICAL A custom cell control that breaks the single tab stop

A `<Button>` or `<Checkbox>` rendered in a body cell keeps its default tab index,
so Tab walks through one per mounted row. How many that is depends on the scroll
position, which makes the bug look intermittent.

Wrong:

```tsx
const OpenButton = ({ row }) => <Button onClick={() => open(row.id)}>Open</Button>;
```

Correct:

```tsx
const OpenButton = ({ row }) => (
  <Button tabIndex={useCellControlTabIndex()} onClick={() => open(row.id)}>
    Open
  </Button>
);
```

Source: `src/docs/cell-selection.md` (One tab stop).

### HIGH Selectors written for `table` / `cell` roles

The grid reports `grid` and `gridcell` once cell selection is on, so a test or a
query written against `getByRole("cell")` stops resolving the moment the option
is set - including when `editMode` turns it on implicitly.

Source: `src/docs/cell-selection.md`, and the `testing` skill.

### HIGH Reading the selection as row and column indices

`focusedCell` and `cellRange` hold `{ rowId, columnId }`. Code that converts them
to indices to look values up gets the wrong cell after any sort, filter or column
move - which is exactly what ids were chosen to avoid.

Correct:

```tsx
const row = grid.table.getRow(focusedCell.rowId);
const value = row.getValue(focusedCell.columnId);
```

Source: `src/docs/cell-selection.md` (Where the selection lives).

### MEDIUM Expecting the export to match what the cells show

A cell renders React - often a badge, a link or a formatted string - and the
export writes the underlying value. A currency cell showing `32 000 kr` exports
`32000`. Format in the data, or post-process the matrix from `buildCellMatrix`,
if the file must match the screen.

Source: `src/docs/cell-selection.md` (The CSV).

### MEDIUM Expecting headers in the clipboard

Ctrl+C copies values only, matching Excel's own copy. Headers are an option of
the export menu and of `cellExport`, not of the clipboard path.

Source: `src/docs/cell-selection.md` (Copy and export).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `cellSelection` | Option | `"none" \| "single" \| "range"` | `"none"`, or `"single"` under `editMode` | Turns the cursor, and the rectangle, on. |
| `onFocusedCellChange` | Callback | `(cell \| null) => void` | – | Follows the cursor. |
| `cellExport` | Table prop | `TMDataGridCellExportOptions` | Nordic Excel | Separator, decimal mark, headers, file name. |
| `ui.state.focusedCell` | UI state | `{ rowId, columnId } \| null` | `null` | The cursor. |
| `ui.state.cellRange` | UI state | `{ anchor, focus } \| null` | `null` | The rectangle's two corners. |
| `ui.actions.setFocusedCell` · `setCellRange` | UI actions | – | – | Move either from your own code. |
| `useCellControlTabIndex` | Hook | `() => 0 \| -1` | – | The tab index a control inside a body cell wants. |
| `exportGridToCsv` | Export | `({ table, options? }) => void` | – | Downloads every filtered row as CSV. |
| `buildGridCellMatrix` · `buildCellMatrix` | Exports | – | – | The value matrix behind the file, for post-processing. |
| `toClipboardText` · `toExcelCsv` · `writeClipboardText` · `downloadTextFile` | Exports | – | – | The pieces behind Ctrl+C and the file. |
| `formatExportValue` | Export | `(value, options) => string` | – | One value, formatted as the export would. |
| `DEFAULT_CELL_EXPORT_OPTIONS` | Export | object | – | The Nordic Excel defaults, to spread over. |
| `isSameCell` · `resolveCellMove` | Exports | – | – | The cursor arithmetic, for a custom navigator. |
| `resolveRangeBounds` · `isWithinBounds` · `boundsEdges` · `boundsCellCount` | Exports | – | – | The rectangle arithmetic. |
| `data-focused` | Data attribute | – | – | On the focused cell. |
| `data-edge-top` · `-bottom` · `-left` · `-right` | Data attributes | – | – | On cells at the rectangle's border. |

See also: the `editing` skill, which turns this on implicitly and takes over
Enter and F2, and the `rows` skill for `renderRowContextMenu`, whose
`internalItems` are exactly the copy and export items described here.

# Cell selection, copy and export

A cell cursor the arrow keys move, a rectangle of cells you can drag out, and
Ctrl+C that pastes into Excel as cells rather than as one string. Off by
default - `cellSelection` turns it on.

```tsx
const grid = useTMDataGrid({ data, columns, cellSelection: "range" });
```

| Mode | What it gives |
| ---- | ------------- |
| `"none"` | Nothing - the default |
| `"single"` | One focused cell, moved with the arrow keys |
| `"range"` | As `"single"`, plus a rectangle of cells, Ctrl+C and the export menu |

```demo
file: cells/CellSelection.tsx
hint: Tab into the grid, then arrows to move · Shift+arrows or drag to select a block. However many cells it holds, the whole grid is one tab stop.
```

Turning it on changes three things about the body. The tab stop moves from the
row to a cell, so the whole grid is **one** Tab stop and the arrow keys walk it.
The grid reports itself as a `grid` of `gridcell`s rather than a `table` of
`cell`s - which is what tells a screen reader those keys are live. And the
focused cell takes `data-focused`, the selected ones `data-selected` and
`data-edge-*`, which is what the stylesheet paints.

## Keys

| Key | Does |
| --- | --- |
| Arrows | Moves one cell, clamped at the edges - no wrapping |
| Shift+arrows | Extends the rectangle from its anchor (`"range"`) |
| PageUp / PageDown | Moves one viewport of rows |
| Home / End | First / last cell of the row |
| Ctrl+Home / Ctrl+End | First / last cell of the grid |
| Enter or F2 | Steps into the cell - its checkbox, link or button |
| Escape | Steps back out, or drops the rectangle to the focused cell |
| Space | Selects the row, as a row click does under `selectionMode: "row"` |
| Ctrl+C | Copies the selection as tab-separated text |

Enter and F2 are the pair a [cell editor](/docs/editing) takes over. Until then
they focus the first control in the cell, and the arrow keys go quiet while the
focus is in there - a cell's contents own their own keys.

## One tab stop

Tab from a cell leaves the grid, and Shift+Tab leaves it backwards. What makes
that true is that the controls inside body cells - the checkbox, the tree
chevron, the details chevron - take `tabindex="-1"` while cell selection is on.
Left tabbable, Tab would walk through one per mounted row, and how many that is
would depend on the scroll position.

They stay reachable: Enter or F2 steps into the cell, Escape steps back out, and
Space ticks the row from any of its cells without stepping in at all. Header
controls are untouched - the header row is not part of cell navigation, so Tab
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

## Where the selection lives

`ui.state.focusedCell` is a `{ rowId, columnId }` pair, and `ui.state.cellRange`
is two of them - the anchor and the moving corner. **Ids rather than indices**,
so sorting, filtering and column reordering carry the selection with the cells
instead of leaving it over whatever slid into those positions. A range whose
corner is filtered away paints nothing, and comes back when the filter lifts.

Move either with `ui.actions.setFocusedCell` / `setCellRange`, follow them with
`onFocusedCellChange`, or read them with `useSelector`:

```tsx
const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);
```

One rectangle at a time. Ctrl+drag for a second, disjoint block is not
supported.

### System lanes

The generated lanes (checkbox, tree, details) are part of the selection: they
take the tint and the outline, so the block stays a rectangle and the arrow keys
still reach the checkbox. They are never *exported*, since they hold controls
rather than values. A block covering nothing else has nothing to copy, and the
Copy and Export items say so by being disabled.

## Copy and export

Ctrl+C puts the selected block on the clipboard as tab-separated text with CRLF
between rows - the format Excel, Sheets and Numbers all put there themselves, so
a paste lands in cells rather than in one column. Values only: Excel's own copy
carries no header row either.

```demo
file: cells/CopyAndExport.tsx
hint: Select a block and press Ctrl+C - it pastes into Excel as cells, not as one string.
```

Right-clicking inside the selection opens a menu with **Copy**, **Export as CSV
for Excel** and an **Include headers** toggle. A right-click outside it moves the
selection there first, the way a spreadsheet does. Your own
[`rowContextMenu`](/docs/row-interaction#context-menus) items are appended below
a divider, so nothing is lost by turning cell selection on.

### The CSV

Written for a Nordic Excel: a `sep=;` first line, a UTF-8 BOM, CRLF endings,
semicolons between fields and a comma as the decimal mark. That combination is
what makes the file open straight into columns with å ä ö intact.

`cellExport` on `TMDataGrid.Table` changes any of it:

```tsx
<TMDataGrid.Table cellExport={{ separator: ",", decimalComma: false, fileName: "employees" }} />
```

What gets written is the cell's **value**, not what it renders: a cell renders
React, and often a badge or a link rather than the value. Dates come out in the
`sv-SE` form (`2026-07-31`), which Excel reads as a date.

`exportGridToCsv({ table, options })` takes **every filtered row** instead of the
selected block, with the same options and defaults. There is no built-in button
for it - wire it to your own [toolbar](/docs/toolbar).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `cellSelection` | Option | `"none" \| "single" \| "range"` | `"none"` | Turns the cell cursor, and the rectangle, on. |
| `onFocusedCellChange` | Callback | `(cell \| null) => void` | – | Follows the cursor. |
| `cellExport` | Table prop | `TMDataGridCellExportOptions` | Nordic Excel | Separator, decimal mark, headers, file name. |
| `ui.state.focusedCell` | UI state | `{ rowId, columnId } \| null` | `null` | The cursor. |
| `ui.state.cellRange` | UI state | `{ anchor, focus } \| null` | `null` | The rectangle's two corners. |
| `ui.actions.setFocusedCell` · `setCellRange` | UI actions | – | – | Move either from your own code. |
| `useCellControlTabIndex` | Hook | `() => 0 \| -1` | – | The tab index a control inside a body cell wants. |
| `exportGridToCsv` | Export | `({ table, options? }) => void` | – | Downloads every filtered row as CSV. |
| `toClipboardText` · `toExcelCsv` · `buildCellMatrix` | Exports | – | – | The pieces behind Ctrl+C and the file. |
| `DEFAULT_CELL_EXPORT_OPTIONS` | Export | object | – | The Nordic Excel defaults, to spread over. |
| `data-focused` | Data attribute | – | – | On the focused cell. |
| `data-edge-top` · `-bottom` · `-left` · `-right` | Data attributes | – | – | On cells at the rectangle's border. |

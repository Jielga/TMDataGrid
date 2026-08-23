# Cell selection, copy and export

A cell cursor moved with the arrow keys, a rectangle of cells that can be
dragged out, and Ctrl+C that pastes into Excel as cells rather than as one
string. Off by default; `cellSelection` turns it on.

```tsx
const grid = useTMDataGrid({ data, columns, cellSelection: "range" });
```

| Mode | What it gives |
| ---- | ------------- |
| `"none"` | Nothing. The default |
| `"single"` | One focused cell, moved with the arrow keys |
| `"range"` | As `"single"`, plus a rectangle of cells, Ctrl+C and the export menu |

```demo
file: cells/CellSelection.tsx
hint: Tab into the grid, then arrows to move · Shift+arrows or drag to select a block. However many cells it holds, the whole grid is one tab stop.
```

Turning it on changes three things about the body:

- The tab stop moves from the row to a cell, so the whole grid is **one** Tab
  stop and the arrow keys move within it.
- The grid reports itself as a `grid` of `gridcell`s rather than a `table` of
  `cell`s, which is what tells a screen reader the arrow keys are live.
- The focused cell takes `data-focused`, and the selected ones `data-selected`
  and `data-edge-*`, which the stylesheet styles.

## Keys

| Key | Does |
| --- | --- |
| Arrows | Moves one cell. Clamped at the edges; no wrapping |
| Shift+arrows | Extends the rectangle from its anchor (`"range"`) |
| PageUp / PageDown | Moves one viewport of rows |
| Home / End | First / last cell of the row |
| Ctrl+Home / Ctrl+End | First / last cell of the grid |
| Enter or F2 | Steps into the cell, to its checkbox, link or button |
| Escape | Steps back out, or drops the rectangle to the focused cell |
| Space | Selects the row, as a row click does under `selectionMode: "row"` |
| Ctrl+C | Copies the selection as tab-separated text |

A [cell editor](/docs/editing) takes over Enter and F2 when editing is on.
Otherwise they focus the first control in the cell, and the arrow keys stop
moving the cursor while focus is inside it.

## One tab stop

Tab from a cell leaves the grid, and Shift+Tab leaves it backwards. The
controls inside body cells - the checkbox, the tree chevron, the details
chevron - take `tabindex="-1"` while cell selection is on.

They remain reachable: Enter or F2 steps into the cell, Escape steps back out,
and Space ticks the row from any of its cells without stepping in. Header
controls are unaffected: the header row is not part of cell navigation, so Tab
is the only way to its sort buttons and menus.

A custom cell containing a control needs the same treatment:

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
is two of them: the anchor and the moving corner. They hold **ids rather than
indices**, so sorting, filtering and column reordering move the selection with
the cells instead of leaving it over whatever took those positions. A range
whose corner is filtered away is not shown, and returns when the filter is
cleared.

Move either with `ui.actions.setFocusedCell` / `setCellRange`, follow them with
`onFocusedCellChange`, or read them with TanStack Store's
[`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference):

```tsx
const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);
```

One rectangle at a time. Ctrl+drag for a second, disjoint block is not
supported.

### System lanes

The generated lanes (checkbox, tree, details) are part of the selection. They
take the tint and the outline, so the block stays a rectangle and the arrow keys
still reach the checkbox. They are never exported. A block covering nothing else
has nothing to copy, and the Copy and Export items are disabled.

## Copy and export

Ctrl+C puts the selected block on the clipboard as tab-separated text with CRLF
between rows, the format Excel, Sheets and Numbers all write themselves, so a
paste lands in cells rather than in one column. Values only: no header row, the
same as Excel's own copy.

```demo
file: cells/CopyAndExport.tsx
hint: Select a block and press Ctrl+C. It pastes into Excel as cells, not as one string.
```

Right-clicking inside the selection opens a menu with **Copy**, **Export as CSV
for Excel** and an **Include headers** toggle. A right-click outside it moves the
selection there first, as a spreadsheet does. Your own
[`renderRowContextMenu`](/docs/row-interaction#context-menus) items are appended
below a divider, so turning cell selection on removes nothing. Those three items are also what that slot's `internalItems` contains.

### The CSV

Written for a Nordic Excel: a `sep=;` first line, a UTF-8 BOM, CRLF endings,
semicolons between fields and a comma as the decimal mark. That combination
opens straight into columns with å ä ö intact.

`cellExport` on `TMDataGrid.Table` changes any of it:

```tsx
<TMDataGrid.Table cellExport={{ separator: ",", decimalComma: false, fileName: "employees" }} />
```

What is written is the cell's **value**, not what it renders. Dates are written
in the `sv-SE` form (`2026-07-31`), which Excel reads as a date.

`exportGridToCsv({ table, options })` takes **every filtered row** instead of the
selected block, with the same options and defaults. There is no built-in button
for it; add one to your own [toolbar](/docs/toolbar).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `cellSelection` | Option | `"none" \| "single" \| "range"` | `"none"` | Turns the cell cursor, and the rectangle, on. |
| `onFocusedCellChange` | Callback | `(cell \| null) => void` | – | Follows the cursor. |
| `cellExport` | Table prop | `TMDataGridCellExportOptions` | Nordic Excel | Separator, decimal mark, headers, file name. |
| `ui.state.focusedCell` | UI state | `{ rowId, columnId } \| null` | `null` | The cursor. |
| `ui.state.cellRange` | UI state | `{ anchor, focus } \| null` | `null` | The rectangle's two corners. |
| `ui.actions.setFocusedCell` · `setCellRange` | UI actions | – | – | Move either from your own code. |
| `useCellControlTabIndex` | Hook | `() => 0 \| -1` | – | The tab index for a control inside a body cell. |
| `exportGridToCsv` | Export | `({ table, options? }) => void` | – | Downloads every filtered row as CSV. |
| `toClipboardText` · `toExcelCsv` · `buildCellMatrix` | Exports | – | – | The pieces behind Ctrl+C and the file. |
| `DEFAULT_CELL_EXPORT_OPTIONS` | Export | object | – | The Nordic Excel defaults, for spreading over. |
| `data-focused` | Data attribute | – | – | On the focused cell. |
| `data-edge-top` · `-bottom` · `-left` · `-right` | Data attributes | – | – | On cells at the rectangle's border. |

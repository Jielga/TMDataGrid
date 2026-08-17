---
name: rows
description: >
  Everything a TMDataGrid row does beyond holding cells. Covers selectionMode
  and its four modes (checkbox, row, checkboxAndHighlight, highlight), the
  highlight as state of its own with defaultHighlightedRowId and
  onHighlightedRowChange, showSelectedBackground and --dg-row-selected-bg,
  reading a selection through the table store, onRowClick / onCellClick /
  onCellDoubleClick / onCellContextMenu, the rowContextMenu render prop and
  rowContextMenuProps, per-row styling with rowStyle, rowClassName, striped and
  the --row-bg rule, the row details panel through renderDetails and
  DETAILS_COLUMN_ID, row pinning with enableRowPinning and row.pin, and the
  row-number gutter through enableRowNumbers. Load when selecting rows, reacting
  to a click, opening a detail panel, colouring rows by their data, pinning rows
  to an edge, or numbering them.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.0.2'
sources:
  - 'Jielga/TMDataGrid:src/docs/row-selection.md'
  - 'Jielga/TMDataGrid:src/docs/row-interaction.md'
  - 'Jielga/TMDataGrid:src/docs/row-styling.md'
  - 'Jielga/TMDataGrid:src/docs/row-details.md'
  - 'Jielga/TMDataGrid:src/docs/row-pinning.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/rowSelection.ts'
---

# TMDataGrid - Rows

Selecting rows, reacting to clicks, colouring them, opening a panel under one,
and pinning or numbering them. Column-side concerns are the `columns` skill;
cell cursors and ranges are `cell-selection`.

## Selection

`selectionMode` sets what selecting looks like **and** what a bare row click
does. One option rather than two, because a click can either toggle a
multi-selection or move a highlight, never both.

| Mode | Checkbox column | Row click |
| --- | --- | --- |
| `"checkbox"` (default) | yes, multi-select | nothing |
| `"row"` | no | selects, with the usual modifiers |
| `"checkboxAndHighlight"` | yes, multi-select | highlights one row |
| `"highlight"` | no | highlights one row, no selection at all |

```tsx
const grid = useTMDataGrid({ data, columns, selectionMode: "row" });
```

The first two write to TanStack's `rowSelection`, so everything downstream - the
toolbar count, `getSelectedRowModel()`, persistence - is unaffected by the
choice. Under `"row"` the click follows desktop-list conventions: a plain click
makes the selection this row, Ctrl/Cmd toggles it and leaves the rest, Shift
selects the range from the anchor, Ctrl+Shift adds that range. Rows are
focusable in this mode, and Space or Enter toggles the focused row.

`enableRowSelection: false` removes the selection half whatever the mode.

### The highlight is not a selection

The highlight is state of its own, not a slice of `rowSelection` - which is what
lets `"checkboxAndHighlight"` run both at once: tick rows for a bulk action,
click one to open its record beside the grid.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  selectionMode: "highlight",
  defaultHighlightedRowId: routeId,
  onHighlightedRowChange: (rowId) =>
    navigate({ to: "/employees/$id", params: { id: rowId ?? "" } }),
});
```

### Reading a selection

Read it through the table store, never by calling the method bare. `table` keeps
one identity across renders, so the React Compiler caches a bare
`getSelectedRowModel()` and the reader stops updating.

```tsx
import { useSelector } from "@tanstack/react-store";

const selected = useSelector(grid.table.store, () =>
  grid.table.getSelectedRowModel().rows,
);
```

### The background

`showSelectedBackground` follows the mode: on for `"row"`, where the background
is the only feedback a click gives, off for `"checkbox"`, where the box already
says so. Set it to override either way. The colour is `--dg-row-selected-bg`,
changed on the grid element rather than through the flag:

```tsx
<TMDataGrid
  {...grid}
  style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
/>
```

A group row's checkbox selects every record under it at any depth, shows a tick
once all are selected and a dash while only some are, and writes only the
records to `rowSelection`.

## Clicks and context menus

Every handler **composes** with what the click already does. `onRowClick` does
not replace selection or the highlight; yours runs in addition.

| Handler | Argument | Notes |
| --- | --- | --- |
| `onRowClick` | `row` | Rows show a pointer cursor when set |
| `onCellClick` | `{ cell, row, column, event }` | The cell cursor still moves |
| `onCellDoubleClick` | same | A double-click that opens an editor still does |
| `onCellContextMenu` | same | `rowContextMenu` still opens |

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

Pass the row type, as above, and `row.original` is typed. Group rows sit out all
four: TanStack builds a group row on top of its first child's record, so a
handler would receive a real-looking row that is the wrong one.

`rowContextMenu` is a render prop saying what goes inside the menu. The grid
owns the Mantine `Menu`, opening it at the pointer and closing it on Escape, an
outside click, a body scroll and after an item is picked.

```tsx
<TMDataGrid.Table<Employee>
  rowContextMenu={({ table, row, cell }) => (
    <>
      <Menu.Label>{row.original.firstName}</Menu.Label>
      <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
      <Menu.Item
        onClick={() =>
          navigator.clipboard.writeText(String(cell?.getValue() ?? ""))
        }
      >
        Copy cell value
      </Menu.Item>
    </>
  )}
  rowContextMenuProps={{ width: 260, position: "right-start" }}
/>
```

It is called **during render**, only for the row whose menu is open, so keep it
a pure function of its arguments and do the work in the item handlers. Return
`null` to leave a row without a menu. Right-clicking does not select: it marks
the row with `data-context-menu` while its menu is open, so an action meant for
a multi-selection reads `table` and falls back to the clicked row.

## Row styling

```tsx
<TMDataGrid.Table<Employee>
  striped
  rowStyle={(row) =>
    row.original.status === "Terminated"
      ? { "--row-bg": "var(--mantine-color-red-0)" }
      : undefined
  }
  rowClassName={(row) => (row.original.overdue ? classes.overdue : undefined)}
/>
```

A row is a strip of cells, some sticky in pinned lanes, and hover, selection,
the highlight, the cell range and striping all paint on top of it. `--row-bg`
feeds the variable those layers compose against; `background` wins over all of
them and kills them. `striped` follows position in the view, so it survives
sorting and filtering rather than sticking to records, and pinned rows sit it
out.

Rows carry `data-selected`, `data-selected-bg`, `data-highlighted`,
`data-grouped`, `data-depth`, `data-context-menu` and `data-row-id`, so a
stylesheet can reach any of it without a callback.

## The details panel

Setting `renderDetails` turns the lane on. There is no flag.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
});
```

Each panel is measured, so heights need not be uniform;
`renderDetailsEstHeight` (default `160`) is only what the virtualizer assumes
for one it has not seen. A generated chevron column, `DETAILS_COLUMN_ID`, is
prepended and pinned left after the checkbox and tree lanes; it cannot be
hidden, moved, resized or unpinned, and its header opens and closes every panel.

Which rows are open is TanStack's own `expanded` state, so anything can open
one - `row.toggleExpanded()` from a menu item, `initialState.expanded`,
`table.toggleAllRowsExpanded()` - and it persists as a `data` slice. The panel
is a cell spanning the row, not a row: `aria-rowcount` still counts records, and
a click inside it stops there rather than selecting the row underneath. Group
rows have no panel; expanding one opens its children.

## Pinning and numbering

Two independent lanes at the edges.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  enableRowPinning: true,
  enableRowNumbers: true,
});
```

There is no built-in pin gesture - pin from wherever suits, most naturally the
row context menu, through TanStack's own `row.pin("top" | "bottom" | false)`,
`row.getIsPinned()` and `row.getCanPin()`. Pinned rows leave the scrolling order
and render in sticky blocks: top under the header, bottom above the summary row.

Pinned rows are still body rows - selection, editing, details, the context menu
and per-row styling all behave normally. What they sit out are the statements
about scrolling order: striping, the cell range, and the number gutter. A pinned
row stays at its edge even when a filter or the pager would have dropped it, and
**group rows never pin**.

`enableRowNumbers` adds a gutter outermost left that numbers the current view -
sorted, filtered, continuing across pages. It answers "where am I in what I am
looking at", not "which record is this"; a stable identifier is a column of your
own over the record's id.

## Common mistakes

### CRITICAL Setting `background` in `rowStyle`

A coloured row stops responding to hover, selection, the highlight and the cell
range, because `background` paints over every layer composed on top of the row.
Nothing errors; the row simply goes inert.

Wrong:

```tsx
rowStyle={() => ({ background: "pink" })}
```

Correct:

```tsx
rowStyle={() => ({ "--row-bg": "pink" })}
```

Source: `src/docs/row-styling.md` (Set `--row-bg`, not `background`).

### CRITICAL Reading the selection without subscribing

`table` keeps one identity for the life of the grid, so the React Compiler
memoizes a bare `getSelectedRowModel()` against it. The count renders once and
then never changes, which reads as a broken toolbar rather than a missing
subscription.

Wrong:

```tsx
const selected = grid.table.getSelectedRowModel().rows;
```

Correct:

```tsx
const selected = useSelector(grid.table.store, () =>
  grid.table.getSelectedRowModel().rows,
);
```

Source: `src/docs/row-selection.md` (Acting on a selection).

### HIGH Looking for the highlight in `rowSelection`

The highlight is separate state, which is what lets
`"checkboxAndHighlight"` run both at once. It never appears in `rowSelection`,
`getSelectedRowModel()` or the persisted selection slice.

Wrong:

```tsx
// Always empty under selectionMode: "highlight".
const current = Object.keys(grid.table.store.state.rowSelection)[0];
```

Correct:

```tsx
const current = useSelector(grid.ui, (state) => state.highlightedRowId);
```

Source: `src/docs/row-selection.md` (The highlight is not a selection).

### HIGH Expecting a click handler to replace the built-in behaviour

`onRowClick` composes. Under `selectionMode: "row"` a click both selects and
runs the handler, so a handler that navigates away will also have changed the
selection on the way out.

Correct, when the click should only navigate:

```tsx
// "highlight" moves a marker and selects nothing.
useTMDataGrid({ data, columns, selectionMode: "highlight" });
```

Source: `src/docs/row-interaction.md`.

### HIGH Reading `row.getIsExpanded()` in a cell without subscribing

Same mechanism as the selection above: the compiler caches the call against the
`row` identity, so a custom expand control renders its initial state forever.

Correct:

```tsx
const expanded = useSelector(row.table.store, () => row.getIsExpanded());
```

Source: `src/docs/row-details.md` (Opening a row from elsewhere).

### MEDIUM Assuming group rows behave like data rows

Group rows are built on their first child's record. They sit out `onRowClick`,
`onCellClick`, `onCellDoubleClick` and `onCellContextMenu`, they never pin, they
take no row number, and they have no details panel. A handler written as though
every row reaches it will silently skip them.

Source: `src/docs/row-interaction.md`, `src/docs/row-pinning.md`.

### MEDIUM Open panels closing when `data` is replaced

TanStack resets `expanded` when the row structure changes, so a refetch collapses
every open panel.

Correct:

```tsx
useTMDataGrid({ data, columns, renderDetails, autoResetExpanded: false });
```

Source: `src/docs/row-details.md`.

### MEDIUM Expecting pinned rows to persist

`rowPinning` is deliberately left out of `settingsKey`: row ids are data, and a
layout store outlives any one data set. A pinned id whose row leaves `data` is
simply not shown, and returns to its edge if the data comes back.

Source: `src/docs/row-pinning.md`.

## References

- [Rows API](references/rows-api.md) - every option, table prop, callback,
  export, CSS variable and data attribute these five topics own.

See also: the `grouping` skill for group rows and the tree lane, the
`cell-selection` skill for the cell cursor and ranges, and the `appearance`
skill for the CSS variables named here.

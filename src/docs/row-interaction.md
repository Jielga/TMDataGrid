# Clicks and context menus

Reacting to what the reader does in the body: clicking a row, clicking a cell,
double-clicking, and right-clicking for a menu.

Every handler here **composes** with what the click already does. Setting
`onRowClick` does not replace selection or the highlight - both still happen,
and yours runs in addition.

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

Pass the row type, as above, and `row.original` is typed.

```demo
file: rows/ClickAndContextMenu.tsx
hint: Click, double-click and right-click anywhere in the body.
```

## The click handlers

| Handler | Argument | Notes |
| --- | --- | --- |
| `onRowClick` | `row` | Rows show a pointer cursor when set. |
| `onCellClick` | `{ cell, row, column, event }` | The cell cursor still moves. |
| `onCellDoubleClick` | same | A double-click that opens an editor still does. |
| `onCellContextMenu` | same | `renderRowContextMenu` and the cell-selection menu still open. |

Group rows sit out all four. TanStack builds a group row on top of its first
child's record, so a handler would receive a real-looking row that is the wrong
one.

## Context menus

Right-clicking a row opens a Mantine `Menu` at the pointer. The grid owns the
`Menu` and its `Menu.Dropdown` - opening it at the cursor, closing it on
Escape, on an outside click, on a body scroll, and after an item is picked. The
render prop only says what goes inside, so anything valid in a dropdown works:
`Menu.Item`, `Menu.Label`, `Menu.Divider`, `Menu.Sub`, or your own components.

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={({ row, cell }) => (
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
      <Menu.Divider />
      <Menu.Item color="red" onClick={() => remove(row.original.id)}>
        Delete
      </Menu.Item>
    </>
  )}
/>
```

| Argument | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | For actions that read the wider state - `getSelectedRowModel()`, for instance. |
| `row` | `Row<TMDataGridFeatures, TData>` | The right-clicked row. |
| `cell` | `Cell<…> \| null` | The cell under the pointer, so a per-cell action such as "copy value" is possible. `null` only if a custom cell renderer stopped the event. |
| `close` | `() => void` | Closes the menu. `Menu.Item` already closes on click, so this is for content that is not a menu item. |

The render prop is called **during render**, and only for the row whose menu is
open - so keep it a pure function of its arguments and do the work in the item
handlers.

Return `null` to leave a row without a menu. The browser's own context menu
stays suppressed over the grid either way:

```tsx
renderRowContextMenu={({ row }) => (row.original.locked ? null : <Menu.Item>Edit</Menu.Item>)}
```

### Right-clicking does not select

It only marks the row with `data-context-menu` while its menu is open, which is
what gives it the hover background. An action that should apply to a
multi-selection can read it off `table` and fall back to the clicked row:

```tsx
renderRowContextMenu={({ table, row }) => {
  const selected = table.getSelectedRowModel().rows;
  const targets = selected.some((r) => r.id === row.id) ? selected : [row];
  return <Menu.Item onClick={() => archive(targets)}>Archive {targets.length}</Menu.Item>;
}}
```

### Taking the whole menu

Under `cellSelection: "range"` a right-click inside the selection opens the
copy and export items too. By default they go above a divider and yours below,
which is what happens when the render prop never mentions `internalItems` - see
[Cell selection](/docs/cell-selection#copy-and-export).

`internalItems` is those built-in items, and **reading it hands the composition
over**: the menu becomes exactly what you return, wherever you put them.

```tsx
renderRowContextMenu={({ row, internalItems }) => (
  <>
    <Menu.Item onClick={() => open(row.id)}>Open</Menu.Item>
    <Menu.Divider />
    {internalItems}
  </>
)}
```

Reading it without rendering it is how you drop the built-in half entirely -
taking the handback means owning the result.

### Menu options

`rowContextMenuProps` reaches the Mantine `Menu` untouched apart from its open
state:

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={items}
  rowContextMenuProps={{ width: 260, shadow: "lg", position: "right-start" }}
/>
```

On touch devices a long press (500 ms) opens the same menu. Mantine sets
`user-select: none` on the element it hangs a context menu off, so body cell
text is no longer selectable with the mouse in a grid that has one - the trade
for a long press opening the menu rather than selecting text.

One `Menu` serves the whole body, not one per row: a closed Mantine `Popover`
still runs its hooks on every render, and the virtualized body re-renders on
every scroll frame.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `onRowClick` | Table prop | `(row) => void` | – | Row click. Adds a pointer cursor. |
| `onCellClick` | Table prop | `(args) => void` | – | Cell click - `{ cell, row, column, event }`. |
| `onCellDoubleClick` | Table prop | `(args) => void` | – | Cell double-click. |
| `onCellContextMenu` | Table prop | `(args) => void` | – | Cell right-click. |
| `renderRowContextMenu` | Table prop | `({ table, row, cell, close, internalItems }) => ReactNode` | – | Contents of the row's context menu. `null` for no menu. |
| `renderColumnMenuItems` | Table prop | `({ column, table, internalItems }) => ReactNode[]` | – | Contents of a column's menu. An empty list removes the button. |
| `rowContextMenuProps` | Table prop | `MenuProps` | – | Passed to the Mantine `Menu`. |
| `TMDataGridCellEventArgs` | Export | type | – | The argument the three cell handlers receive. |
| `data-context-menu` | Data attribute | – | – | On the row whose menu is open. |

# Visibility, pinning, ordering and size

Four things the reader can do to the shape of the grid, and one button that
puts them all back. All four write state that [persists](/docs/use-tm-data-grid#persist)
together, so a grid comes back arranged the way it was left.

```demo
file: columns/ColumnLayout.tsx
hint: Drag a header to reorder · pin or hide from a column menu · drag a divider to resize, or double-click it to fit the content.
```

## Hiding

**Hide column** in any column menu, and **Manage columns** - the
`ColumnsButton` and the panel behind it - for the whole list at once.

`TMDataGrid.ColumnsPanel` is a search field, the column checkboxes, show/hide
all, and **Reset layout**. It is rendered by `TMDataGrid.ColumnsButton` and
exported for custom layouts.

`enableHiding: false` removes all of it; on a column it removes that column's
menu item and leaves it out of the panel, which lists what can be hidden and
nothing else. Show/hide all covers the same list, so a column switched off this
way keeps whatever visibility it was given. The state is TanStack's
`columnVisibility`.

The generated lanes are all `enableHiding: false` and so never appear: the
checkbox and edit lanes hold controls the grid needs to work, the tree column
follows the grouping state, and the row-number gutter follows
`enableRowNumbers`. None of them is a user setting.

## Pinning

**Pin to left** and **Pin to right** are in each column menu. The current
position is marked, and choosing it again unpins. Pinned columns are sticky
within the scroll container, and the boundary is marked with a divider and a
short gradient band that fades in only while it is actually covering something.

Headers, cells and grid tracks are ordered left, centre, right from the same
source, so pinning does not change a column's position relative to its group.

A pinned column also becomes fixed-width: sticky offsets are computed from
`getSize()`, which cannot resolve an `fr` value. The grid stores the column's
rendered width in `columnSizing` at the moment it is pinned, so nothing jumps.

The generated lanes keep the outside of both pinned lanes: pinning a column
right puts it to the left of the edit lane, so the row's Save, Cancel and
Delete stay the last thing in the row.

## Ordering

Drag a column header sideways to move it: the header being dragged dims and a
bar marks the edge the column will land against. **Move left** and **Move
right** in the column menu do the same thing one step at a time, which is the
path that works without a pointer. Both move the header, its cells and its
filter entry together.

```tsx
const grid = useTMDataGrid({ data, columns, enableColumnOrdering: false });
```

`enableColumnOrdering` is one of two switches the grid defines itself -
TanStack ships the state and the APIs for ordering but no `enable` option,
since reordering is entirely a matter of interface. The per-column form is
`meta.enableOrdering`, for the same reason.

### Regions

A column can only move **within its own pinned region**, so a header in another
region never accepts the drop. This follows TanStack's ordering pipeline:
pinning splits the grid into left, centre and right, then `columnOrder`
sequences the centre while `columnPinning.left` and `.right` sequence the
pinned lanes. Unpin a column first to move it out of one.

A neighbour that cannot be moved acts as a wall rather than being stepped over.
The checkbox column sets `meta.enableOrdering: false`, so nothing can be placed
in front of it.

Columns inside a header group are not movable either, in either direction:
`columnOrder` sequences leaf columns, so moving one would leave the group header
spanning columns that no longer belong to it.

### Moving from your own code

```tsx
import { moveColumn, moveColumnByStep } from "@jielga/tmdatagrid";

moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
moveColumnByStep({ table, columnId: "salary", direction: 1 });
```

Both are no-ops for a move that is not allowed, including one across regions.
`getStepTargetColumn({ table, columnId, direction })` returns the column a step
would swap with, or `null` at the edge of a region - that is what the menu items
use to disable themselves.

### State

Ordering writes `columnOrder` as the **complete** leaf order, including hidden
and pinned columns, so a column keeps its position when it is later shown or
unpinned. Moving a pinned column also rewrites its `columnPinning` array. A
column added to the definitions later is not in the stored order and is appended
at the end until it is moved.

## Sizing

Columns are fluid by default. Each track is `minmax(minSize, flex fr)`.

| Column option | Effect |
| --- | --- |
| `minSize` | Minimum width, and the column's contribution to the grid minimum width. Defaults to `80`. |
| `meta.flex` | Share of the remaining width. Defaults to `1`. |
| `minSize === maxSize` | Fixed width. The column is never fluid. |
| `size` | Applied once the column becomes fixed by resizing or pinning. |

Drag a divider to resize. A column switches to a fixed pixel width the moment
it is resized or pinned, and the width is stored in `columnSizing`.

### Autosizing

Double-click a column's resize divider and it sizes itself to its widest
mounted content - the spreadsheet gesture. **Autosize column** in the column
menu does the same without a pointer, and `meta.autoSize: true` runs it once
after the first rows render, unless a persisted or user-set width already covers
the column.

**Mounted content only.** Under virtualization the unmounted rows do not exist
to be measured, so the width fits the visible window plus overscan - the same
trade AG Grid's autosize makes. The result is clamped to `minSize`/`maxSize` and
written into `columnSizing`, so it persists with the other widths and a later
drag takes over from it.

`autosizeColumn({ table, columnId, container })` is exported for menus and
consumer code; `container` is the grid's scroll container, or any ancestor of
the column's cells.

## The column menu

Every affordance above reaches the reader through a column's menu, and
`renderColumnMenuItems` on `TMDataGrid.Table` decides what is in it. It receives
the items the grid would have rendered and returns the list to render:

```tsx
<TMDataGrid.Table<Employee>
  renderColumnMenuItems={({ column, internalItems }) => [
    ...internalItems,
    <Menu.Divider key="stats-divider" />,
    <Menu.Item key="stats" onClick={() => showStats(column.id)}>
      Column statistics
    </Menu.Item>,
  ]}
/>
```

`internalItems` is the built-in list in order, dividers included - so returning
it unchanged is the default menu, splicing around it extends the menu, and
returning something else replaces it. Return an empty list and the column has
no menu button at all, exactly as if its every feature were switched off.

It runs for every column that has a menu, so branch on `column.id` for a
per-column menu. A trailing divider is dropped for you, whichever side left it
there.

## Putting it back

`resetSettings()` from the hook clears visibility, order, pinning and widths in
one go - and the columns panel offers it as **Reset layout**, so the reader
never has to undo four things by hand.

```tsx
const { resetSettings } = useTMDataGrid({ data, columns });
```

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableHiding` | Table option | `boolean` | `true` | Also a column option. `false` removes hiding entirely. |
| `enableColumnPinning` | Table option | `boolean` | `true` | `false` removes the pin menu items. |
| `enablePinning` | Column option | `boolean` | `true` | `false` for one column. |
| `enableColumnOrdering` | Option | `boolean` | `true` | Header dragging and the move menu items. Grid-defined. |
| `meta.enableOrdering` | Column meta | `boolean` | `true` | `false` keeps one column where it is. |
| `enableColumnResizing` | Table option | `boolean` | `true` | `false` leaves the divider as a separator only. |
| `enableResizing` | Column option | `boolean` | `true` | `false` for one column. |
| `meta.flex` | Column meta | `number` | `1` | Share of the remaining width. |
| `meta.autoSize` | Column meta | `boolean` | `false` | Autosize once after the first rows render. |
| `minSize` / `maxSize` / `size` | Column options | `number` | `80` / – / – | Width bounds, and the fixed width once one applies. |
| `renderColumnMenuItems` | Table prop | `({ column, table, internalItems }) => ReactNode[]` | – | The column menu's contents. An empty list removes the button. |
| `resetSettings` | Hook return | `() => void` | – | Clears visibility, order, pinning and widths. |
| `moveColumn` | Export | `({ table, columnId, targetId, side }) => void` | – | Moves a column beside another. |
| `moveColumnByStep` | Export | `({ table, columnId, direction }) => void` | – | Moves it one place. |
| `getStepTargetColumn` | Export | `(args) => Column \| null` | – | What a step would swap with, or `null` at a region edge. |
| `keepGeneratedColumnsOutermost` | Export | `(columnPinning) => ColumnPinningState` | – | Puts the generated lanes back on the outside of both pinned lanes. The grid runs it after every pin. |
| `getColumnRegion` | Export | `(column) => "left" \| "center" \| "right"` | – | Which pinned region a column is in. |
| `autosizeColumn` | Export | `({ table, columnId, container }) => void` | – | Fits a column to its mounted content. |
| `TMDataGrid.ColumnsButton` · `TMDataGrid.ColumnsPanel` | Components | – | – | Manage columns, and Reset layout. |

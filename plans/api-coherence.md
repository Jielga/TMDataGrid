# P2 - API coherence refactor: the rename table

> **Status: executed 2026-08-18.** Executes P2 from
> [proposals.md](proposals.md), approved with the rename table below as its
> second gate. Breaking; the changeset is a minor, so it releases as the next
> minor. Kept for the rationale and as the migration note.

The three conventions P2 settles, and the complete old → new inventory. Every
break is named in the changeset.

## The conventions

1. **One typed args object per render surface, named `render*`.** A surface
   that hands something back to the consumer is a `render*` prop taking one
   object. No positional arguments, no bare values.
2. **Composable chrome slots expose `{ state, actions, Controls }`.**
   `Controls` are pre-bound components, and the default render is literally
   those controls in order - so rearranging, restyling or dropping one does not
   mean rebuilding the rest.
3. **Menu-shaped overrides receive the built-ins and return the full list.**
   The `internalItems` handback: take what the grid would have rendered,
   return what should be rendered.

## The table

| Old | New | Kind | Note |
| --- | --- | --- | --- |
| `TMDataGrid.Footer` `pagination` | `renderPagination` | Slot | Args reshaped, see below |
| `TMDataGridPaginationApi` (flat) | `TMDataGridPaginationSlotArgs` = `{ state, actions, Controls }` | Type | The flat members split across `state` and `actions` |
| `getTMDataGridPaginationApi(table)` | unchanged name, returns `{ state, actions }` | Export | `Controls` need grid context, so they exist only inside the slot |
| `TMDataGrid.Table` `rowContextMenu` | `renderRowContextMenu` | Slot | Gains `internalItems` |
| `TMDataGridRowContextMenu` | `TMDataGridRowContextMenuRenderer` | Type | Args type gains `internalItems` |
| - | `TMDataGrid.Table` `renderColumnMenuItems` | Slot | New: the column menu's handback |
| - | `TMDataGrid.EditActions` `renderActions` | Slot | New: `{ state, actions, Controls }` |

**Unchanged, and why.** `renderDetails`, `renderDetailsEstHeight` and
`renderEmptyState` already are a `render*` prop over one args object.
`rowStyle`, `rowClassName` and `striped` are values, not render surfaces.
`rowContextMenuProps` configures a Mantine component rather than rendering
anything. `meta.editor` and `meta.filterControl` are P1's component contract,
settled 2026-08-09.

## Slot shapes

```tsx
// Pagination
<TMDataGrid.Footer
  renderPagination={({ state, actions, Controls }) => (
    <Group>
      <Controls.PageSize />
      <MyJumpToPage page={state.pageIndex} onJump={actions.setPageIndex} />
      <Controls.Pager />
    </Group>
  )}
/>

// Edit actions
<TMDataGrid.EditActions
  renderActions={({ state, actions, Controls }) => (
    <Group>
      <Text>{state.pendingCount} pending</Text>
      <Controls.Save />
      <Controls.Discard />
    </Group>
  )}
/>

// Menus - take the built-ins, return the full list
<TMDataGrid.Table
  renderColumnMenuItems={({ column, internalItems }) => [
    ...internalItems,
    <Menu.Divider key="d" />,
    <Menu.Item key="stats" onClick={() => showStats(column.id)}>Statistics</Menu.Item>,
  ]}
  renderRowContextMenu={({ row, internalItems }) => (
    <>
      <Menu.Item onClick={() => open(row.id)}>Open</Menu.Item>
      {internalItems}
    </>
  )}
/>
```

`renderRowContextMenu` returning only its own items keeps today's behavior -
the built-in cell items still render above a divider - because the grid
composes them when the consumer does not place `internalItems` itself. Placing
`internalItems` takes that composition over.

## Migration

| If you had | Write |
| --- | --- |
| `pagination={(api) => …api.pageIndex…}` | `renderPagination={({ state }) => …state.pageIndex…}` |
| `pagination={(api) => …api.nextPage()…}` | `renderPagination={({ actions }) => …actions.nextPage()…}` |
| `rowContextMenu={(args) => …}` | `renderRowContextMenu={(args) => …}` - args are the same, plus `internalItems` |
| `const api = getTMDataGridPaginationApi(table)` then `api.pageIndex` | `api.state.pageIndex` |

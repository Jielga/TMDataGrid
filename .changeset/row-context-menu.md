---
"@jielga/tmdatagrid": minor
---

Add `rowContextMenu` to `TMDataGrid.Table`: a render prop that fills a Mantine
`Menu` the grid opens at the pointer on a right-click or long press. It receives
`{ table, row, cell, close }`, and returning `null` leaves a row without a menu.
`rowContextMenuProps` passes through to the `Menu`. The open row carries
`data-context-menu`.

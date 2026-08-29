---
"@jielga/tmdatagrid": minor
---

The grid menu.

- `TMDataGrid.Menu` - the toolbar burger, a Mantine `Menu` filled with your own items.
- `TMDataGrid.Menu.Columns`, `.ColumnToggles`, `.ShowHideAll`, `.ResetLayout` - the column chooser as menu items, for any Mantine `Menu` inside the grid.
- **Breaking.** `TMDataGrid.ColumnsButton` is gone; render `<TMDataGrid.Menu><TMDataGrid.Menu.Columns /></TMDataGrid.Menu>`. `TMDataGrid.ColumnsPanel` stays for hosts that are not a menu.
- **Breaking.** `ui.columnsPanelOpen`, `setColumnsPanelOpen` and `toggleColumnsPanel` are gone; the header menu's "Manage columns" is a submenu now, and its `internalItems` entry is a `Menu.Sub`.
- `data-dg-part`: `menu-button` added, `columns-button` dropped.
- Labels: `menuButton` added; `columnsReset` reads "Reset layout".

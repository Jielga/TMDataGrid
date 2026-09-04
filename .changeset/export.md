---
"@jielga/tmdatagrid": minor
"@jielga/tmdatagrid-xlsx": minor
---

Export.

- `TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected` - menu items downloading every filtered row, or the selected rows in grid order, in the grid's format. Props override the format, file name, headers and label per item.
- `useTMDataGridExport` - the export as click handlers (`exportAll`, `exportSelected`, `selectedCount`, `canExportSelected`) for a control of your own.
- `exportGrid`, `buildExportData`, `writeExportFile` - the same export from outside a component.
- Formats: `csvExcelFormat` (the default, as before), `csvFormat`, `tsvFormat`, `jsonFormat`; `TMDataGridExportFormat` for one of your own.
- `exportOptions` on `useTMDataGrid` - format, file name, header row and `columns` (`"visible"`, `"all"` or ids) for every export, the cell-range menu included.
- `columns="custom"` on the menu items opens a column picker: every exportable column, the visible ones ticked and the hidden ones marked, select all with a count, a search box from six columns, Export and Cancel. `ui.state.exportPicker`, `ui.actions.openExportPicker` / `closeExportPicker`, `getExportableColumns`.
- Column meta `enableExport` and `exportValue`.
- The text formats prefix a value that a spreadsheet would run as a formula; `escapeFormulas: false` on the format turns it off.
- `data-dg-part`: `menu-export`, `menu-export-selected`, `export-picker`, `export-picker-scope`, `export-picker-search`, `export-column`, `export-column-all`, `export-picker-count`, `export-picker-confirm`, `export-picker-cancel`.
- Labels: `exportAll`, `exportSelected(count)`, `exportPickerTitle`, `exportPickerConfirm`, `exportPickerCancel`, `exportPickerSelectAll`, `exportPickerCount(checked, total)`, `exportPickerHidden`, `exportCells` (the cell-range item, was `exportCsv`).
- Deprecated, removed in the next beta: `cellExport` on `TMDataGrid.Table`, `exportGridToCsv`, `TMDataGridCellExportOptions`, `DEFAULT_CELL_EXPORT_OPTIONS`, `buildCellMatrix`, `buildGridCellMatrix`, `TMDataGridCellMatrix`, `toExcelCsv`, `downloadTextFile`, `labels.exportCsv`.
- New package `@jielga/tmdatagrid-xlsx`: `xlsxFormat()` writes an Excel workbook with typed cells, on exceljs.

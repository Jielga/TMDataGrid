---
"@jielga/tmdatagrid": major
---

The deprecated API surface is removed:

- `cellExport` on `TMDataGrid.Table` - use `exportOptions` on `useTMDataGrid`.
- `exportGridToCsv` - use `exportGrid`.
- `TMDataGridCellExportOptions`, `DEFAULT_CELL_EXPORT_OPTIONS`, `fromCellExportOptions` - use `TMDataGridExportOptions` and `DEFAULT_EXPORT_OPTIONS`.
- `buildCellMatrix`, `buildGridCellMatrix`, `BuildCellMatrixArgs`, `TMDataGridCellMatrix` - use `buildExportData`, `BuildExportDataArgs` and `TMDataGridExportData`.
- `toExcelCsv` - use `csvExcelFormat`.
- `downloadTextFile` - use `downloadFile`.
- `labels.exportCsv` - use `labels.exportCells`.
- `editing.onCommitDrafts` - use `editing.onSaveDrafts`.
- `rows` and `added` in the `onSaveDrafts` payload - use `updated` and `created`.
- `TMDataGridEditCommitDraftsArgs` - use `TMDataGridSaveDraftsArgs`.
- `edit.submitAll()` - use `edit.commitAll()` then `edit.saveDrafts()`.
- `state.pendingCount` in `TMDataGrid.DraftActions` - use `state.draftCount` or `state.openCount`.

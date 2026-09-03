---
"@jielga/tmdatagrid": minor
---

`TMDataGrid.Toolbar`, `Spacer`, `Footer`, `FilterPanel`, `FilterPills` and
`ColumnsPanel` take Mantine's `BoxProps` - style props such as `mb`, `px` and
`hiddenFrom`, plus `className`, `style` and `mod` - set on their root element.
`TMDataGrid.Toolbar` gains `withBottomBorder`, a 1px line in the theme's
default border colour under the toolbar, off by default.
New types `TMDataGridToolbarProps` and `TMDataGridColumnsPanelProps`.

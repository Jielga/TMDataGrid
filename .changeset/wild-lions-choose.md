---
"@jielga/tmdatagrid": major
---

**Breaking.** The filter panel is no longer welded to `TMDataGrid.Table`. A new
`filters` option picks the surface:

- `surface: "popup"` (the default) floats the panel over the rows, as before.
- `surface: "sidebar"` puts it beside them, inside the grid frame. Starts open,
  and takes `sidebarSide` and `sidebarWidth`.
- `surface: "none"` renders no panel and no `FilterButton`, leaving a
  hand-placed `TMDataGrid.FilterPanel` as the only one on the page.
- `inHeader: true` adds a header row of per-column value controls, each with a
  funnel button for its operator. Independent of `surface`. The column menu's
  Filter item and the filtered-header funnel come off with it.

`TMDataGrid.FilterPanel` is now a plain block of controls with no title, no
close button and no open state - the popup and the sidebar own that chrome. It
takes `layout="row" | "stacked"`, and passes that through to every value
control.

What breaks:

- `TMDataGrid.FilterPanel` renders whenever it is mounted. It used to hide
  itself unless `ui.state.filterPanelOpen`, so a hand-placed one now shows
  permanently, and shows *alongside* the popup unless you also set
  `surface: "none"`.
- `filter-panel-close` moved out of `filter-panel`; it is now a child of
  `filter-popup` / `filter-sidebar`. A test scoping the close button inside the
  panel has to be re-pointed.
- `TMDataGridLabels` gained a required `filterOperatorFor`. A complete
  translation typed as `TMDataGridLabels` no longer compiles until it is added;
  `TMDataGridLabelsOverride` is unaffected.
- `TMDataGridApi` gained a required `filters`, and `TMDataGridFilterControlArgs`
  a required `layout` - both break code that builds one of these by hand rather
  than spreading, which in practice means test doubles.
- `ui.state.filterPanelColumnId` is now the panel's alone; the header row reads
  the new `headerFilterColumnId`. The actions are `focusPanelFilter` and
  `focusHeaderFilter`.

New exports: `TMDataGridFiltersOptions`, `TMDataGridFiltersSettings`,
`TMDataGridFilterSurface`, `TMDataGridFilterSidebarSide`,
`TMDataGridFilterControlLayout`, `TMDataGridFilterPanelLayout`,
`TMDataGridFilterPanelProps`, `TMDataGridFilterValueShape` and
`filterValueShape`.

Also fixed: a header group now spans the columns under it instead of sitting in
one track, and stacked header rows no longer pin to the same edge and paint
over each other.

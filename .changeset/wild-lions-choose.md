---
"@jielga/tmdatagrid": minor
---

The filter panel is no longer welded to the table. A new `filters` option picks
the surface:

- `surface: "popup"` (the default, unchanged) floats the panel over the rows.
- `surface: "sidebar"` puts it beside them, inside the grid frame, with
  `sidebarSide`, `sidebarWidth` and `defaultOpen`.
- `surface: "manual"` renders no panel and no `FilterButton`, so your own
  `TMDataGrid.FilterPanel` is the only one on the page.
- `inHeader: true` adds a header row of per-column value controls, each with a
  funnel button for its operator. The column menu's Filter item and the
  filtered-header funnel come off with it.

`TMDataGrid.FilterPanel` is now a plain block of controls with no title, no
close button and no open state - the popup and the sidebar own that chrome. It
takes `layout="stacked"` for a narrow host. Rendering it yourself no longer
gets you a second panel.

Also:

- `openColumnFilter` focuses the column's header control under `inHeader`
  instead of opening a panel, and `ui.actions.focusColumnFilter` does that on
  its own. Both surfaces now focus the column's value control.
- `meta.filter.control` components receive `layout: "panel" | "stacked" |
  "header"`.
- Fixed: a header group now spans the columns under it instead of sitting in
  one track, and stacked header rows no longer pin to the same edge and paint
  over each other.

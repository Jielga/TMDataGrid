---
"@jielga/tmdatagrid": minor
---

Row details: set `renderDetails` and an expanded row opens a panel underneath
it, spanning every column. Panels are measured, so they can be any height —
`renderDetailsEstHeight` is only what the virtualizer assumes before it has seen
one. The option also adds a generated chevron lane (`DETAILS_COLUMN_ID`), pinned
left after the checkbox and tree columns, whose header expands and collapses
every panel.

`resolveExpandAll` and `areAllRowsExpanded` are exported for building your own
expand-all: TanStack keeps one `expanded` state for both group rows and detail
panels, and these keep a control for one from disturbing the other.

The checkbox and details lanes are now 36px and render no resize handle, and
their cells carry `data-control-column` in place of `data-select-column`. Pinned
column edges only show while they are covering something, and no longer draw a
hard border.

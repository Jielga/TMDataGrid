---
"@jielga/tmdatagrid": minor
---

The generated lanes are no longer user settings: the checkbox lane and the edit
lane join the other three at `enableHiding: false`, "Manage columns" lists only
what can actually be hidden, and a column pinned right lands to the left of the
edit lane instead of outside it.

Three ways the panel could take a lane the grid needs out of the row. The
checkbox lane was listed like any other column, so ticking it off removed the
only way to select a row - with the selection state left behind and no obvious
way back. Show/hide all was worse: `table.toggleAllColumnsVisible` writes a
visibility entry for *every* leaf column, so "show all" published the tree
column - hidden because nothing is grouped, not because anyone hid it - and
"hide all" forced that same column visible, since it writes `!getCanHide()` for
the columns it will not touch. Under persistence the stray lane then came back
on every visit. The panel now writes only the columns it lists, and lists only
the columns whose `enableHiding` allows it, which leaves every generated lane
out by construction rather than as a disabled checkbox.

`column.pin("right")` appends to the right lane, so pinning a column right used
to drop it outside the edit lane and put the row's Save, Cancel and Delete in
the middle of the row. The grid now puts the generated lanes back on the outside
of both pinned lanes after a pin, preserving the user's own order among the
columns between them.

A column with `enableHiding: false` of your own is no longer rendered as a
disabled checkbox in the panel; it is left out. New export:
`keepGeneratedColumnsOutermost`, which is the pass the grid runs, for a
consumer writing `columnPinning` directly.

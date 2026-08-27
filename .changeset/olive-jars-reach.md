---
"@jielga/tmdatagrid": minor
---

`TMDataGrid.DraftActions`' `renderActions` can take the user to a row that is
still open. Closes [#46](https://github.com/Jielga/TMDataGrid/issues/46).

- `state.openRowIds` is the ids behind `openCount`, in the order the grid
  opened them.
- `actions.scrollToRow` is `grid.scrollToRow`, passed through.
- `actions.scrollToFirstOpenRow(align?)` scrolls to the first open row in
  display order - which need not be `openRowIds[0]` - and answers whether one
  was reached. An open entry row or a pinned open row answers `true` without
  scrolling.

`Controls.OpenRowsNote` is unchanged: it is a label, not a button.

Docs: the `DraftActions` slot table listed neither `draftCount`, `openCount`,
`commitAll` nor `OpenRowsNote`, and `scrollerRef` was documented as the scroll
container element, which it has never been.

---
"@jielga/tmdatagrid": major
---

**Breaking.** `editing.mode: "draft"` is removed. `editing` has two axes:
`mode` (`"cell" | "cellConfirm" | "row"`) picks what counts as a commit, and
`draft: true` parks commits in the draft store for `edit.saveDrafts()`.
Closes [#43](https://github.com/Jielga/TMDataGrid/issues/43).

- Migrate `{ mode: "draft" }` to `{ mode: "row", draft: true }` - or pair
  `draft` with any other mode.
- `TMDataGridEditMode` narrows to the three modes, `TMDataGridFeatureFlags`
  gains `editDraft`, and commit args never carry `source: "draft"`.
- Leaving a cell commits under `"cell"` (parks under `draft`), `"cellConfirm"`
  no longer commits on Tab, and leaving an entry row never commits it.
- `TMDataGrid.EditActions` is renamed `TMDataGrid.DraftActions`, with the
  `TMDataGridDraftActions*` exports renamed to match.
- Fixed: a row that fails validation on the way out keeps its error marks
  until the failing value changes; `edit.state.rows[id].errorMessages`
  carries the texts.

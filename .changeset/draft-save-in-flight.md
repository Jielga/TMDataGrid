---
"@jielga/tmdatagrid": minor
---

`edit.state.isSaving` is `true` while `saveDrafts` is in flight, and `TMDataGrid.DraftActions`' Save shows it as its loading state. `renderActions` receives it as `state.isSaving`. Part of [#89](https://github.com/Jielga/TMDataGrid/issues/89).

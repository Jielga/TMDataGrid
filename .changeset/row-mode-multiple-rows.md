---
"@jielga/tmdatagrid": patch
---

Fix `editMode: "row"` refusing to open a second row, and open gestures leaving the caret outside the editor.

- Rows now **accumulate**, as they already did under `"cellConfirm"` and `"batch"`. Opening a second row left the first alone only while it was pristine: a dirty row silently swallowed the gesture, so neither the pencil nor a double-click did anything until that row was saved or cancelled, and a pristine one was discarded to make space. Each row's ✓ and ✕ have always acted on that row alone, and now nothing about one row's draft bears on another's.
- **Every open gesture puts the caret in the cell it named**, and the grid places it rather than leaving it to the editor's `autoFocus`. Double-click, Enter and F2 on any cell but the row's first landed the caret on the cell instead of in its input - a Tab was still needed to reach it - and a custom `meta.editor` that ignored the prop never got the caret at all, in any mode. Focus goes to `data-dg-part="editor-input"` when the editor publishes it, and to the first focusable element inside the editor otherwise.
- The caret is placed once per gesture, so a row coming back into view no longer pulls it out of the row the user had moved it to.

`TMDataGridEditorArgs.autoFocus` is **deprecated** and still passed: the grid no longer depends on it, and it will go in the next major. `edit.begin({ rowId, columnId })` is unchanged for callers - row mode opens the whole row either way, and `columnId` now says which cell takes the caret, `null` leaving it to the row's first editable one. `edit.state.openRowIds` is which rows are editing.

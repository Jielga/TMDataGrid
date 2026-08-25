---
"@jielga/tmdatagrid": major
---

**Breaking.** Draft mode gets a real draft store, and the verbs are split to
match: a row is *open* (undecided form state) until it is committed, and only
committed rows are saved.

- `edit.commitAll()` submits every open row; `edit.saveDrafts()` sends the
  draft store. `edit.submitAll()` is deprecated and now does both in turn -
  what it always did in effect.
- `editing.onCommitDrafts` is renamed `editing.onSaveDrafts`. The old name is
  still honoured; the new one wins if both are set.
- `edit.addRows(rows, { commit })` adds a batch in one write. `commit: true`
  submits each row as it lands, which is the import case: valid rows commit,
  invalid ones stay open carrying their errors, and the result says which went
  which way.
- `newRows[].confirmed` is now `newRows[].committed`, and the entry row's
  `data-confirmed` attribute is `data-committed`. `edit.state` gains
  `committedRowIds`.
- `TMDataGridEditCommitDraftsArgs` is renamed `TMDataGridSaveDraftsArgs`, with
  the old name kept as a deprecated alias.

Two behaviour changes to know about:

**Save no longer sweeps rows that were never OK'd.** It sends the draft store
and leaves open rows alone - they keep what was typed and stay open for the
next save. `EditActions` counts the draft store on Save and shows how many rows
are still open beside it. Enter in draft mode now commits the row instead of
only closing the editor, so the ordinary keyboard flow still fills the store.
Call `edit.commitAll()` before saving to get the old sweep.

**Column validation no longer depends on a mounted editor.** `meta.edit.validate`
ran on the editor, so a commit with no editor on screen - an import, a
programmatic commit, Delete-to-clear on a cell that was never opened - skipped
it and could write past the rule. The engine now runs the column rules itself
at commit. Existing grids may see commits refused that previously went through;
those were the rule being bypassed.

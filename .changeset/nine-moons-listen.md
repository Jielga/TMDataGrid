---
"@jielga/tmdatagrid": minor
---

`onSaveDrafts` can save part of the draft store. Closes #33.

- The payload keys are renamed: `rows` is now `updated`, `added` is now
  `created`, `deleted` is unchanged. The old names are still filled and are
  deprecated; they are removed in a later beta.
- Returning `{ updated, created, deleted }` from `onSaveDrafts` keeps the ids
  reported `false` and clears the rest. Each key takes `false` for the whole
  bucket or a map of id to result; an id the map does not name saved. A kept
  row stays committed, so the next `saveDrafts()` retries it, and
  `saveDrafts()` resolves `false` when anything was kept. Returning nothing
  saves everything and throwing saves nothing, both unchanged.
- Body rows and entry rows carry `data-draft` while committed into the draft
  store. `data-dirty` continues to mark any row with values typed in.
- `saveDrafts()` called while a save is in flight joins it instead of sending
  the same payload again. Previously a double-clicked Save could create every
  pending entry row twice.

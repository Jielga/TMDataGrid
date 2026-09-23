---
"@jielga/tmdatagrid": minor
---

Boolean state attributes are present only while they apply. `data-selected`, `data-highlighted`, `data-grouped`, `data-deleted`, `data-dirty`, `data-draft`, `data-new` and `data-striped` on a row, `data-committed` on an entry row, `data-focused` and `data-selected` on a cell, `data-active` on a header cell, and the grid's other boolean `data-*` attributes are rendered as `"true"` while the state holds and omitted otherwise, instead of always present as `"true"` or `"false"`. `[data-x="true"]` selectors and `toHaveAttribute("data-x", "true")` assertions keep working; a `[data-x="false"]` selector becomes `:not([data-x])` and `toHaveAttribute("data-x", "false")` becomes `not.toHaveAttribute("data-x")`.

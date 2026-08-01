---
"@jielga/tmdatagrid": minor
---

Empty states: `renderEmptyState` on `TMDataGrid.Table` replaces the built-in empty messages, with `hasActiveFilters` distinguishing filtered-empty from truly-empty. A grid with no data and no filters now says `labels.noRows` ("No rows to show") instead of claiming filters matched nothing.

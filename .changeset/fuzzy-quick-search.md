---
"@jielga/tmdatagrid": major
---

Fuzzy quick search by default: `TMDataGrid.Search` now forgives typos and skipped characters, and while it is the only thing narrowing the grid the rows order by match quality. `quickSearchMode: "contains"` restores the old substring matching; an explicit `globalFilterFn` overrides both. Adds `@tanstack/match-sorter-utils` as a dependency.

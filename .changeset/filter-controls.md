---
"@jielga/tmdatagrid": minor
---

Custom filter controls: `meta.filterControl` replaces the filter panel's value slot with a component receiving the value-only `TMDataGridFilterControlArgs` contract — it reads the operator, writes the bare value, and the grid composes the stored filter. Four built-ins ship as named exports (`DgRangeSliderFilter`, `DgDateRangeFilter`, `DgAutocompleteFilter`, `DgTriStateFilter`), plus `TMDataGridFilterValueInput`, the default control, for fallbacks. New label: `filterAll`.

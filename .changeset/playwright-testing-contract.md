---
"@jielga/tmdatagrid": patch
---

- Testing contract: `header-resize` on the column resize handle and `filter-pill-remove` on a filter pill's ✕. The Testing page now documents the portaled surfaces, `data-dg-scroll-container` and component tests with Playwright stories, and its `DataGrid` page object is the one the grid's own Playwright suite runs.
- Fix: one click on a header's sort arrow advanced the sort two steps.
- Fix: the `TMDataGrid.Menu` button now carries `aria-expanded` and `aria-controls`; the tooltip between it and the menu target swallowed them.

---
"@jielga/tmdatagrid": minor
---

A published testing contract, so a suite is written against structure rather than translated `aria-label`s. Every named piece of the grid carries `data-dg-part` — the chrome, panels, generated lanes and editors — narrowed by `data-row-id` / `data-column-id` where a part repeats. `data-testid` and `id` on `<TMDataGrid>` and `aria-label` on `TMDataGrid.Table` name a grid when a page holds several. Body cells always carry `data-row-id`, headers now carry `data-column-id`, and the grid publishes `aria-busy` and `data-dg-row-count` for tests to wait on. New Testing docs page covers the parts, the roles and Playwright.

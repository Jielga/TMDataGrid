---
"@jielga/tmdatagrid": minor
---

A published testing contract: `data-testid` on the chrome, panels, lanes and editors, so a suite is written against structure rather than translated `aria-label`s. `data-testid`/`id` on `<TMDataGrid>` and `aria-label` on `TMDataGrid.Table` name a grid when a page holds several; body cells always carry `data-row-id`, headers now carry `data-column-id`, and the grid publishes `aria-busy` and `data-dg-row-count` for tests to wait on. New Testing docs page covers the ids, the roles and Playwright.

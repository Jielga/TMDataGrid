---
name: testing
description: >
  Write tests against TMDataGrid from a consuming app - Playwright or React
  Testing Library. Covers the data-dg-part contract, data-row-id/data-column-id
  coordinates, naming a grid with data-testid, the roles and ARIA the grid
  publishes, the cell/gridcell role flip under cell selection, reaching rows
  past virtualization with data-dg-row-count and scrollToRow, and waiting on
  aria-busy. Load when writing or fixing tests that drive a grid, or when a
  selector for a row, cell or control does not resolve.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.0.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/testing.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/components/TMDataGrid.tsx'
  - 'Jielga/TMDataGrid:src/tmdatagrid/components/TMDataGridTable.tsx'
---

# TMDataGrid - Testing

The grid names its own pieces so a suite can be written against structure
rather than against copy or class names. Three hooks carry it:

- **`data-dg-part`** - *what* an element is (`"row"`, `"filter-button"`)
- **`data-row-id` / `data-column-id`** - *which* one, using your own ids
- **roles and ARIA** - framework-neutral, and what a screen reader reads

Selectors compose: `[data-dg-part="save-row"][data-row-id="42"]`.

The grid mints no `data-testid` of its own - that attribute belongs to the app,
and Playwright's `testIdAttribute` is configurable. `@mantine/core` and
`@tanstack/*` ship none either.

## Naming a grid

Parts repeat across grids on a page. Name the grid, scope through it:

```tsx
<TMDataGrid {...grid} data-testid="orders">
  <TMDataGrid.Table<Order> aria-label="Orders" />
</TMDataGrid>
```

`data-testid` and `id` go on the root (which also carries `data-dg-root`);
`aria-label` or `aria-labelledby` goes on `TMDataGrid.Table`, because the
accessible name belongs to the element carrying the `grid` role.

## Roles

| Element | Role | Key attributes |
| --- | --- | --- |
| Grid | `table`, or `grid` under cell selection | `aria-rowcount`, `aria-colcount`, `aria-busy`, `data-dg-row-count` |
| Body row | `row` | `data-row-id`, `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-pinned`, `data-deleted` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused` |
| Header cell | `columnheader` | `data-column-id`, `aria-sort` |

Body cells carry no `data-dg-part` - the coordinate pair already names them.

## Parts

**Whole-grid** (unique, no coordinate needed): `toolbar`, `summary-count`,
`loading`, `search`, `search-clear`, `filter-button`, `filter-panel`,
`filter-panel-close`, `filter-add`, `filter-clear-all`, `filter-pills`,
`columns-button`, `columns-panel`, `columns-search`, `columns-toggle-all`,
`columns-reset`, `footer`, `page-size`, `page-range`, `page-prev`, `page-next`,
`summary-row`, `pinned-top`, `pinned-bottom`, `select-all`,
`details-toggle-all`, `save-all`, `discard-all`, `editor-confirm`,
`editor-cancel`, `editor-input`, `sort-index`.

**Keyed by `data-row-id`**: `row`, `entry-row`, `details`, `select-row`,
`details-toggle`, `group-toggle`, `edit-row`, `delete-row`, `save-row`,
`cancel-row`, `restore-row`, `confirm-new-row`, `discard-new-row`.

**Keyed by `data-column-id`**: `header`, `header-sort`, `header-menu`,
`header-filter`, `filter-row`, `filter-pill`, `columns-toggle`.

**Keyed by both**: `editor`.

Inside a `filter-row` the controls are `filter-column`, `filter-operator` and
`filter-value` - or `filter-value-from` / `filter-value-to` for `between`.

A column declaring `meta.filterControl` or `meta.editor` renders your own
component in that slot, so `filter-value` and `editor-input` cover the built-ins
only. `filter-row` and `editor` still hold; scope through them.

## A page object

```ts
import { type Locator, type Page, expect } from "@playwright/test";

type PartKey = { rowId?: string; columnId?: string };

export class DataGrid {
  readonly root: Locator;
  readonly grid: Locator;

  constructor(page: Page, testId: string) {
    this.root = page.getByTestId(testId);
    this.grid = this.root.getByRole("table");
  }

  part(name: string, key: PartKey = {}): Locator {
    return this.root.locator(
      `[data-dg-part="${name}"]` +
        (key.rowId === undefined ? "" : `[data-row-id="${key.rowId}"]`) +
        (key.columnId === undefined ? "" : `[data-column-id="${key.columnId}"]`),
    );
  }

  cell({ rowId, columnId }: { rowId: string; columnId: string }): Locator {
    return this.root.locator(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]`,
    );
  }

  async expectRowCount(count: number): Promise<void> {
    await expect(this.grid).toHaveAttribute("data-dg-row-count", String(count));
  }

  async expectSettled(): Promise<void> {
    await expect(this.grid).not.toHaveAttribute("aria-busy");
  }
}
```

## Virtualization

Only the rows in the viewport plus overscan are in the DOM. A row at index 500
has no element, and Playwright cannot scroll to what it cannot find.

**Count rows off the grid.** `data-dg-row-count` is the body rows the grid is
showing - the current page under pagination, everything the filters left
otherwise. (`aria-rowcount` also counts the header and summary rows.)

**Reach a row by narrowing to it** - filter or search. Faster, more stable, and
what a user would do. Where the row must be reached in place,
`grid.scrollToRow({ rowId, align })` moves the virtualizer and answers whether
the row was reachable; from Playwright that needs the app to expose the api.

## Waiting

`meta.loading` sets `aria-busy` on the grid whether or not the body has rows, so
a refetch over existing rows is visible to a test. Quick search debounces
(250 ms by default). Assert on `data-dg-row-count` and let Playwright retry
rather than adding a timeout.

## Common mistakes

### Selecting chrome by its aria-label

Every icon-only control has one, but they come from `labels` and are yours to
translate. A suite written on `getByRole("button", { name: "Filters" })` breaks
the day the grid renders in Swedish, and again on any copy change. Use the part.

### Counting row elements

`expect(rows).toHaveLength(50)` fails at any real row count, because
virtualization mounts a couple of dozen. Under jsdom it is worse: there is no
layout, so the count depends on the stubbed element size. Assert
`data-dg-row-count`.

### getByRole("cell") on a grid with cell selection

`enableCellSelection` turns every `cell` into a `gridcell`, and the grid's
`table` into a `grid` - a widget with a keyboard cursor is not a table of
content. Tests written on the role break when the feature is switched on. Query
cells by `[data-row-id][data-column-id]`, which do not move.

### Expecting a row far down the list to exist

`dg-row-450` has no element until it is scrolled to, so the locator times out
with no useful message. Filter or search down to it first.

### Unscoped parts with two grids on a page

`page.locator('[data-dg-part="row"]')` matches both grids and Playwright's
strict mode fails on the ambiguity. Give each grid a `data-testid` and scope
every query through it.

### Adding data-testid and expecting the grid to honour it

`data-testid` on `<TMDataGrid>` lands on the root element only; it is not a
prefix that propagates to the parts inside. Scope through the root instead of
looking for `orders-row-42`.

### Asserting on a column's cells through nth-child

Column order changes with pinning, reordering and the generated lanes
(checkbox, tree, details, row numbers, edit), so a positional index points at a
different column than it did. Use `[data-column-id]`.

### Waiting on the toolbar spinner

`data-dg-part="loading"` only renders where `TMDataGrid.LoadingIndicator` was
placed, and only while `meta.loading` is true. `aria-busy` on the grid is set
regardless of whether that component is rendered.

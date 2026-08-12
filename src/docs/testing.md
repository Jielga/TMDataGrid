# Testing

The grid publishes a fixed set of roles, ARIA attributes and test ids so that a
consumer's suite can be written against structure rather than against copy or
class names. Everything on this page is a supported contract; anything else in
the DOM is internal plumbing and may change without notice.

> During the `1.0.0-beta` line the contract is still provisional. It freezes at
> `1.0.0`.

## Naming a grid

The grid's test ids are keyed on row and column ids, which two grids on the same
page share. Name the grid and scope through it:

```tsx
<TMDataGrid {...grid} data-testid="orders">
  <TMDataGrid.Table<Order> aria-label="Orders" />
</TMDataGrid>
```

```ts
const orders = page.getByTestId("orders");
await expect(orders.getByTestId("dg-row-42")).toBeVisible();
```

`data-testid` and `id` go on the root element; `aria-label` (or
`aria-labelledby`) goes on `TMDataGrid.Table`, because the accessible name
belongs to the element carrying the `grid` role.

## Structure

| Element | Role | Attributes |
| --- | --- | --- |
| Root | — | `data-dg-root`, `data-size` |
| Grid | `table`, or `grid` under cell selection | `aria-rowcount`, `aria-colcount`, `aria-busy`, `data-dg-row-count` |
| Header row | `row` | `aria-rowindex` |
| Header cell | `columnheader` | `data-column-id`, `aria-sort`, `data-active` |
| Body row | `row` | `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-depth`, `data-pinned`, `data-deleted`, `data-striped` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-align`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused`, `data-selected` |
| Summary row | `row` | — |

**The role flips with cell selection.** `enableCellSelection` turns the grid's
`table` into a `grid` and every `cell` into a `gridcell` — a widget with a
keyboard cursor is not the same thing as a table of content, and saying `grid`
without one would promise arrow keys that do nothing. A suite written on
`getByRole("cell")` therefore breaks when the feature is switched on. Query
cells by their coordinates instead, which do not move:

```ts
const cell = orders.locator('[data-row-id="42"][data-column-id="total"]');
```

## Test ids

Row and column ids come from your data — `getRowId` and the column definitions —
so `dg-row-42` means your record 42.

| Test id | What it is |
| --- | --- |
| `dg-row-<rowId>` | A body row, wherever it sits |
| `dg-entry-<rowId>` | An open entry row in the new-row block |
| `dg-details-<rowId>` | A row's detail panel |
| `dg-pinned-top` / `dg-pinned-bottom` | The pinned-row edge blocks |
| `dg-summary-row` | The footer summary row |
| `dg-header-<columnId>` | A column header |
| `dg-header-sort-<columnId>` | Its sort button |
| `dg-header-menu-<columnId>` | Its column menu button |
| `dg-header-filter-<columnId>` | Its filter shortcut, shown while filtered |
| `dg-sort-index` | A column's position in a multi-column sort |
| `dg-toolbar` | The toolbar row |
| `dg-summary-count` | The visible/total count |
| `dg-loading` | The toolbar spinner |
| `dg-search` / `dg-search-clear` | Quick search input and its ✕ |
| `dg-filter-button` | The funnel toggle |
| `dg-filter-panel` / `dg-filter-panel-close` | The filter panel and its ✕ |
| `dg-filter-row-<columnId>` | One filter row; also carries `data-column-id` |
| `dg-filter-column` / `dg-filter-operator` / `dg-filter-value` | Its three controls |
| `dg-filter-value-from` / `dg-filter-value-to` | The two ends of a `between` filter |
| `dg-filter-remove` | The filter row's ✕ |
| `dg-filter-add` / `dg-filter-clear-all` | The panel's footer buttons |
| `dg-filter-pills` | The active-filter pill group |
| `dg-filter-pill-<columnId>` | One pill; its ✕ is the only button inside it |
| `dg-columns-button` | The burger toggle |
| `dg-columns-panel` / `dg-columns-search` | The column manager and its search |
| `dg-columns-toggle-<columnId>` / `dg-columns-toggle-all` | Its checkboxes |
| `dg-columns-reset` | Its reset-layout button |
| `dg-footer` | The pager row |
| `dg-page-size` / `dg-page-range` / `dg-page-prev` / `dg-page-next` | The pager |
| `dg-select-all` / `dg-select-row-<rowId>` | Selection checkboxes |
| `dg-details-toggle-<rowId>` / `dg-details-toggle-all` | Detail chevrons |
| `dg-group-toggle-<rowId>` | A group row's chevron |
| `dg-edit-row-<rowId>` / `dg-delete-row-<rowId>` | The edit lane, idle |
| `dg-save-row-<rowId>` / `dg-cancel-row-<rowId>` | The edit lane, open |
| `dg-restore-row-<rowId>` | Undo a batch deletion mark |
| `dg-confirm-new-row-<rowId>` / `dg-discard-new-row-<rowId>` | An entry row's ✓ and ✕ |
| `dg-editor-<rowId>-<columnId>` | An open cell editor |
| `dg-editor-input` | The input inside a built-in editor |
| `dg-editor-confirm` / `dg-editor-cancel` | `cellConfirm`'s ✓ and ✕ |
| `dg-save-all` / `dg-discard-all` | `TMDataGrid.EditActions` |

A column declaring `meta.filterControl` or `meta.editor` renders your component
in that slot, so `dg-filter-value` and `dg-editor-input` are the built-ins only.
`dg-filter-row-<columnId>` and `dg-editor-<rowId>-<columnId>` still hold — scope
your own queries through them.

Every icon-only control also carries an `aria-label` drawn from `labels`. Those
are yours to translate, so they make brittle selectors; prefer the test ids
above unless your grid runs in one language.

## Virtualization

The grid is always virtualized: only the rows in the viewport plus overscan are
in the DOM. A row at index 500 has no element, and Playwright cannot scroll to
what it cannot find. Two things follow.

**Count rows off the grid, not off the DOM.** `aria-rowcount` includes the
header and summary rows; `data-dg-row-count` is the body rows alone — the
current page under pagination, everything the filters left otherwise.

```ts
const grid = orders.getByRole("table");
await expect(grid).toHaveAttribute("data-dg-row-count", "3");
```

**Reach a row by narrowing to it.** Filtering or searching is faster and far
more stable than scrolling, and it is what a user would do:

```ts
await orders.getByTestId("dg-search").fill("Nordkvist");
await expect(orders.getByTestId("dg-row-42")).toBeVisible();
```

## Waiting

`meta.loading` sets `aria-busy` on the grid whether or not the body has rows, so
a refetch over existing rows is still visible to a test:

```ts
await expect(grid).toHaveAttribute("aria-busy", "true");
await expect(grid).not.toHaveAttribute("aria-busy");
```

Quick search debounces (250 ms by default, `debounce` on `TMDataGrid.Search`).
Assert on `data-dg-row-count` rather than adding a timeout — Playwright retries
the assertion until the debounce lands.

## A page object

```ts
import { type Locator, type Page, expect } from "@playwright/test";

export class DataGrid {
  readonly root: Locator;
  readonly grid: Locator;

  constructor(page: Page, testId: string) {
    this.root = page.getByTestId(testId);
    this.grid = this.root.getByRole("table");
  }

  row(rowId: string): Locator {
    return this.root.getByTestId(`dg-row-${rowId}`);
  }

  cell({ rowId, columnId }: { rowId: string; columnId: string }): Locator {
    return this.root.locator(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]`,
    );
  }

  async search(text: string): Promise<void> {
    await this.root.getByTestId("dg-search").fill(text);
  }

  async sortBy(columnId: string): Promise<void> {
    await this.root.getByTestId(`dg-header-sort-${columnId}`).click();
  }

  async filterBy({
    columnId,
    value,
  }: {
    columnId: string;
    value: string;
  }): Promise<void> {
    await this.root.getByTestId("dg-filter-button").click();
    const row = this.root.getByTestId(`dg-filter-row-${columnId}`);
    await row.getByTestId("dg-filter-value").fill(value);
  }

  async toggleColumn(columnId: string): Promise<void> {
    await this.root.getByTestId("dg-columns-button").click();
    await this.root.getByTestId(`dg-columns-toggle-${columnId}`).click();
  }

  async expectRowCount(count: number): Promise<void> {
    await expect(this.grid).toHaveAttribute(
      "data-dg-row-count",
      String(count),
    );
  }

  async expectSettled(): Promise<void> {
    await expect(this.grid).not.toHaveAttribute("aria-busy");
  }
}
```

```ts
test("filters to one employee", async ({ page }) => {
  const grid = new DataGrid(page, "employees");
  await page.goto("/employees");
  await grid.expectSettled();

  await grid.filterBy({ columnId: "lastName", value: "Nordkvist" });
  await grid.expectRowCount(1);
  await expect(grid.cell({ rowId: "42", columnId: "city" })).toHaveText(
    "Stockholm",
  );
});
```

## React Testing Library

Under jsdom there is no layout, so the virtualizer mounts a handful of rows
whatever the data says. Assert on the grid's own counts rather than on the
number of row elements:

```tsx
const rowCount = Number(
  screen.getByRole("table").getAttribute("data-dg-row-count"),
);
expect(rowCount).toBe(3);
```

Mantine's transitions never settle under jsdom, so a Popover's dropdown mounts
empty — the filter and column panels among them. Render inside
`<MantineProvider env="test">`.

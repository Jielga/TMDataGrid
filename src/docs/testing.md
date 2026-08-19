# Testing

The grid publishes a fixed set of roles, ARIA attributes and `data-*` hooks so
that a consumer's suite can be written against structure rather than against
copy or class names. Everything on this page is a supported contract; anything
else in the DOM is internal plumbing and may change without notice.

> During the `1.0.0-beta` line the contract is still provisional. It freezes at
> `1.0.0`.

## Why not `data-testid`

The grid does not mint `data-testid` of its own, and neither do its
dependencies - `@mantine/core` and `@tanstack/*` ship none. `data-testid` is a
testing-framework convention that belongs to your app: Playwright's
`testIdAttribute` is configurable, so a codebase standardised on `data-qa` or
`data-cy` could not use `getByTestId()` on our nodes without breaking its own.

Instead the grid names its pieces the way MUI X and AG Grid do - with semantic
attributes it owns:

- **`data-dg-part`** - *what* an element is (`"row"`, `"filter-button"`)
- **`data-row-id` / `data-column-id`** - *which* one, using your own ids
- **roles and ARIA** - framework-neutral, and the same thing a screen reader reads

`<TMDataGrid data-testid>` is the one exception, because that value is yours,
not ours.

## Naming a grid

Parts repeat across grids on the same page. Name the grid and scope through it:

```tsx
<TMDataGrid {...grid} data-testid="orders">
  <TMDataGrid.Table<Order> aria-label="Orders" />
</TMDataGrid>
```

```ts
const orders = page.getByTestId("orders");
await expect(orders.locator('[data-dg-part="row"][data-row-id="42"]')).toBeVisible();
```

`data-testid` and `id` go on the root element (which also carries
`data-dg-root`); `aria-label` (or `aria-labelledby`) goes on
`TMDataGrid.Table`, because the accessible name belongs to the element carrying
the `grid` role.

## Structure

| Element | Role | Attributes |
| --- | --- | --- |
| Root | - | `data-dg-root`, `data-size` |
| Grid | `table`, or `grid` under cell selection | `aria-rowcount`, `aria-colcount`, `aria-busy`, `data-dg-row-count` |
| Header row | `row` | `aria-rowindex` |
| Header cell | `columnheader` | `data-dg-part="header"`, `data-column-id`, `aria-sort`, `data-active` |
| Body row | `row` | `data-dg-part="row"`, `data-row-id`, `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-depth`, `data-pinned`, `data-deleted`, `data-striped` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-align`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused`, `data-selected` |

**The role flips with cell selection.** `enableCellSelection` turns the grid's
`table` into a `grid` and every `cell` into a `gridcell` - a widget with a
keyboard cursor is not the same thing as a table of content, and saying `grid`
without one would promise arrow keys that do nothing. A suite written on
`getByRole("cell")` therefore breaks when the feature is switched on. Query
cells by their coordinates instead, which do not move:

```ts
const cell = orders.locator('[data-row-id="42"][data-column-id="total"]');
```

Body cells carry no `data-dg-part`: the coordinate pair already names them, and
one attribute per cell is the one place where a virtualized grid's DOM weight
is worth counting.

## Parts

Row and column ids come from your data (`getRowId` and the column definitions),
so a part that repeats is addressed by adding the coordinate.

### Whole-grid

| `data-dg-part` | What it is |
| --- | --- |
| `toolbar` | The toolbar row |
| `summary-count` | The visible/total count |
| `loading` | The toolbar spinner |
| `search`, `search-clear` | Quick search input and its ✕ |
| `filter-button` | The funnel toggle |
| `filter-panel`, `filter-panel-close` | The filter panel and its ✕ |
| `filter-add`, `filter-clear-all` | The panel's footer buttons |
| `filter-pills` | The active-filter pill group |
| `columns-button` | The burger toggle |
| `columns-panel`, `columns-search` | The column manager and its search |
| `columns-toggle-all`, `columns-reset` | Its footer controls |
| `footer` | The pager row |
| `page-size`, `page-range`, `page-prev`, `page-next` | The pager |
| `summary-row` | The footer summary row |
| `pinned-top`, `pinned-bottom` | The pinned-row edge blocks |
| `select-all` | The header select-all checkbox |
| `details-toggle-all` | Expand/collapse every detail panel |
| `save-all`, `discard-all` | `TMDataGrid.EditActions` |
| `editor-confirm`, `editor-cancel` | `cellConfirm`'s ✓ and ✕ |
| `editor-input` | The input inside a built-in editor |
| `sort-index` | A column's position in a multi-column sort |

### Keyed by `data-row-id`

| `data-dg-part` | What it is |
| --- | --- |
| `row` | A body row, wherever it sits |
| `entry-row` | An open entry row in the new-row block |
| `details` | A row's detail panel |
| `select-row` | Its selection checkbox |
| `details-toggle`, `group-toggle` | Its detail and tree chevrons |
| `edit-row`, `delete-row` | The edit lane, idle |
| `save-row`, `cancel-row` | The edit lane, open |
| `restore-row` | Undo a batch deletion mark |
| `confirm-new-row`, `discard-new-row` | An entry row's ✓ and ✕ |

### Keyed by `data-column-id`

| `data-dg-part` | What it is |
| --- | --- |
| `header` | A column header |
| `header-sort`, `header-menu`, `header-filter` | Its three action buttons |
| `filter-row` | One row of the filter panel |
| `filter-pill` | One active-filter pill; its ✕ is the only button inside it |
| `columns-toggle` | One checkbox in the column manager |

### Keyed by both

| `data-dg-part` | What it is |
| --- | --- |
| `editor` | An open cell editor |

Within a filter row the three controls are `filter-column`,
`filter-operator` and `filter-value` (or `filter-value-from` /
`filter-value-to` for `between`).

A column declaring `meta.filterControl` or `meta.editor` renders your component
in that slot, so `filter-value` and `editor-input` cover the built-ins only.
`filter-row` and `editor` still hold - scope your own queries through them.

`editor-input` is also where the grid puts the caret when an editor opens. An
editor that does not publish it is focused on the first focusable element inside
its `editor` instead, so a custom editor needs the attribute only to name which
of several inputs the caret should land in.

Every icon-only control also carries an `aria-label` drawn from `labels`. Those
are yours to translate, so they make brittle selectors; prefer the parts above
unless your grid runs in one language.

## Virtualization

The grid is always virtualized: only the rows in the viewport plus overscan are
in the DOM. A row at index 500 has no element, and Playwright cannot scroll to
what it cannot find. Two things follow.

**Count rows off the grid, not off the DOM.** `aria-rowcount` includes the
header and summary rows; `data-dg-row-count` is the body rows alone - the
current page under pagination, everything the filters left otherwise.

```ts
const grid = orders.getByRole("table");
await expect(grid).toHaveAttribute("data-dg-row-count", "3");
```

**Reach a row by narrowing to it.** Filtering or searching is faster and far
more stable than scrolling, and it is what a user would do:

```ts
await orders.locator('[data-dg-part="search"]').fill("Nordkvist");
await expect(orders.locator('[data-row-id="42"]').first()).toBeVisible();
```

**Or scroll to it.** When the row has to be reached where it is - testing the
scroll itself, or a grid with no search - `scrollToRow` moves the virtualizer,
which is the only thing that can put an element there:

```ts
const found = grid.scrollToRow({ rowId: "42", align: "center" });
```

It answers `false` when the row is not in the current view - filtered out, on
another page, or an unknown id - and scrolls nothing. From a Playwright test
that means going through the page, since the api lives in React:

```ts
await page.evaluate(() => window.__ordersGrid.scrollToRow({ rowId: "42" }));
```

which needs the app to expose it. Narrowing needs no such hook, which is why it
is the default advice.

## Waiting

`meta.loading` sets `aria-busy` on the grid whether or not the body has rows, so
a refetch over existing rows is still visible to a test:

```ts
await expect(grid).toHaveAttribute("aria-busy", "true");
await expect(grid).not.toHaveAttribute("aria-busy");
```

Quick search debounces (250 ms by default, `debounce` on `TMDataGrid.Search`).
Assert on `data-dg-row-count` rather than adding a timeout - Playwright retries
the assertion until the debounce lands.

## A page object

One helper turns the parts into something as short as `getByTestId`:

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

  /** A named part, narrowed by row or column when the part repeats. */
  part(name: string, key: PartKey = {}): Locator {
    const selector =
      `[data-dg-part="${name}"]` +
      (key.rowId === undefined ? "" : `[data-row-id="${key.rowId}"]`) +
      (key.columnId === undefined ? "" : `[data-column-id="${key.columnId}"]`);
    return this.root.locator(selector);
  }

  cell({ rowId, columnId }: { rowId: string; columnId: string }): Locator {
    return this.root.locator(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]`,
    );
  }

  async search(text: string): Promise<void> {
    await this.part("search").fill(text);
  }

  async sortBy(columnId: string): Promise<void> {
    await this.part("header-sort", { columnId }).click();
  }

  async filterBy({
    columnId,
    value,
  }: {
    columnId: string;
    value: string;
  }): Promise<void> {
    await this.part("filter-button").click();
    await this.part("filter-row", { columnId })
      .locator('[data-dg-part="filter-value"]')
      .fill(value);
  }

  async toggleColumn(columnId: string): Promise<void> {
    await this.part("columns-button").click();
    await this.part("columns-toggle", { columnId }).click();
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
empty - the filter and column panels among them. Render inside
`<MantineProvider env="test">`.

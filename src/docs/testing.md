# Testing

The grid publishes a fixed set of roles, ARIA attributes and `data-*` hooks so
that a consumer's suite can be written against structure rather than against
copy or class names. Everything on this page is supported. Anything else in the
DOM is internal and may change without notice.

> Renaming or dropping anything on this page is a breaking change, so it moves
> only with a major version.

## Selector attributes

The grid publishes three kinds of selector, and no `data-testid` of its own:

- `data-dg-part` - what an element is (`"row"`, `"filter-button"`)
- `data-row-id` and `data-column-id` - which one, using your own ids
- roles and ARIA - the same thing a screen reader reads

`data-testid` is left to your suite, whose `testIdAttribute` may be `data-qa` or
`data-cy` rather than `data-testid`. The one exception is
`<TMDataGrid data-testid>`, which sets the value you pass.

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
| Body row | `row` | `data-dg-part="row"`, `data-row-id`, `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-depth`, `data-pinned`, `data-deleted`, `data-dirty`, `data-draft`, `data-striped` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-align`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused`, `data-selected` |

**The role changes with cell selection.** `cellSelection` turns the grid's
`table` into a `grid` and every `cell` into a `gridcell`, so a suite written on
`getByRole("cell")` breaks when the feature is switched on. Query cells by their
coordinates instead:

```ts
const cell = orders.locator('[data-row-id="42"][data-column-id="total"]');
```

Body cells carry no `data-dg-part`; the coordinate pair identifies them.

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
| `save-all`, `discard-all` | `TMDataGrid.DraftActions`. `save-all` carries `data-draft-count` - the rows the save will send |
| `editor-confirm`, `editor-cancel` | `cellConfirm`'s ✓ and ✕ |
| `editor-input` | The input inside a built-in editor |
| `sort-index` | A column's position in a multi-column sort |
| `tab-guard` | The body's tab stop under [cell selection](/docs/cell-selection); `data-guard` is `leading` (before the rows) or `trailing` (after them). Zero-size, and focusing one puts the cursor on a cell |

### Keyed by `data-row-id`

| `data-dg-part` | What it is |
| --- | --- |
| `row` | A body row, pinned or not |
| `entry-row` | An entry row. Carries `data-new`, and `data-committed` / `data-draft` once parked in the draft store |
| `details` | A row's detail panel |
| `select-row` | Its selection checkbox |
| `details-toggle`, `group-toggle` | Its detail and tree chevrons |
| `edit-row`, `delete-row` | The edit lane, idle. `edit-row` also reopens an entered new row |
| `save-row`, `cancel-row` | The edit lane's Save and Cancel on an open row |
| `row-state` | The draft store's change marker; `data-state` is `new`, `edited` or `deleted` |
| `revert-row` | Drops a parked row's draft |
| `restore-row` | Undo a deletion mark |
| `confirm-new-row`, `discard-new-row` | An entry row's ✓ (commit) and ✕ |
| `open-rows-note` | `DraftActions`' count of rows still open. Carries `data-open-count`; absent while there are none |

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

A column declaring `meta.filter.control` or `meta.edit.editor` renders your component
in that slot, so `filter-value` and `editor-input` cover the built-ins only.
`filter-row` and `editor` still apply; scope your own queries through them.

`editor-input` is also where the grid puts the caret when an editor opens. An
editor that does not publish it is focused on the first focusable element inside
its `editor` instead, so a custom editor needs the attribute only to name which
of several inputs the caret should land in.

Every icon-only control also carries an `aria-label` drawn from `labels`. Those
are translated, so they make brittle selectors. Prefer the parts above unless
your grid runs in one language.

## Virtualization

The grid is always virtualized: only the rows in the viewport plus overscan are
in the DOM. A row at index 500 has no element, and Playwright cannot scroll to
what it cannot find.

**Count rows off the grid, not off the DOM.** `aria-rowcount` includes the
header and summary rows. `data-dg-row-count` counts the body rows alone: the
current page under pagination, or everything the filters left otherwise.

```ts
const grid = orders.getByRole("table");
await expect(grid).toHaveAttribute("data-dg-row-count", "3");
```

**Reach a row by narrowing to it.** Filtering or searching is faster and more
stable than scrolling:

```ts
await orders.locator('[data-dg-part="search"]').fill("Nordkvist");
await expect(orders.locator('[data-row-id="42"]').first()).toBeVisible();
```

**Or scroll to it.** When the row must be reached in place, such as when testing
the scroll itself, `scrollToRow` moves the virtualizer:

```ts
const found = grid.scrollToRow({ rowId: "42", align: "center" });
```

It returns `false` when the row is not in the current view (filtered out, on
another page, or an unknown id) and scrolls nothing. From a Playwright test it
has to be called through the page, since the API lives in React:

```ts
await page.evaluate(() => window.__ordersGrid.scrollToRow({ rowId: "42" }));
```

which requires the app to expose the grid on `window`. Narrowing needs no such
hook.

## Waiting

`meta.loading` sets `aria-busy` on the grid whether or not the body has rows, so
a refetch over existing rows is still visible to a test:

```ts
await expect(grid).toHaveAttribute("aria-busy", "true");
await expect(grid).not.toHaveAttribute("aria-busy");
```

Quick search debounces (250 ms by default, `debounce` on `TMDataGrid.Search`).
Assert on `data-dg-row-count` rather than adding a timeout. Playwright retries
the assertion until the debounce lands.

## A page object

A helper class wraps the parts:

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
empty, including the filter and column panels. Render inside
`<MantineProvider env="test">`.

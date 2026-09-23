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
| Body row | `row` | `data-dg-part="row"`, `data-row-id`, `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-depth`, `data-pinned`, `data-deleted`, `data-dirty`, `data-draft`, `data-new`, `data-striped` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-align`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused`, `data-selected` |

**The role changes with cell selection.** `cellSelection` turns the grid's
`table` into a `grid` and every `cell` into a `gridcell`, so a suite written on
`getByRole("cell")` breaks when the feature is switched on. Query cells by their
coordinates instead:

```ts
const cell = orders.locator('[data-row-id="42"][data-column-id="total"]');
```

Body cells carry no `data-dg-part`; the coordinate pair identifies them.

**Row state is a value, cell state is presence.** `data-deleted`, `data-dirty`,
`data-draft` and `data-new` are always present on a body row, with the value
`"true"` or `"false"`, and `data-committed` and `data-draft` on an entry row
likewise. `[data-new]` therefore matches every row; select on the value:

```ts
const drafts = orders.locator('[data-dg-part="row"][data-draft="true"]');
```

`data-editing`, `data-dirty` and `data-invalid` on a cell are present, with the
value `"true"`, only while they apply.

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
| `filter-panel` | The panel of filter rows, wherever it is rendered |
| `filter-popup`, `filter-sidebar` | The surface holding it, under `filters.surface` |
| `filter-panel-close` | The surface's ✕; absent on a hand-placed panel |
| `filter-add`, `filter-clear-all` | The panel's footer buttons |
| `header-filter-row` | The header filter row, under `filters.inHeader` |
| `filter-pills` | The active-filter pill group |
| `menu-button` | The burger, `TMDataGrid.Menu` |
| `columns-panel`, `columns-search` | The column chooser panel, and the search box in the panel or in `TMDataGrid.Menu.Columns` |
| `columns-toggle-all`, `columns-reset` | Show/hide all and Reset layout, in the panel or in the menu |
| `footer` | The pager row |
| `page-size`, `page-range`, `page-number`, `page-prev`, `page-next` | The pager |
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
| `row` | A body row, pinned or not. A committed new row is one of them, marked `data-new` |
| `entry-row` | An entry row being typed into. Carries `data-new`, and `data-committed` / `data-draft` once committed, which is where a committed row stays under `editing.newRowsSticky`. Its cells carry `data-column-id` and, on a failed ✓, `data-invalid` |
| `details` | A row's detail panel |
| `select-row` | Its selection checkbox |
| `details-toggle`, `group-toggle` | Its detail and tree chevrons |
| `edit-row`, `delete-row` | The edit lane, idle. `edit-row` also reopens an entered new row |
| `save-row`, `cancel-row` | The edit lane's Save and Cancel on an open row |
| `row-state` | The draft store's change marker; `data-state` is `new`, `edited` or `deleted` |
| `revert-row` | Drops a committed row's draft |
| `restore-row` | Undo a deletion mark |
| `confirm-new-row`, `discard-new-row` | An entry row's ✓ (commit) and ✕ |
| `open-rows-note` | `DraftActions`' count of rows still open. Carries `data-open-count`; absent while there are none |

### Keyed by `data-column-id`

| `data-dg-part` | What it is |
| --- | --- |
| `header` | A column header |
| `header-sort`, `header-menu`, `header-filter` | Its three action buttons. `header-filter` is absent under `filters.inHeader`, where the control below is the indicator |
| `header-filter-cell`, `header-filter-operator` | One column's header filter control and its operator button |
| `filter-row` | One row of the filter panel |
| `filter-pill` | One active-filter pill; its ✕ is the only button inside it |
| `columns-toggle` | The checkbox of one column, in the panel or in the menu |

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

**Count rows off the grid, not off the DOM.** `aria-rowcount` includes every
header row - stacked column groups and the `filters.inHeader` row among them -
and the summary row, so how many it adds is a function of the grid's
configuration. `data-dg-row-count` counts the body rows alone: the current page
under pagination, or everything the filters left otherwise. Assert on that one.

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
    await this.part("menu-button").click();
    await this.part("columns-toggle", { columnId }).click();
  }

  /** The entry row opened by `edit.addRow()`; `data-row-id` is its temp id. */
  entryRow(): Locator {
    return this.part("entry-row");
  }

  /** Types into the built-in editors of an open row: an entry row, or a row
   *  opened in row mode. */
  async fillRow(rowId: string, values: Record<string, string>): Promise<void> {
    for (const [columnId, value] of Object.entries(values)) {
      await this.part("editor", { rowId, columnId })
        .locator('[data-dg-part="editor-input"]')
        .fill(value);
    }
  }

  async commitEntryRow(rowId: string): Promise<void> {
    await this.part("confirm-new-row", { rowId }).click();
  }

  /** Presses Save in `TMDataGrid.DraftActions` and waits for the store to empty. */
  async saveDrafts(): Promise<void> {
    await this.part("save-all").click();
    await expect(this.part("save-all")).toHaveAttribute("data-draft-count", "0");
  }

  /** Finds a row the test added by a value unique to it, since the grid does
   *  not know the id the app gave the row. Retries until the app has put the
   *  row in `data`. */
  async expectRowAdded(
    uniqueValue: string,
    cells: Record<string, string>,
  ): Promise<void> {
    await this.search(uniqueValue);
    await this.expectRowCount(1);
    const row = this.part("row");
    for (const [columnId, text] of Object.entries(cells)) {
      await expect(row.locator(`[data-column-id="${columnId}"]`)).toHaveText(
        text,
      );
    }
    await this.search("");
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

## Editing

### Adding a row

[`edit.addRow()`](/docs/editing) opens an entry row, `data-dg-part="entry-row"`,
keyed by a temporary id (`__new__1`, `__new__2`, …). Its editors are `editor`
parts keyed by that id and the column. What ✓ does with the row depends on
`editing.draft`:

| Step | Without `draft` | With `draft: true` |
| --- | --- | --- |
| `addRow()` | `entry-row[data-row-id="__new__1"]` | Same |
| ✓ fails validation | The entry row stays; the failing cells carry `data-invalid` | Same |
| ✓ (`confirm-new-row`) | The entry row is removed and the temp id is gone. `onRowAdd` receives the values, and the row exists again only once your app puts it in `data`, under the id your `getRowId` returns | The row becomes a body row, still keyed by the temp id: `row[data-row-id="__new__1"][data-new="true"][data-draft="true"]`, with `row-state[data-state="new"]` in its lane and `save-all[data-draft-count]` counting it |
| Save (`save-all`) | - | As ✓ without `draft`: the temp id is gone, and the row comes back through `data` under your id |

The grid never learns which id your app gave the row, so once `onRowAdd` or
`saveDrafts` has run, the row cannot be addressed by id. Find it by its content
instead: narrow the grid to a value unique to the row, assert that one row is
left, and read that row's cells. The row-count assertion is also the wait,
since it retries until the app has put the row in `data`:

```ts
test("adds an employee", async ({ page }) => {
  const grid = new DataGrid(page, "employees");
  await page.goto("/employees");
  await grid.expectSettled();

  // The app's own button, calling edit.addRow()
  await page.getByRole("button", { name: "Add row" }).click();
  const tempId = (await grid.entryRow().getAttribute("data-row-id"))!;
  await grid.fillRow(tempId, { name: "Nordkvist-4711", city: "Stockholm" });
  await grid.commitEntryRow(tempId);

  await expect(grid.entryRow()).toHaveCount(0);
  await grid.expectRowAdded("Nordkvist-4711", {
    name: "Nordkvist-4711",
    city: "Stockholm",
  });
});
```

Use a value no other row has, such as a name with a run id in it, so that the
search leaves one row. If the grid has no quick search, narrow with `filterBy`
on a column instead.

Under `draft: true` the temp id stays valid until Save, so the committed row is
asserted directly, and the content-based check applies after the save:

```ts
await grid.commitEntryRow(tempId);
const row = grid.part("row", { rowId: tempId });
await expect(row).toHaveAttribute("data-new", "true");
await expect(grid.part("row-state", { rowId: tempId })).toHaveAttribute(
  "data-state",
  "new",
);
await expect(grid.part("save-all")).toHaveAttribute("data-draft-count", "1");

await grid.saveDrafts();
await expect(row).toHaveCount(0);
await grid.expectRowAdded("Nordkvist-4711", { city: "Stockholm" });
```

Under `newRowsSticky: true` the committed row stays in the entry block instead,
as `entry-row[data-row-id="__new__1"][data-committed="true"]`, outside
`data-dg-row-count`, until the save.

A ✓ that fails validation keeps the entry row open, with `data-invalid` on the
failing cells:

```ts
await grid.commitEntryRow(tempId);
await expect(grid.entryRow()).toHaveCount(1);
await expect(
  grid.entryRow().locator('[data-column-id="email"]'),
).toHaveAttribute("data-invalid", "true");
```

### Changing a row

Without `draft`, a commit goes to `onCommit` and the grid keeps nothing of it, so
the assertion is the cell's text once your app has applied the change. Under
`draft: true` the change stays in the grid until Save, marked on the cell, the
row and the lane:

```ts
const cell = grid.cell({ rowId: "42", columnId: "salary" });
await cell.dblclick();
await grid.fillRow("42", { salary: "52000" });
await page.keyboard.press("Enter");

// Without draft: the app applied it
await expect(cell).toHaveText("52 000");

// Under draft: the grid holds it
await expect(cell).toHaveAttribute("data-dirty", "true");
await expect(grid.part("row", { rowId: "42" })).toHaveAttribute("data-dirty", "true");
await expect(grid.part("row-state", { rowId: "42" })).toHaveAttribute(
  "data-state",
  "edited",
);
```

In row mode, `edit-row` opens the row, `save-row` commits it and `cancel-row`
discards it; `fillRow` reaches the open row's editors the same way.

### Deleting a row

`delete-row` calls `onRowDelete` at once, or marks the row under `draft: true`:

```ts
const before = Number(await grid.grid.getAttribute("data-dg-row-count"));
await grid.part("delete-row", { rowId: "42" }).click();

// Without draft: the app removed it from data
await grid.expectRowCount(before - 1);

// Under draft: marked until Save, and Restore undoes the mark
await expect(grid.part("row", { rowId: "42" })).toHaveAttribute("data-deleted", "true");
await grid.part("restore-row", { rowId: "42" }).click();
```

Assert a deletion on `data-dg-row-count`, not on the row's element: a row
outside the viewport has no element either, so `toHaveCount(0)` passes for it
whether or not it was deleted.

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

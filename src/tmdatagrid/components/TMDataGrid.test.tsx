import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import { TMDataGridFilterPills } from "./TMDataGridFilterPills";
import { useTMDataGrid, type UseTMDataGridOptions } from "../useTMDataGrid";

/**
 * Smoke tests for the wiring between the chrome and the table: that a click on
 * a header sorts, that the panels write filter and visibility state, and that
 * the pager pages. TanStack's own behaviour is not re-tested here.
 */
function Grid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    ...options,
  } as UseTMDataGridOptions<TestRow>);

  return (
    <>
      {/* Rendered outside the provider on purpose: the pills take the api as a
          prop, and nothing else in the grid may. */}
      <TMDataGridFilterPills api={grid} />
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
          <TMDataGrid.ColumnsButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
        <TMDataGrid.Footer />
      </TMDataGrid>
    </>
  );
}

const renderGridUi = (options: Partial<UseTMDataGridOptions<TestRow>> = {}) =>
  renderWithMantine(<Grid {...options} />);

const bodyRows = () =>
  screen
    .getAllByRole("row")
    .filter((row) => row.getAttribute("data-testid")?.startsWith("dg-row-"));

/** Row ids in the order they are rendered. */
const renderedRowIds = () =>
  bodyRows().map((row) =>
    (row.getAttribute("data-testid") ?? "").replace("dg-row-", ""),
  );

/**
 * Text of one column's cells, in rendered order. Cell 0 is the generated
 * checkbox column, so the defined columns start at 1.
 */
const renderedColumn = (index: number) =>
  bodyRows().map(
    (row) => within(row).getAllByRole("cell")[index]?.textContent ?? "",
  );

describe("rendering", () => {
  it("renders a header per column and the rows beneath them", () => {
    renderGridUi();

    expect(screen.getByTestId("dg-header-name")).toHaveTextContent("Name");
    expect(screen.getByTestId("dg-header-city")).toHaveTextContent("City");
    expect(renderedRowIds().length).toBeGreaterThan(0);
  });

  it("states the row and column counts for a virtualized grid", () => {
    renderGridUi();
    const grid = screen.getByRole("table");

    // Five columns: the generated checkbox column plus the four defined ones.
    expect(grid).toHaveAttribute("aria-colcount", "5");
    // Every row plus the header row, whether or not it is mounted.
    expect(grid).toHaveAttribute(
      "aria-rowcount",
      String(testRows.length + 1),
    );
  });

  it("shows the empty message when nothing matches", () => {
    renderGridUi({ data: [] });

    expect(
      screen.getByText("No rows match your filters"),
    ).toBeInTheDocument();
  });

  it("shows a custom empty message", () => {
    renderGridUi({ data: [], meta: { noResultsLabel: "Nothing here" } });

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

describe("sorting", () => {
  it("sorts on a header click and reports it through aria-sort", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const header = screen.getByTestId("dg-header-name");

    expect(header).toHaveAttribute("aria-sort", "none");

    // The name column repeats values, so the order is asserted on the values
    // themselves — a stable sort keeps tied rows in place, which means
    // descending is not the exact reverse of ascending.
    await user.click(header);
    expect(header).toHaveAttribute("aria-sort", "ascending");
    const ascending = renderedColumn(2);
    expect(ascending).toEqual([...ascending].sort());

    await user.click(header);
    expect(header).toHaveAttribute("aria-sort", "descending");
    const descending = renderedColumn(2);
    expect(descending).toEqual([...descending].sort().reverse());
  });

  it("sorts a numeric column descending first, as TanStack does", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const header = screen.getByTestId("dg-header-age");

    await user.click(header);

    expect(header).toHaveAttribute("aria-sort", "descending");
  });

  it("does not advertise sorting on a grid that has it switched off", () => {
    renderGridUi({ enableSorting: false });

    expect(screen.getByTestId("dg-header-age")).not.toHaveAttribute(
      "aria-sort",
    );
  });
});

describe("filtering", () => {
  it("filters the rows down through the filter panel", async () => {
    const user = userEvent.setup();
    renderGridUi();
    expect(renderedRowIds().length).toBe(testRows.length);

    // The button seeds a filter on the first filterable column — "id", whose
    // numeric default operator is "equals".
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");

    expect(renderedRowIds()).toEqual(["3"]);
  });

  it("clears the filter again when its value is removed", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const value = screen.getByLabelText("Value");
    await user.type(value, "3");
    expect(renderedRowIds()).toEqual(["3"]);

    await user.clear(value);

    // A half-typed filter stays in state but must not narrow the rows.
    expect(renderedRowIds().length).toBe(testRows.length);
  });

  it("hides the filter button when filtering is off", () => {
    renderGridUi({ enableColumnFilters: false });

    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
  });

  it("hides the panel from its close button, keeping the filter", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    await user.click(screen.getByRole("button", { name: "Close filters" }));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(renderedRowIds()).toEqual(["3"]);
  });

  it("hides the panel on a click away", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    await user.click(screen.getByTestId("dg-header-name"));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(renderedRowIds()).toEqual(["3"]);
  });

  it("keeps the toolbar button a toggle, not a reopen", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const filterButton = screen.getByRole("button", { name: "Filters" });

    await user.click(filterButton);
    expect(screen.getByLabelText("Value")).toBeInTheDocument();

    // The click-away handler fires on this button too — if it closed the panel
    // there, the button's own click would open it straight back up.
    await user.click(filterButton);

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  });

  it("drops every filter and the panel from Clear all", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(renderedRowIds().length).toBe(testRows.length);
  });
});

describe("filter pills", () => {
  it("names the active filters and clears one from its pill", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");

    // "equals" is the numeric default, so the operator stays implicit.
    expect(screen.getByText("ID: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear ID filter" }));

    expect(screen.queryByText("ID: 3")).not.toBeInTheDocument();
    expect(renderedRowIds().length).toBe(testRows.length);
  });

  it("shows no pill for a filter that is not narrowing yet", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(
      screen.queryByRole("group", { name: "Active filters" }),
    ).not.toBeInTheDocument();
  });
});

describe("column visibility", () => {
  it("hides a column from the columns panel", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Manage columns" }));
    // The panel's checkboxes are labelled by column; the row ones are all
    // "Select row", so the column label is unambiguous.
    await user.click(screen.getByRole("checkbox", { name: "City" }));

    expect(screen.queryByTestId("dg-header-city")).not.toBeInTheDocument();
    expect(screen.getByTestId("dg-header-name")).toBeInTheDocument();
  });

  it("hides the columns button when hiding is off", () => {
    renderGridUi({ enableHiding: false });

    expect(
      screen.queryByRole("button", { name: "Manage columns" }),
    ).not.toBeInTheDocument();
  });
});

describe("row selection", () => {
  it("selects a row from its checkbox", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const [firstRow] = screen.getAllByRole("row").filter((row) =>
      row.getAttribute("data-testid")?.startsWith("dg-row-"),
    );

    await user.click(within(firstRow).getByRole("checkbox"));

    expect(firstRow).toHaveAttribute("data-selected", "true");
    expect(firstRow).toHaveAttribute("aria-selected", "true");
  });

  it("marks the checkbox column, which the stylesheet unpads", () => {
    renderGridUi();
    const [firstRow] = bodyRows();

    // jsdom has no layout, so the clipping this guards against cannot be
    // asserted here: the cell padding grows with `size` and would squeeze the
    // box out of its fixed 48px track at `xl`. The attribute is what the CSS
    // hangs off, so it is what the test pins down.
    expect(screen.getByTestId("dg-header-__select__")).toHaveAttribute(
      "data-select-column",
      "true",
    );
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveAttribute(
      "data-select-column",
      "true",
    );
    expect(within(firstRow).getAllByRole("cell")[1]).toHaveAttribute(
      "data-select-column",
      "false",
    );
  });

  it("drops the checkbox column in row selection mode", () => {
    renderGridUi({ selectionMode: "row" });

    expect(
      screen.queryByRole("checkbox", { name: "Select all rows" }),
    ).not.toBeInTheDocument();
  });

  it("selects on row click in row selection mode", async () => {
    const user = userEvent.setup();
    renderGridUi({ selectionMode: "row" });
    const [firstRow] = screen.getAllByRole("row").filter((row) =>
      row.getAttribute("data-testid")?.startsWith("dg-row-"),
    );

    await user.click(firstRow);

    expect(firstRow).toHaveAttribute("data-selected", "true");
  });
});

describe("pagination", () => {
  it("renders no pager unless pagination is enabled", () => {
    renderGridUi();

    expect(
      screen.queryByRole("button", { name: "Next page" }),
    ).not.toBeInTheDocument();
  });

  it("pages through the rows", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });

    expect(renderedRowIds()).toEqual(["1", "2", "3", "4", "5"]);
    expect(screen.getByText("1–5 of 12")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(renderedRowIds()).toEqual(["6", "7", "8", "9", "10"]);
    expect(screen.getByText("6–10 of 12")).toBeInTheDocument();
  });

  it("keeps a page size that is not one of the offered options", () => {
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 7 } },
    });

    // 7 is not in the default [10, 25, 50, 100] — the Select must still show it
    // rather than render blank. Mantine's Select renders a visible input and a
    // hidden one, so both carry the value.
    expect(screen.getAllByDisplayValue("7").length).toBeGreaterThan(0);
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  gridRowCount,
  header,
  part,
  queryPart,
  renderGridUi,
  renderWithMantine,
  testRows,
} from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";
import {
  createTMDataGridColumnHelper,
  openColumnFilter,
  useTMDataGrid,
} from "../useTMDataGrid";
import type { TMDataGridFilterOptions } from "../core/filterSurface";

/**
 * Where the filter controls render - the `filters` option. What a filter *is*
 * is covered by TMDataGrid.filtering.test.tsx; this file only asks which
 * surface owns it.
 */
describe("filters.surface", () => {
  it("floats the panel over the rows by default, and dismisses it on a click away", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(part("filter-popup")).toBeInTheDocument();
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();

    await user.click(header("name"));
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
  });

  it("puts the panel beside the rows under sidebar, and leaves it open on a click away", async () => {
    const user = userEvent.setup();
    renderGridUi({ filters: { surface: "sidebar" } });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const sidebar = part("filter-sidebar");
    expect(sidebar).toHaveAttribute("data-side", "right");
    expect(queryPart("filter-popup")).not.toBeInTheDocument();

    // A click in the table is a click on the rows the sidebar is filtering.
    await user.click(header("name"));
    expect(part("filter-sidebar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();
  });

  it("opens the sidebar at mount under defaultOpen", () => {
    renderGridUi({ filters: { surface: "sidebar", defaultOpen: true } });
    expect(part("filter-sidebar")).toBeInTheDocument();
  });

  it("renders no surface and no button under manual", () => {
    renderGridUi({ filters: { surface: "manual" } });

    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();
    expect(queryPart("filter-panel")).not.toBeInTheDocument();
  });

  it("shows a hand-placed panel with no open state and no close button", async () => {
    const user = userEvent.setup();

    function ManualGrid() {
      const grid = useTMDataGrid({
        data: testRows,
        columns: manualColumns,
        getRowId: (row) => String(row.id),
        filters: { surface: "manual" },
      });
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.FilterPanel />
          <TMDataGrid.Table />
        </TMDataGrid>
      );
    }
    renderWithMantine(<ManualGrid />);

    // Mounted is shown - nothing had to open it.
    expect(part("filter-panel")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close filters" }),
    ).not.toBeInTheDocument();

    await user.click(part("filter-add"));
    await user.type(screen.getByLabelText("Value"), "3");
    expect(gridRowCount()).toBe(1);

    // Emptying it closes nothing: there is no surface to close.
    await user.click(part("filter-clear-all"));
    expect(part("filter-panel")).toBeInTheDocument();
    expect(gridRowCount()).toBe(testRows.length);
  });
});

const manualColumns = (() => {
  const helper = createTMDataGridColumnHelper<{
    id: number;
    name: string;
    age: number;
    city: string;
  }>();
  return helper.columns([
    helper.accessor("id", { header: "ID", meta: { type: "number" } }),
    helper.accessor("name", { header: "Name" }),
  ]);
})();

describe("filters.inHeader", () => {
  const renderHeaderFilters = (filters: TMDataGridFilterOptions = {}) =>
    renderGridUi({ filters: { inHeader: true, ...filters } });

  it("filters from a control in the header row", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();
    expect(gridRowCount()).toBe(testRows.length);

    const cell = part("header-filter-cell", { columnId: "id" });
    await user.type(cell.querySelector("input")!, "3");

    expect(gridRowCount()).toBe(1);
  });

  it("drops the filter again once the control is emptied", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    const input = part("header-filter-cell", { columnId: "id" }).querySelector(
      "input",
    )!;
    await user.type(input, "3");
    expect(gridRowCount()).toBe(1);

    // Unlike a panel row, a header control has nothing to keep alive - so an
    // empty one leaves no entry in columnFilters behind.
    await user.clear(input);
    expect(gridRowCount()).toBe(testRows.length);
    expect(queryPart("filter-pill", { columnId: "id" })).not.toBeInTheDocument();
  });

  it("changes one column's operator from its funnel button", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    await user.click(part("header-filter-operator", { columnId: "age" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "is greater than" }),
    );
    await user.type(
      part("header-filter-cell", { columnId: "age" }).querySelector("input")!,
      "40",
    );

    expect(gridRowCount()).toBe(
      testRows.filter((row) => row.age > 40).length,
    );
  });

  it("leaves a non-filterable column's header cell empty", () => {
    renderHeaderFilters();
    const cell = part("header-filter-cell", { columnId: SELECT_COLUMN_ID });
    expect(cell.querySelector("input")).toBeNull();
  });

  it("takes the Filter menu item and the funnel indicator off the header", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    await user.type(
      part("header-filter-cell", { columnId: "name" }).querySelector("input")!,
      "Anna",
    );
    // The filled-in control is the indicator now.
    expect(queryPart("header-filter", { columnId: "name" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Name column menu" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Filter" }),
    ).not.toBeInTheDocument();
  });

  it("counts the filter row in aria-rowcount and pushes the body rows down", () => {
    renderHeaderFilters();
    const grid = screen.getByRole("table");
    expect(document.querySelectorAll("[data-dg-header-row]").length).toBe(2);
    expect(Number(grid.getAttribute("aria-rowcount"))).toBe(
      testRows.length + 2,
    );
    expect(
      document.querySelector('[data-dg-part="row"]')?.getAttribute("aria-rowindex"),
    ).toBe("3");
  });

  it("renders no filter row when nothing can be filtered", () => {
    renderGridUi({ filters: { inHeader: true }, enableColumnFilters: false });
    expect(queryPart("header-filter-row")).not.toBeInTheDocument();
  });

  it("sends openColumnFilter to the header control instead of a panel", async () => {
    const user = userEvent.setup();

    function HeaderGrid() {
      const grid = useTMDataGrid({
        data: testRows,
        columns: manualColumns,
        getRowId: (row) => String(row.id),
        filters: { inHeader: true },
      });
      return (
        <>
          <button type="button" onClick={() => openColumnFilter(grid, "name")}>
            filter name
          </button>
          <TMDataGrid {...grid}>
            <TMDataGrid.Table />
          </TMDataGrid>
        </>
      );
    }
    renderWithMantine(<HeaderGrid />);

    await user.click(screen.getByRole("button", { name: "filter name" }));

    expect(queryPart("filter-popup")).not.toBeInTheDocument();
    expect(
      part("header-filter-cell", { columnId: "name" }).querySelector("input"),
    ).toHaveFocus();
  });
});

/**
 * The header filter row is a header row like the group rows above it, so the
 * two have to stack rather than pin to the same edge - which is what surfaced
 * the group headers' missing column span.
 */
describe("the header rows stack", () => {
  const groupedColumns = (() => {
    const helper = createTMDataGridColumnHelper<{
      id: number;
      name: string;
      age: number;
      city: string;
    }>();
    return helper.columns([
      helper.group({
        id: "person",
        header: "Person",
        columns: helper.columns([
          helper.accessor("name", { header: "Name" }),
          helper.accessor("age", { header: "Age", meta: { type: "number" } }),
          helper.accessor("city", { header: "City" }),
        ]),
      }),
    ]);
  })();

  function GroupedGrid({ inHeader }: { inHeader: boolean }) {
    const grid = useTMDataGrid({
      data: testRows,
      columns: groupedColumns,
      getRowId: (row) => String(row.id),
      filters: { inHeader },
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table />
      </TMDataGrid>
    );
  }

  it("spans a group header across the leaves under it", () => {
    renderWithMantine(<GroupedGrid inHeader={false} />);

    // Without the span the group would sit in one track and leave the rest of
    // its width with no cell at all, which the body then scrolls up through.
    expect(part("header", { columnId: "person" })).toHaveStyle({
      gridColumn: "span 3",
    });
  });

  it("puts the filter row below the group rows, not on top of them", () => {
    renderWithMantine(<GroupedGrid inHeader />);

    const rows = [...document.querySelectorAll<HTMLElement>("[data-dg-header-row]")];
    expect(rows).toHaveLength(3);
    // jsdom lays nothing out, so every row measures zero and the insets all
    // land on 0. What is testable here is that each row was given one at all -
    // that the header stack is measured rather than left to pin to the top.
    expect(rows.every((row) => row.style.top !== "")).toBe(true);
    expect(rows.at(-1)).toHaveAttribute("data-dg-part", "header-filter-row");
  });
});

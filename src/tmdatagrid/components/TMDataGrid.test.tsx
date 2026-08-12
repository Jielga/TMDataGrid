import { Menu } from "@mantine/core";
import { useState } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  erased,
  makeRows,
  renderGrid,
  renderWithMantine,
  testColumns,
  testRows,
  visibleColumnIds,
  type TestRow,
} from "../../test/gridHarness";
import { getColumnCapabilities } from "../core/capabilities";
import { aggregateColumn } from "../core/summary";
import { TMDATAGRID_LABELS_SV } from "../core/labelsSv";
import { DETAILS_COLUMN_ID } from "./TMDataGridDetailsColumn";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";
import { TMDataGrid } from "./TMDataGrid";
import { TMDataGridFilterPills } from "./TMDataGridFilterPills";
import type { TMDataGridTableProps } from "./TMDataGridTable";
import {
  createTMDataGridColumnHelper,
  openColumnFilter,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridDetailsArgs,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";
import type { TMDataGridEditorComponent } from "../core/editEngine";
import type { TMDataGridFilterControlComponent } from "../core/filterControls";
import { DgAutocompleteFilter } from "./filters/DgAutocompleteFilter";
import { DgDateRangeFilter } from "./filters/DgDateRangeFilter";
import { DgRangeSliderFilter } from "./filters/DgRangeSliderFilter";
import { DgTriStateFilter } from "./filters/DgTriStateFilter";

type GridProps = Partial<UseTMDataGridOptions<TestRow>> & {
  /** Everything under this key goes to `TMDataGrid.Table`, not to the hook. */
  tableProps?: TMDataGridTableProps<TestRow>;
  /** Passed to `<TMDataGrid>` itself, the way a consumer names a grid. */
  "data-testid"?: string;
};

/**
 * Smoke tests for the wiring between the chrome and the table: that a click on
 * a header sorts, that the panels write filter and visibility state, and that
 * the pager pages. TanStack's own behaviour is not re-tested here.
 */
function Grid({
  tableProps,
  "data-testid": testId,
  ...options
}: GridProps = {}) {
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
      <TMDataGrid {...grid} data-testid={testId}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
          <TMDataGrid.ColumnsButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> {...tableProps} />
        <TMDataGrid.Footer />
      </TMDataGrid>
    </>

  );
}

const renderGridUi = (options: GridProps = {}) =>
  renderWithMantine(<Grid {...options} />);

/**
 * Which part of the grid, and — where a part repeats — which row or column of
 * it. The `data-dg-part` contract consumers write their own suites against, so
 * the tests reach for it the same way the Testing docs page tells them to.
 */
type PartKey = { rowId?: string; columnId?: string };

const partSelector = (name: string, key: PartKey = {}) =>
  `[data-dg-part="${name}"]` +
  (key.rowId === undefined ? "" : `[data-row-id="${CSS.escape(key.rowId)}"]`) +
  (key.columnId === undefined
    ? ""
    : `[data-column-id="${CSS.escape(key.columnId)}"]`);

const parts = (name: string, key?: PartKey, scope: ParentNode = document) =>
  Array.from(scope.querySelectorAll<HTMLElement>(partSelector(name, key)));

/** The one matching element, or `null` — for `not.toBeInTheDocument()`. */
const queryPart = (name: string, key?: PartKey, scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>(partSelector(name, key));

const part = (name: string, key?: PartKey, scope?: ParentNode) => {
  const found = queryPart(name, key, scope);
  if (found === null) {
    throw new Error(`No element matching ${partSelector(name, key)}`);
  }
  return found;
};

const header = (columnId: string) => part("header", { columnId });

const bodyRows = () => parts("row");

/**
 * How many rows the grid says it has, mounted or not. Virtualization decides
 * what is in the DOM — and under jsdom, which has no layout, it mounts a
 * handful — so a count of rows has to come off `aria-rowcount`, minus the one
 * header row it includes.
 */
const gridRowCount = () =>
  Number(screen.getByRole("table").getAttribute("aria-rowcount")) - 1;

/** Row ids in the order they are rendered. */
const renderedRowIds = () =>
  bodyRows().map((row) => row.getAttribute("data-row-id") ?? "");

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

    expect(header("name")).toHaveTextContent("Name");
    expect(header("city")).toHaveTextContent("City");
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

  it("says truly-empty when there is no data and no filter", () => {
    renderGridUi({ data: [] });

    expect(screen.getByText("No rows to show")).toBeInTheDocument();
    expect(
      screen.queryByText("No rows match your filters"),
    ).not.toBeInTheDocument();
  });

  it("says filtered-empty once a filter is what emptied it", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "999999");

    expect(
      screen.getByText("No rows match your filters"),
    ).toBeInTheDocument();
  });

  it("meta.noResultsLabel names the filtered case", async () => {
    const user = userEvent.setup();
    renderGridUi({ meta: { noResultsLabel: "Nothing here" } });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "999999");

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renderEmptyState takes over and learns which emptiness it is", () => {
    renderGridUi({
      data: [],
      tableProps: {
        renderEmptyState: ({ hasActiveFilters }) => (
          <div>blank slate, filtered: {String(hasActiveFilters)}</div>
        ),
      },
    });

    expect(
      screen.getByText("blank slate, filtered: false"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No rows to show")).not.toBeInTheDocument();
  });

  it("shows no message while an entry row is open on an empty grid", async () => {
    const user = userEvent.setup();
    // Referentially stable — an inline `[]` would be a new array every render,
    // and TanStack rebuilds the row models whenever `data` identity changes.
    const emptyRows: TestRow[] = [];
    function EmptyEntryGrid() {
      const grid = useTMDataGrid<TestRow>({
        data: emptyRows,
        columns: testColumns,
        getRowId: (row) => String(row.id),
        editMode: "batch",
        newRowDefaults: () => ({ ...testRows[0]!, id: 0 }),
      } as UseTMDataGridOptions<TestRow>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              Add row
            </button>
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EmptyEntryGrid />);

    expect(screen.getByText("No rows to show")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add row" }));

    // The entry row is the content now; "no rows" beside it would contradict.
    expect(screen.queryByText("No rows to show")).not.toBeInTheDocument();
  });
});

describe("sorting", () => {
  it("sorts on a header click and reports it through aria-sort", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const nameHeader = header("name");

    expect(nameHeader).toHaveAttribute("aria-sort", "none");

    // The name column repeats values, so the order is asserted on the values
    // themselves — a stable sort keeps tied rows in place, which means
    // descending is not the exact reverse of ascending.
    await user.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    const ascending = renderedColumn(2);
    expect(ascending).toEqual([...ascending].sort());

    await user.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    const descending = renderedColumn(2);
    expect(descending).toEqual([...descending].sort().reverse());
  });

  it("sorts a numeric column descending first, as TanStack does", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const ageHeader = header("age");

    await user.click(ageHeader);

    expect(ageHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("does not advertise sorting on a grid that has it switched off", () => {
    renderGridUi({ enableSorting: false });

    expect(header("age")).not.toHaveAttribute(
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
    await user.click(header("name"));

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

    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
    expect(header("name")).toBeInTheDocument();
  });

  it("hides the columns button when hiding is off", () => {
    renderGridUi({ enableHiding: false });

    expect(
      screen.queryByRole("button", { name: "Manage columns" }),
    ).not.toBeInTheDocument();
  });

  it("Reset layout brings a hidden column back", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Manage columns" }));
    await user.click(screen.getByRole("checkbox", { name: "City" }));
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "RESET LAYOUT" }));

    expect(header("city")).toBeInTheDocument();
  });
});

describe("row numbers", () => {
  it("numbers the view in display order, renumbering on sort", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableRowNumbers: true });

    const numbersAt = () =>
      bodyRows().map(
        (row) => within(row).getAllByRole("cell")[0]?.textContent ?? "",
      );

    expect(screen.getByText("#")).toBeInTheDocument();
    const before = numbersAt();
    expect(before.slice(0, 3)).toEqual(["1", "2", "3"]);

    // Sorting reorders the rows; the gutter numbers the view, so it stays
    // 1, 2, 3 while the row ids underneath change order.
    await user.click(header("name"));
    expect(numbersAt().slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  it("renders no gutter by default", () => {
    renderGridUi();

    expect(screen.queryByText("#")).not.toBeInTheDocument();
  });
});

describe("row pinning", () => {
  // Referentially stable — see the entry-row test's note on data identity.
  const pinTestRows = testRows;

  function PinGrid() {
    const [data, setData] = useState(pinTestRows);
    const grid = useTMDataGrid<TestRow>({
      data,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      enableRowPinning: true,
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.FilterButton />
          <button
            type="button"
            onClick={() => grid.table.getRow("1", true).pin("top")}
          >
            Pin 1 top
          </button>
          <button
            type="button"
            onClick={() => grid.table.getRow("2", true).pin("bottom")}
          >
            Pin 2 bottom
          </button>
          <button
            type="button"
            onClick={() => grid.table.getRow("1", true).pin(false)}
          >
            Unpin 1
          </button>
          <button
            type="button"
            onClick={() => setData((rows) => rows.filter((row) => row.id !== 1))}
          >
            Remove 1
          </button>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("pins a row into the top block and out of the scrolling order", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));

    const topBlock = part("pinned-top");
    expect(part("row", { rowId: "1" }, topBlock)).toBeInTheDocument();
    // Exactly once: the centre no longer renders it.
    expect(parts("row", { rowId: "1" })).toHaveLength(1);
  });

  it("pins a row into the bottom block", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 2 bottom" }));

    const bottomBlock = part("pinned-bottom");
    expect(part("row", { rowId: "2" }, bottomBlock)).toBeInTheDocument();
  });

  it("unpins back into the body", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));
    await user.click(screen.getByRole("button", { name: "Unpin 1" }));

    expect(queryPart("pinned-top")).not.toBeInTheDocument();
    expect(part("row", { rowId: "1" })).toBeInTheDocument();
  });

  it("survives the pinned row's data being deleted", async () => {
    // TanStack's own getTopRows() throws over a stale pinned id; the grid's
    // reader skips it instead — see readPinnedRows.
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));
    await user.click(screen.getByRole("button", { name: "Remove 1" }));

    expect(queryPart("pinned-top")).not.toBeInTheDocument();
    expect(part("row", { rowId: "2" })).toBeInTheDocument();
  });

  it("keeps a pinned row at its edge when the filters drop it", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "999999");

    const topBlock = part("pinned-top");
    expect(part("row", { rowId: "1" }, topBlock)).toBeInTheDocument();
    // The pinned row is content, so the filtered-empty message stays away.
    expect(
      screen.queryByText("No rows match your filters"),
    ).not.toBeInTheDocument();
  });

  it("answers getCanPin per flag, predicate and group row", () => {
    const off = renderGrid({});
    expect(off.result.current.table.getRow("1", true).getCanPin()).toBe(false);

    const predicate = renderGrid({
      enableRowPinning: (row) => row.original.id !== 2,
    });
    expect(
      predicate.result.current.table.getRow("1", true).getCanPin(),
    ).toBe(true);
    expect(
      predicate.result.current.table.getRow("2", true).getCanPin(),
    ).toBe(false);

    const grouped = renderGrid({ enableRowPinning: true });
    act(() => {
      grouped.result.current.table.getColumn("city")?.toggleGrouping();
    });
    const groupRow = grouped.result.current.table
      .getPrePaginatedRowModel()
      .rows.find((row) => row.getIsGrouped());
    expect(groupRow).toBeDefined();
    expect(groupRow?.getCanPin()).toBe(false);
  });
});

describe("match highlighting", () => {
  it("marks the matched text while a contains filter is active", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableMatchHighlighting: true });

    // The panel seeds on "id", whose "equals" is not a substring match — the
    // highlight wants the Name column's "contains".
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getAllByLabelText("Column")[0] as HTMLElement);
    await user.click(await screen.findByRole("option", { name: "Name" }));
    await user.type(screen.getByLabelText("Value"), "anna");

    // The filter itself must be live on Name before marks mean anything.
    expect(renderedRowIds()).toEqual(["1", "6", "11"]);
    const marks = await screen.findAllByText("Anna", { selector: "mark" });
    expect(marks.length).toBeGreaterThan(0);
  });

  it("renders no marks without the flag", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "anna");

    expect(screen.getAllByText("Anna").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("mark")).toHaveLength(0);
  });
});

describe("scroll edge callbacks", () => {
  it("fires on arrival at an edge, once, and not on mount", () => {
    const events: Array<string> = [];
    renderGridUi({
      tableProps: {
        onScrollToTop: () => events.push("top"),
        onScrollToBottom: () => events.push("bottom"),
      },
    });

    const container = document.querySelector(
      "[data-dg-scroll-container]",
    ) as HTMLElement;
    // jsdom has no layout, so the metrics are stated.
    Object.defineProperties(container, {
      clientHeight: { value: 400, configurable: true },
      scrollHeight: { value: 1000, configurable: true },
      clientWidth: { value: 600, configurable: true },
      scrollWidth: { value: 600, configurable: true },
    });

    // Mounting fired nothing — the grid starts at the top edge.
    expect(events).toEqual([]);

    container.scrollTop = 600;
    fireEvent.scroll(container);
    container.scrollTop = 599;
    fireEvent.scroll(container);

    // Two scroll events inside the bottom tolerance, one arrival.
    expect(events).toEqual(["bottom"]);

    container.scrollTop = 300;
    fireEvent.scroll(container);
    container.scrollTop = 0;
    fireEvent.scroll(container);

    expect(events).toEqual(["bottom", "top"]);
  });
});

describe("per-row styling", () => {
  it("stripes by view position and applies rowClassName/rowStyle", () => {
    renderGridUi({
      tableProps: {
        striped: true,
        rowClassName: (row) => (row.id === "1" ? "vip" : undefined),
        rowStyle: (row) =>
          row.id === "2"
            ? ({ "--row-bg": "rgb(255, 0, 0)" } as React.CSSProperties)
            : undefined,
      },
    });

    const rows = bodyRows();
    expect(rows[0]!.getAttribute("data-striped")).toBe("false");
    expect(rows[1]!.getAttribute("data-striped")).toBe("true");
    expect(rows[0]!.className).toContain("vip");
    expect(rows[1]!.className).not.toContain("vip");
    expect(rows[1]!.style.getPropertyValue("--row-bg")).toBe("rgb(255, 0, 0)");
  });

  it("adds no stripe attribute while striped is off", () => {
    renderGridUi();

    expect(bodyRows()[1]!.hasAttribute("data-striped")).toBe(false);
  });
});

describe("cell click handlers", () => {
  it("onCellClick reports the cell and composes with row selection", async () => {
    const user = userEvent.setup();
    const clicks: Array<string> = [];
    renderGridUi({
      selectionMode: "row",
      tableProps: {
        onCellClick: ({ row, column }) => clicks.push(`${row.id}:${column.id}`),
      },
    });

    await user.click(within(bodyRows()[0]!).getAllByRole("cell")[1]!);

    // No checkbox lane under "row" mode, so cell 1 is the name column.
    expect(clicks).toEqual(["1:name"]);
    // The row click still selected — composed, not suppressed.
    expect(bodyRows()[0]!.getAttribute("data-selected")).toBe("true");
  });

  it("onCellDoubleClick and onCellContextMenu fire with the cell", async () => {
    const user = userEvent.setup();
    const events: Array<string> = [];
    renderGridUi({
      tableProps: {
        onCellDoubleClick: ({ column }) => events.push(`dbl:${column.id}`),
        onCellContextMenu: ({ column }) => events.push(`ctx:${column.id}`),
      },
    });

    const nameCell = within(bodyRows()[0]!).getAllByRole("cell")[2]!;
    await user.dblClick(nameCell);
    fireEvent.contextMenu(nameCell);

    expect(events).toEqual(["dbl:name", "ctx:name"]);
  });
});

describe("resetSettings", () => {
  it("puts every settings slice back to a clean first visit", () => {
    const { result } = renderGrid();
    const { table } = result.current;

    act(() => {
      table.getColumn("city")?.toggleVisibility(false);
      table.setColumnSizing({ name: 300 });
      table.setColumnOrder(["city", "name", "id", "age"]);
      table.setGrouping(["city"]);
    });

    act(() => result.current.resetSettings());

    const state = table.store.state;
    expect(state.columnVisibility.city).not.toBe(false);
    expect(state.columnSizing).toEqual({});
    expect(state.columnOrder).toEqual([]);
    expect(state.grouping).toEqual([]);
    // The structural lanes keep their pinning through a reset.
    expect(state.columnPinning.left).toContain(SELECT_COLUMN_ID);
  });

  it("keeps the consumer's initialState as the floor", () => {
    const { result } = renderGrid({
      initialState: { columnVisibility: { age: false } },
    });
    const { table } = result.current;

    act(() => {
      table.getColumn("age")?.toggleVisibility(true);
      table.getColumn("city")?.toggleVisibility(false);
    });

    act(() => result.current.resetSettings());

    const state = table.store.state;
    // Hidden by definition, so the reset hides it again.
    expect(state.columnVisibility.age).toBe(false);
    expect(state.columnVisibility.city).not.toBe(false);
  });
});

describe("column menu", () => {
  const itemLabels = () =>
    screen.getAllByRole("menuitem").map((item) => item.textContent);

  it("opens the same items from a right-click as from the button", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    const fromButton = itemLabels();
    await user.keyboard("{Escape}");
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);

    fireEvent.contextMenu(header("city"));

    expect(itemLabels()).toEqual(fromButton);
  });

  it("leaves a control lane's header to the browser's own menu", () => {
    renderGridUi();

    // No column menu on the select-all lane, so nothing to open — the native
    // menu is the right answer there rather than an empty dropdown.
    fireEvent.contextMenu(header(SELECT_COLUMN_ID));

    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });
});

describe("row selection", () => {
  it("selects a row from its checkbox", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const [firstRow] = screen.getAllByRole("row").filter((row) =>
      row.hasAttribute("data-row-id"),
    );

    await user.click(within(firstRow).getByRole("checkbox"));

    expect(firstRow).toHaveAttribute("data-selected", "true");
    expect(firstRow).toHaveAttribute("aria-selected", "true");
  });

  it("marks the control lanes, which the stylesheet unpads", () => {
    renderGridUi();
    const [firstRow] = bodyRows();

    // jsdom has no layout, so the clipping this guards against cannot be
    // asserted here: the cell padding grows with `size` and would squeeze the
    // box out of its fixed 36px track at `xl`. The attribute is what the CSS
    // hangs off, so it is what the test pins down.
    expect(header("__select__")).toHaveAttribute(
      "data-control-column",
      "true",
    );
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveAttribute(
      "data-control-column",
      "true",
    );
    expect(within(firstRow).getAllByRole("cell")[1]).toHaveAttribute(
      "data-control-column",
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
      row.hasAttribute("data-row-id"),
    );

    await user.click(firstRow);

    expect(firstRow).toHaveAttribute("data-selected", "true");
  });
});

describe("row context menu", () => {
  /** Right-clicks the Name cell of a row. Cell 0 is the checkbox column. */
  const contextClickName = (rowIndex: number) =>
    fireEvent.contextMenu(
      within(bodyRows()[rowIndex]).getAllByRole("cell")[2],
    );

  it("opens the menu for the right-clicked row and cell", async () => {
    const targets: string[] = [];
    renderGridUi({
      tableProps: {
        rowContextMenu: ({ row, cell }) => {
          targets.push(`${row.id}:${cell?.column.id ?? "none"}`);
          return <Menu.Item>Open</Menu.Item>;
        },
      },
    });

    contextClickName(1);

    expect(
      await screen.findByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
    // The second row, and the cell the pointer was actually over.
    expect(targets).toContain("2:name");
    expect(bodyRows()[1]).toHaveAttribute("data-context-menu", "true");
  });

  it("closes again when an item is picked", async () => {
    const user = userEvent.setup();
    renderGridUi({
      tableProps: { rowContextMenu: () => <Menu.Item>Open</Menu.Item> },
    });

    contextClickName(0);
    await user.click(await screen.findByRole("menuitem", { name: "Open" }));

    expect(
      screen.queryByRole("menuitem", { name: "Open" }),
    ).not.toBeInTheDocument();
    expect(bodyRows()[0]).not.toHaveAttribute("data-context-menu", "true");
  });

  it("leaves a row without a menu when the render prop returns null", async () => {
    renderGridUi({
      tableProps: {
        rowContextMenu: ({ row }) =>
          row.id === "1" ? null : <Menu.Item>Open</Menu.Item>,
      },
    });

    contextClickName(0);
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

    contextClickName(1);
    expect(
      await screen.findByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
  });

  it("does not touch right-click without the prop", () => {
    renderGridUi();

    contextClickName(0);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(bodyRows()[0]).not.toHaveAttribute("data-context-menu", "true");
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

describe("grouping", () => {
  /** Opens a header's column menu and returns its items. */
  const openColumnMenu = async (
    user: ReturnType<typeof userEvent.setup>,
    label: string,
  ) => {
    await user.click(
      screen.getByRole("button", { name: `${label} column menu` }),
    );
    return screen.getAllByRole("menuitem");
  };

  const clickMenuItem = async (
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    item: string | RegExp,
  ) => {
    await openColumnMenu(user, label);
    await user.click(screen.getByRole("menuitem", { name: item }));
  };

  it("offers to group on a column that has an accessor", async () => {
    const user = userEvent.setup();
    renderGridUi();

    const items = (await openColumnMenu(user, "City")).map(
      (item) => item.textContent,
    );

    expect(items).toContain("Group by City");
  });

  it("replaces the rows with a collapsed tree and takes the column out", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");

    // Three cities over twelve rows, none of them open yet.
    const groups = bodyRows();
    expect(groups).toHaveLength(3);
    expect(groups.every((row) => row.dataset.grouped === "true")).toBe(true);
    // The tree lane replaced the column it groups on.
    expect(header("__group__")).toBeInTheDocument();
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });

  it("writes the group value and how many rows are under it", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");

    expect(
      screen.getByRole("button", { name: "Expand Stockholm" }),
    ).toHaveTextContent("Stockholm(4)");
  });

  it("brings the rows into view when the group is expanded", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));

    expect(bodyRows()).toHaveLength(3 + 4);
    expect(
      screen.getByRole("button", { name: "Collapse Stockholm" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("ungroups from the tree column, the grouped one having gone", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");
    // The City header no longer exists to be ungrouped from, which is why the
    // tree column carries the item.
    await clickMenuItem(user, "Group", "Ungroup City");

    expect(header("city")).toBeInTheDocument();
    expect(queryPart("header", { columnId: "__group__" })).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(12);
  });

  it("selects every row under a group from its checkbox", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");
    const groupBoxes = screen.getAllByRole("checkbox", { name: "Select group" });
    expect(groupBoxes).toHaveLength(3);

    await user.click(groupBoxes[0]!);

    // Four leaves ticked, and the group's own box follows them. The rows cycle
    // through the cities, so the first group is Stockholm's.
    expect(groupBoxes[0]).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));
    expect(
      screen
        .getAllByRole("checkbox", { name: "Select row" })
        .filter((box) => (box as HTMLInputElement).checked),
    ).toHaveLength(4);
  });

  it("leaves a column with no aggregation blank on a group row", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");

    // Cell 0 is the checkbox lane, 1 the tree, then ID / Name / Age. A plain
    // "group by" is a tree, not a summary — nothing was told how to aggregate.
    expect(renderedColumn(2)).toEqual(["", "", ""]);
    expect(renderedColumn(4)).toEqual(["", "", ""]);
  });
});

describe("grouping — rendering stays in step", () => {
  const openMenu = async (
    user: ReturnType<typeof userEvent.setup>,
    label: string,
  ) => {
    await user.click(
      screen.getByRole("button", { name: `${label} column menu` }),
    );
  };

  /** Header ids in render order. */
  const headerIds = () =>
    screen
      .getAllByRole("columnheader")
      .map((header) => header.getAttribute("data-column-id") ?? "");

  it("drops the second grouped column's header, not only the first", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await openMenu(user, "City");
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    expect(headerIds()).not.toContain("city");

    await openMenu(user, "Name");
    await user.click(screen.getByRole("menuitem", { name: "Group by Name" }));
    expect(headerIds()).not.toContain("name");
  });

  it("gives every row as many cells as there are headers", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await openMenu(user, "City");
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await openMenu(user, "Name");
    await user.click(screen.getByRole("menuitem", { name: "Group by Name" }));

    // A stale header list would leave a track and a header with no cell under
    // it, shifting every column after it out of alignment.
    const columnCount = headerIds().length;
    for (const row of bodyRows()) {
      expect(within(row).getAllByRole("cell")).toHaveLength(columnCount);
    }
  });
});

describe("grouping and the pager", () => {
  const groupIt = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
  };

  it("greys the pager out rather than hiding it", async () => {
    const user = userEvent.setup();
    renderGridUi({ enablePagination: true });

    expect(screen.getByText("1–12 of 12")).toBeInTheDocument();

    await groupIt(user);

    // Still there — a footer that vanished would read as a bug rather than as a
    // mode the grid is in.
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByText("Grouped · all 12 rows")).toBeInTheDocument();
  });

  it("renders every group rather than a page of them", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    expect(bodyRows()).toHaveLength(2);

    await groupIt(user);

    // Three cities, none sliced off by a page size of two.
    expect(bodyRows()).toHaveLength(3);
  });

  it("pages again once the grouping is dropped", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });

    await groupIt(user);
    await user.click(screen.getByRole("button", { name: "Group column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Ungroup City" }));

    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });
});

describe("grouping and the row context menu", () => {
  it("leaves group rows without a context menu", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    renderGridUi({
      tableProps: {
        rowContextMenu: ({ row }) => {
          seen.push(row.id);
          return <Menu.Item>Open</Menu.Item>;
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));

    // A group row is built on its first child's record, so a render prop
    // reaching for `row.original` would be handed the wrong employee. Same
    // reason group rows sit out `onRowClick`.
    fireEvent.contextMenu(within(bodyRows()[0]!).getAllByRole("cell")[2]!);

    expect(screen.queryByRole("menuitem", { name: "Open" })).not.toBeInTheDocument();
    expect(seen).toEqual([]);
    expect(bodyRows()[0]).not.toHaveAttribute("data-context-menu", "true");
  });

  it("still opens one on the rows inside a group", async () => {
    const user = userEvent.setup();
    renderGridUi({
      tableProps: {
        rowContextMenu: () => <Menu.Item>Open</Menu.Item>,
      },
    });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));

    const dataRow = bodyRows().find((row) => row.dataset.grouped !== "true");
    fireEvent.contextMenu(within(dataRow!).getAllByRole("cell")[2]!);

    expect(
      await screen.findByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
  });
});


describe("row details", () => {
  const renderDetails = ({ row }: TMDataGridDetailsArgs<TestRow>) => (
    <div>Details for {row.original.name}</div>
  );

  /** The generated lane's chevron, on one row or in the header. */
  const detailsToggle = (rowId?: string) =>
    rowId === undefined
      ? screen.getByRole("button", { name: /(Expand|Collapse) all details/ })
      : within(part("row", { rowId })).getByRole("button", {
          name: /(Show|Hide) details/,
        });

  it("renders no panel until a row is expanded", () => {
    renderGridUi({ renderDetails });

    expect(detailsToggle("1")).toHaveAttribute("aria-expanded", "false");
    expect(queryPart("details", { rowId: "1" })).not.toBeInTheDocument();
  });

  it("lets a data row expand, which it cannot do on its own", () => {
    // TanStack's fallback is `subRows.length > 0`, so without `renderDetails`
    // nothing but a group row can expand.
    expect(renderGrid().result.current.table.getRow("1").getCanExpand()).toBe(
      false,
    );
    expect(
      renderGrid({ renderDetails }).result.current.table
        .getRow("1")
        .getCanExpand(),
    ).toBe(true);
  });

  it("pins the lane last of the generated ones, and lets no one move it", () => {
    const api = renderGrid({ renderDetails }).result.current;

    // The tree lane is pinned between them, and hidden until something is
    // grouped — so it holds its place without taking a track.
    expect(api.table.store.state.columnPinning.left).toEqual([
      SELECT_COLUMN_ID,
      GROUP_COLUMN_ID,
      DETAILS_COLUMN_ID,
    ]);
    expect(visibleColumnIds(api).slice(0, 2)).toEqual([
      SELECT_COLUMN_ID,
      DETAILS_COLUMN_ID,
    ]);

    // A toggle that could be hidden, unpinned or dragged to the far right would
    // leave rows with panels no one can open.
    const column = erased(api).table.getColumn(DETAILS_COLUMN_ID);
    expect(getColumnCapabilities(column!, api.features)).toMatchObject({
      canHide: false,
      canPin: false,
      canReorder: false,
      canResize: false,
      canSort: false,
    });
  });

  it("opens the panel inside the expanded row, and only that one", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle("3"));

    const panel = part("details", { rowId: "3" });
    expect(panel).toHaveTextContent("Details for Maria");
    // Inside the row element: one measurement covers the row and its panel.
    expect(part("row", { rowId: "3" })).toContainElement(panel);
    expect(queryPart("details", { rowId: "2" })).not.toBeInTheDocument();
  });

  it("closes it again on the second click", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle("3"));
    await user.click(detailsToggle("3"));

    expect(queryPart("details", { rowId: "3" })).not.toBeInTheDocument();
  });

  it("spans every column without adding a row to the count", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });
    const grid = screen.getByRole("table");
    const rowCount = grid.getAttribute("aria-rowcount");

    await user.click(detailsToggle("3"));

    // A cell spanning the row rather than a row of its own, so the count still
    // counts records.
    expect(part("details", { rowId: "3" })).toHaveAttribute(
      "aria-colspan",
      grid.getAttribute("aria-colcount"),
    );
    expect(grid).toHaveAttribute("aria-rowcount", rowCount);
  });

  it("opens and closes every row from the header", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle());

    expect(detailsToggle()).toHaveAttribute("aria-expanded", "true");
    expect(
      bodyRows().every(
        (row) => within(row).queryByText(/^Details for/) !== null,
      ),
    ).toBe(true);

    await user.click(detailsToggle());

    expect(detailsToggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/^Details for/)).not.toBeInTheDocument();
  });

  it("keeps a click inside the panel out of the row's gestures", async () => {
    const user = userEvent.setup();
    // Opened from restored state rather than by clicking the row, so the click
    // under test is the only one the row could have reacted to.
    renderGridUi({
      selectionMode: "row",
      initialState: { expanded: { "3": true } },
      renderDetails: ({ row }) => (
        <button type="button">Act on {row.original.name}</button>
      ),
    });

    await user.click(screen.getByRole("button", { name: "Act on Maria" }));

    expect(part("details", { rowId: "3" })).toBeInTheDocument();
    expect(part("row", { rowId: "3" })).toHaveAttribute(
      "data-selected",
      "false",
    );
  });

  it("sits after the tree lane once something is grouped", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));

    // The lane the user grouped into comes first: the tree says which rows
    // there are, and only then is there one to open.
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.getAttribute("data-column-id"));
    expect(headers.slice(0, 3)).toEqual([
      SELECT_COLUMN_ID,
      GROUP_COLUMN_ID,
      DETAILS_COLUMN_ID,
    ]);
  });

  it("expands every detail from the header without unfolding the tree", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await user.click(detailsToggle());

    // One `expanded` state holds both, so the whole-table form TanStack's
    // `toggleAllRowsExpanded` writes would have opened all three groups too —
    // and the grid would be showing fifteen rows rather than three.
    expect(gridRowCount()).toBe(3);
    expect(bodyRows().every((row) => row.dataset.grouped === "true")).toBe(true);

    // The panels are there all the same, under the rows inside the group.
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));
    const dataRows = bodyRows().filter((row) => row.dataset.grouped !== "true");
    expect(dataRows).toHaveLength(4);
    expect(
      dataRows.every((row) => within(row).queryByText(/^Details for/) !== null),
    ).toBe(true);
  });

  it("expands every group from the menu without opening the panels", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await user.click(screen.getByRole("button", { name: "Group column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Expand all groups" }));

    // The mirror of the case above: an item that says "groups" must not open
    // every panel in the grid.
    expect(gridRowCount()).toBe(3 + testRows.length);
    expect(screen.queryByText(/^Details for/)).not.toBeInTheDocument();
  });

  it("leaves group rows to their children", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));

    // A group row is built on its first child's record, so a panel there would
    // be about an arbitrary one of them. It opens into its rows instead, from
    // the tree lane rather than this one.
    const groupRow = bodyRows()[0]!;
    expect(
      within(groupRow).queryByRole("button", { name: /details/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));

    expect(gridRowCount()).toBe(3 + 4);
    expect(screen.queryByText(/^Details for/)).not.toBeInTheDocument();
  });
});

describe("cell selection", () => {
  /**
   * The columns are [checkbox, ID, Name, Age, City], so `name` is cell 2. All
   * twelve test rows are mounted under jsdom — the virtualizer falls back to a
   * 600px viewport, which is more than they need — so a move never has to wait
   * for a scroll to mount its target here.
   */
  const cellAt = (rowIndex: number, columnIndex: number) =>
    within(bodyRows()[rowIndex]!).getAllByRole("gridcell")[columnIndex]!;

  /** Where the keyboard is, read off the DOM rather than off the store. */
  const focused = () => document.activeElement as HTMLElement;

  /** The selected block as `rowId:columnId`, in render order. */
  const selectedCells = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>('[data-cell][data-selected="true"]'),
    ).map((cell) => `${cell.dataset.rowId}:${cell.dataset.columnId}`);
  const focusedCoords = () => {
    const cell = document.querySelector<HTMLElement>(
      '[data-cell="true"][data-focused="true"]',
    );
    return cell === null
      ? null
      : { rowId: cell.dataset.rowId, columnId: cell.dataset.columnId };
  };

  it("is off unless asked for", () => {
    renderGridUi();

    // Still a table of cells, and nothing in the body is reachable by Tab —
    // exactly as it was before the option existed.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    const [firstRow] = bodyRows();
    expect(within(firstRow!).getAllByRole("cell")[0]).not.toHaveAttribute(
      "tabindex",
    );
  });

  it("reports itself as a grid of gridcells", () => {
    renderGridUi({ cellSelection: "single" });

    expect(screen.getByRole("grid")).toBeInTheDocument();
    // 1-based, and in render order — the checkbox lane is column 1.
    expect(cellAt(0, 0)).toHaveAttribute("aria-colindex", "1");
    expect(cellAt(0, 4)).toHaveAttribute("aria-colindex", "5");
  });

  it("gives the body exactly one tab stop", () => {
    renderGridUi({ cellSelection: "single" });

    const stops = screen
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("tabindex") === "0");

    // The first cell stands in until the grid has been entered, so Tab always
    // has somewhere to land — and only one somewhere.
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(cellAt(0, 0));
  });

  it("takes the body's controls out of the tab order", () => {
    renderGridUi({ cellSelection: "single", renderDetails: () => "panel" });

    // Every checkbox and chevron in the body. Left tabbable, Tab would walk
    // through one per mounted row — and how many that is depends on the scroll
    // position, which is no way to build a tab order.
    for (const row of bodyRows()) {
      for (const control of within(row).getAllByRole("checkbox")) {
        expect(control).toHaveAttribute("tabindex", "-1");
      }
      for (const control of within(row).getAllByRole("button")) {
        expect(control).toHaveAttribute("tabindex", "-1");
      }
    }

    // The header's own controls stay reachable: the header row is not part of
    // cell navigation, so Tab is the only way to them.
    expect(
      screen.getByRole("checkbox", { name: "Select all rows" }),
    ).not.toHaveAttribute("tabindex", "-1");
  });

  it("leaves the body's controls alone when cell selection is off", () => {
    renderGridUi();

    expect(
      within(bodyRows()[0]!).getByRole("checkbox"),
    ).not.toHaveAttribute("tabindex", "-1");
  });

  it("is one tab stop for the whole body", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(1, 2));
    await user.tab();

    // Out of the body entirely — not into the next row's checkbox, and not into
    // a control inside the cell just left.
    expect(focused().closest(`[data-dg-part="row"]`)).toBeNull();
  });

  it("selects the row from Space under the checkbox mode too", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(1, 3));
    await user.keyboard(" ");

    // The checkbox is no longer a tab stop, so Space on any cell of the row is
    // what replaces it. It adds rather than replaces, as ticking a box does.
    expect(bodyRows()[1]).toHaveAttribute("data-selected", "true");

    await user.keyboard("{ArrowDown} ");

    expect(bodyRows()[1]).toHaveAttribute("data-selected", "true");
    expect(bodyRows()[2]).toHaveAttribute("data-selected", "true");
  });

  it("still steps into the checkbox with Enter", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 0));
    await user.keyboard("{Enter}");

    // `tabindex="-1"` keeps it out of the tab order without putting it out of
    // reach — which is the whole point of the pair.
    expect(focused()).toBe(within(cellAt(0, 0)).getByRole("checkbox"));
  });

  it("moves the focus with the arrow keys", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    expect(focusedCoords()).toEqual({ rowId: "1", columnId: "name" });

    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(cellAt(1, 2));
    expect(focusedCoords()).toEqual({ rowId: "2", columnId: "name" });

    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe(cellAt(1, 3));

    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(focused()).toBe(cellAt(0, 2));
  });

  it("moves the tab stop with the focus", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{ArrowDown}");

    expect(cellAt(1, 2)).toHaveAttribute("tabindex", "0");
    expect(cellAt(0, 2)).toHaveAttribute("tabindex", "-1");
  });

  it("takes Home and End across the row, and Ctrl to the corners", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(2, 2));
    await user.keyboard("{End}");
    expect(focused()).toBe(cellAt(2, 4));

    await user.keyboard("{Home}");
    expect(focused()).toBe(cellAt(2, 0));

    await user.keyboard("{Control>}{End}{/Control}");
    expect(focusedCoords()).toEqual({
      rowId: String(testRows.length),
      columnId: "city",
    });

    await user.keyboard("{Control>}{Home}{/Control}");
    expect(focusedCoords()).toEqual({ rowId: "1", columnId: SELECT_COLUMN_ID });
  });

  it("stops at the edges instead of wrapping", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 0));
    await user.keyboard("{ArrowUp}{ArrowLeft}");

    expect(focused()).toBe(cellAt(0, 0));
  });

  it("steps into the cell with Enter and back out with Escape", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    const checkboxCell = cellAt(0, 0);
    await user.click(checkboxCell);
    await user.keyboard("{Enter}");

    // Inside the cell now — the arrow keys belong to whatever holds the focus,
    // which is what leaves room for an editor to take the same step later.
    expect(focused()).toBe(within(checkboxCell).getByRole("checkbox"));
    // The ring stays on the cell: that is still where navigation resumes from.
    expect(checkboxCell).toHaveAttribute("data-focused", "true");

    await user.keyboard("{Escape}");
    expect(focused()).toBe(checkboxCell);

    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(cellAt(1, 0));
  });

  it("leaves Enter alone in a cell with nothing to step into", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{Enter}");

    expect(focused()).toBe(cellAt(0, 2));
  });

  it("still selects the row from Space", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", selectionMode: "row" });

    // The click selects the row it lands on, as a click does in this mode.
    await user.click(cellAt(0, 2));
    // Moving the cell is not selecting — the keyboard walks the grid freely.
    await user.keyboard("{ArrowDown}");
    expect(bodyRows()[1]).toHaveAttribute("data-selected", "false");

    await user.keyboard(" ");

    // The row lost its own tab stop to the cells, so Space on a cell is the
    // only keyboard route left to a selection under `"row"`. It toggles rather
    // than replaces, so the row clicked into the selection is still in it.
    expect(bodyRows()[1]).toHaveAttribute("data-selected", "true");
    expect(bodyRows()[0]).toHaveAttribute("data-selected", "true");
    expect(bodyRows()[1]).not.toHaveAttribute("tabindex");
  });

  it("keeps the focus on its cell when sorting moves the row", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    // Row 3 — City "Malmö", the third of the repeating three.
    await user.click(cellAt(2, 4));
    expect(focusedCoords()).toEqual({ rowId: "3", columnId: "city" });

    await user.click(screen.getByRole("button", { name: "Sort City" }));

    // The row is somewhere else entirely now. A row/column index pair would be
    // pointing at whichever row slid into position 2; ids move with the cell.
    expect(focusedCoords()).toEqual({ rowId: "3", columnId: "city" });
    expect(renderedRowIds().indexOf("3")).not.toBe(2);
  });

  it("selects nothing but the focused cell under \"single\"", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

    // Shift is a range gesture and there are no ranges here: the focus moved,
    // and the block Ctrl+C would take is still the one cell it moved to.
    expect(selectedCells()).toEqual(["2:name"]);
  });

  it("reports every move through onFocusedCellChange", async () => {
    const user = userEvent.setup();
    const moves: Array<string> = [];
    renderGridUi({
      cellSelection: "single",
      onFocusedCellChange: (cell) =>
        moves.push(cell === null ? "none" : `${cell.rowId}:${cell.columnId}`),
    });

    await user.click(cellAt(0, 2));
    await user.keyboard("{ArrowDown}");

    expect(moves).toEqual(["1:name", "2:name"]);
  });
});

describe("cell selection — ranges", () => {
  const cellAt = (rowIndex: number, columnIndex: number) =>
    within(bodyRows()[rowIndex]!).getAllByRole("gridcell")[columnIndex]!;

  const selectedCells = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>('[data-cell][data-selected="true"]'),
    ).map((cell) => `${cell.dataset.rowId}:${cell.dataset.columnId}`);

  const rangeGrid = () => renderGridUi({ cellSelection: "range" });

  it("selects the rectangle a drag covers", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // Name of row 1 down to Age of row 3 — a two-by-three block, dragged from
    // its top-left corner.
    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 3) },
      { keys: "[/MouseLeft]" },
    ]);

    expect(selectedCells()).toEqual([
      "1:name",
      "1:age",
      "2:name",
      "2:age",
      "3:name",
      "3:age",
    ]);
  });

  it("selects the same rectangle dragged the other way", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(2, 3), keys: "[MouseLeft>]" },
      { target: cellAt(0, 2) },
      { keys: "[/MouseLeft]" },
    ]);

    expect(selectedCells()).toHaveLength(6);
    expect(selectedCells()).toContain("1:name");
    expect(selectedCells()).toContain("3:age");
  });

  it("outlines the edges of the block, not every cell in it", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 3) },
      { keys: "[/MouseLeft]" },
    ]);

    // Top-left corner: two sides. The cell in the middle of the left column:
    // one. The stylesheet draws whichever sides these name.
    expect(cellAt(0, 2)).toHaveAttribute("data-edge-top", "true");
    expect(cellAt(0, 2)).toHaveAttribute("data-edge-left", "true");
    expect(cellAt(0, 2)).toHaveAttribute("data-edge-bottom", "false");
    expect(cellAt(1, 2)).toHaveAttribute("data-edge-left", "true");
    expect(cellAt(1, 2)).toHaveAttribute("data-edge-top", "false");
  });

  it("extends the block with Shift+click, from the anchor", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(1, 2));
    await user.keyboard("{Shift>}");
    await user.click(cellAt(3, 2));
    await user.keyboard("{/Shift}");

    expect(selectedCells()).toEqual(["2:name", "3:name", "4:name"]);
  });

  it("extends the block with Shift+arrows, and collapses it without", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}{ArrowDown}{ArrowRight}{/Shift}");

    expect(selectedCells()).toEqual(["1:name", "1:age", "2:name", "2:age"]);
    // The focus is the corner that moved; the anchor stayed put.
    expect(cellAt(1, 3)).toHaveAttribute("data-focused", "true");

    await user.keyboard("{ArrowDown}");

    // A plain arrow is a move, not an extension — the block comes back to the
    // one cell, which is what keeps "what would Ctrl+C take" answerable.
    expect(selectedCells()).toEqual(["3:age"]);
  });

  it("drops the block back to one cell on Escape", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selectedCells()).toHaveLength(2);

    await user.keyboard("{Escape}");

    // Onto the focused cell, not back to the anchor: the focus is where the
    // user is looking, and the next arrow key continues from there either way.
    expect(selectedCells()).toEqual(["2:name"]);
  });

  it("copies the block as tab-separated text on Ctrl+C", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(1, 3) },
      { keys: "[/MouseLeft]" },
    ]);
    await user.keyboard("{Control>}c{/Control}");

    // Tabs between cells and CRLF between rows is what a spreadsheet reads as
    // cells; the first two rows of the fixture are Anna 20 and Erik 27.
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(
        `${testRows[0]!.name}\t${testRows[0]!.age}\r\n${testRows[1]!.name}\t${testRows[1]!.age}`,
      ),
    );
  });

  it("copies the focused cell alone when nothing is dragged", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(2, 4));
    await user.keyboard("{Control>}c{/Control}");

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(testRows[2]!.city),
    );
  });

  it("leaves the generated lanes out of what it copies", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // The checkbox lane through to Name — the lane holds a control, not data.
    await user.pointer([
      { target: cellAt(0, 0), keys: "[MouseLeft>]" },
      { target: cellAt(0, 2) },
      { keys: "[/MouseLeft]" },
    ]);
    await user.keyboard("{Control>}c{/Control}");

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(
        `${testRows[0]!.id}\t${testRows[0]!.name}`,
      ),
    );
  });

  it("marks the system lanes as selected but never copies them", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // The checkbox lane through to Name.
    await user.pointer([
      { target: cellAt(0, 0), keys: "[MouseLeft>]" },
      { target: cellAt(0, 2) },
      { keys: "[/MouseLeft]" },
    ]);

    // Part of the block: it takes the tint and the outline, so the rectangle
    // stays a rectangle and the lane keeps its place in the navigation.
    expect(cellAt(0, 0)).toHaveAttribute("data-selected", "true");
    expect(cellAt(0, 0)).toHaveAttribute("data-edge-left", "true");

    fireEvent.contextMenu(cellAt(0, 0));

    // Three cells wide, but only the two data columns can be written out.
    expect(await screen.findByText("3 cells")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeEnabled();
  });

  it("disables copy and export for a block of nothing but system lanes", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 0));
    fireEvent.contextMenu(cellAt(0, 0));

    // A checkbox has no value to copy. Saying so beats an item that looks live
    // and puts an empty string on the clipboard.
    expect(
      await screen.findByRole("menuitem", { name: "Copy" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Export as CSV for Excel" }),
    ).toBeDisabled();
  });

  it("offers the export items on a right-click inside the block", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 3) },
      { keys: "[/MouseLeft]" },
    ]);
    fireEvent.contextMenu(cellAt(1, 2));

    expect(await screen.findByText("6 cells")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Export as CSV for Excel" }),
    ).toBeInTheDocument();
    // The block is the one that was dragged: a right-click inside it is about
    // it, not about the cell under the pointer.
    expect(selectedCells()).toHaveLength(6);
  });

  it("moves the block to a right-click outside it", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(1, 2) },
      { keys: "[/MouseLeft]" },
    ]);
    fireEvent.contextMenu(cellAt(3, 4));

    expect(await screen.findByText("1 cell")).toBeInTheDocument();
    expect(selectedCells()).toEqual(["4:city"]);
  });

  it("keeps a consumer's row menu, under the grid's own items", async () => {
    const user = userEvent.setup();
    renderGridUi({
      cellSelection: "range",
      tableProps: { rowContextMenu: () => <Menu.Item>Open</Menu.Item> },
    });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    expect(
      await screen.findByRole("menuitem", { name: "Copy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
  });

  it("has no menu of its own under \"single\"", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    // Nothing to offer: the selection is always the one cell under the pointer,
    // and Ctrl+C already copies it.
    expect(
      screen.queryByRole("menuitem", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the headers toggle open while it is being toggled", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));
    const toggle = await screen.findByRole("checkbox", {
      name: "Include headers",
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(
      screen.getByRole("checkbox", { name: "Include headers" }),
    ).not.toBeChecked();
  });
});

describe("labels", () => {
  it("renders the chrome in Swedish from the preset", async () => {
    renderGridUi({ labels: TMDATAGRID_LABELS_SV });

    expect(
      screen.getByRole("button", { name: "Hantera kolumner" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Markera alla rader" }),
    ).toBeInTheDocument();
  });

  it("merges a partial override over the English defaults", () => {
    renderGridUi({
      labels: { manageColumns: "Kolumner" },
      data: [],
    } as GridProps);

    expect(
      screen.getByRole("button", { name: "Kolumner" }),
    ).toBeInTheDocument();
    // Untouched keys stay English — including the empty state.
    expect(screen.getByText("No rows to show")).toBeInTheDocument();
  });

  it("puts the localized label on the generated lane's column meta", async () => {
    const user = userEvent.setup();
    renderGridUi({ labels: TMDATAGRID_LABELS_SV });

    await user.click(screen.getByRole("button", { name: "Hantera kolumner" }));
    expect(
      await screen.findByRole("checkbox", { name: "Kryssrutemarkering" }),
    ).toBeInTheDocument();
  });
});

describe("LoadingIndicator", () => {
  function ToolbarGrid({ loading }: { loading?: boolean }) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      meta: { loading },
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.LoadingIndicator />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("spins while meta.loading is true, with rows still on screen", () => {
    renderWithMantine(<ToolbarGrid loading />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(bodyRows().length).toBeGreaterThan(0);
  });

  it("renders nothing otherwise", () => {
    renderWithMantine(<ToolbarGrid />);
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
  });
});

describe("Search", () => {
  function SearchGrid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.Search debounce={0} />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("narrows the rows across every column as it is typed", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SearchGrid />);
    expect(gridRowCount()).toBe(testRows.length);

    await user.type(screen.getByRole("textbox", { name: "Search rows" }), "Anna");

    const matches = testRows.filter((row) => row.name === "Anna").length;
    expect(gridRowCount()).toBe(matches);
  });

  it("clears through the clear button and restores every row", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SearchGrid />);

    await user.type(screen.getByRole("textbox", { name: "Search rows" }), "Anna");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(gridRowCount()).toBe(testRows.length);
    expect(screen.getByRole("textbox", { name: "Search rows" })).toHaveValue("");
  });

  it("mirrors an external globalFilter write into the input", async () => {
    const { result } = renderGrid();
    renderWithMantine(
      <TMDataGrid {...erased(result.current)}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.Search />
        </TMDataGrid.Toolbar>
      </TMDataGrid>,
    );

    result.current.table.setGlobalFilter("Erik");

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Search rows" }),
      ).toHaveValue("Erik"),
    );
  });

  it("renders nothing under enableGlobalFilter: false", () => {
    renderWithMantine(<SearchGrid enableGlobalFilter={false} />);
    expect(
      screen.queryByRole("textbox", { name: "Search rows" }),
    ).not.toBeInTheDocument();
  });
});

describe("multi-column sorting", () => {
  it("adds a second column with Shift+click and shows priorities", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(header("city"));
    await user.keyboard("{Shift>}");
    await user.click(header("age"));
    await user.keyboard("{/Shift}");

    // Both columns sort at once: city first, age appended by the Shift.
    expect(header("city")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(header("age")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(
      part("sort-index", undefined, header("city")),
    ).toHaveTextContent("1");
    expect(
      part("sort-index", undefined, header("age")),
    ).toHaveTextContent("2");
  });

  it("collapses back to one sort on a plain click, hiding the priorities", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(header("city"));
    await user.keyboard("{Shift>}");
    await user.click(header("age"));
    await user.keyboard("{/Shift}");
    await user.click(header("name"));

    expect(header("name")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(header("city")).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(queryPart("sort-index")).not.toBeInTheDocument();
  });
});

describe("summary row", () => {
  const summaryColumns = (() => {
    const helper = createTMDataGridColumnHelper<TestRow>();
    return helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", {
        header: "Age",
        footer: ({ table }) =>
          `Sum ${String(aggregateColumn({ table, columnId: "age" }))}`,
      }),
    ]);
  })();

  function SummaryGrid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: summaryColumns,
      getRowId: (row) => String(row.id),
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("renders one sticky row of footers when a column defines one", () => {
    renderWithMantine(<SummaryGrid />);

    const total = testRows.reduce((sum, row) => sum + row.age, 0);
    const summary = part("summary-row");
    expect(within(summary).getByText(`Sum ${total}`)).toBeInTheDocument();
    // Included in the stated row count: header + rows + summary.
    expect(screen.getByRole("table")).toHaveAttribute(
      "aria-rowcount",
      String(testRows.length + 2),
    );
  });

  it("renders no summary row when no column defines a footer", () => {
    renderGridUi();
    expect(queryPart("summary-row")).not.toBeInTheDocument();
  });

  it("follows the filters through aggregateColumn", async () => {
    const user = userEvent.setup();
    const { result } = renderGrid();
    const filtered = aggregateColumn({
      table: result.current.table,
      columnId: "age",
    });
    expect(filtered).toBe(testRows.reduce((sum, row) => sum + row.age, 0));

    await waitFor(() => {
      result.current.table.setColumnFilters([
        { id: "name", value: { operator: "equals", value: "Anna" } },
      ]);
    });

    const expected = testRows
      .filter((row) => row.name === "Anna")
      .reduce((sum, row) => sum + row.age, 0);
    expect(
      aggregateColumn({ table: result.current.table, columnId: "age" }),
    ).toBe(expected);
    void user;
  });
});

describe("scrollToRow", () => {
  const manyRows = makeRows(500);

  /** Captures the api so a test can call it the way a consumer would. */
  function ScrollGrid({
    onReady,
    ...options
  }: Partial<UseTMDataGridOptions<TestRow>> & {
    onReady: (api: TMDataGridApi<TestRow>) => void;
  }) {
    const grid = useTMDataGrid<TestRow>({
      data: manyRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    onReady(grid);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  const renderScrollGrid = (options: Partial<UseTMDataGridOptions<TestRow>> = {}) => {
    let api: TMDataGridApi<TestRow> | null = null;
    renderWithMantine(
      <ScrollGrid {...options} onReady={(next) => (api = next)} />,
    );
    if (api === null) throw new Error("grid never rendered");
    return api as TMDataGridApi<TestRow>;
  };

  /**
   * How many times the body asked its scroll container to move.
   *
   * The offset it asks for is TanStack Virtual's to compute, and jsdom cannot
   * check it: nothing is laid out, the ResizeObserver is a stub, and the
   * virtualizer measures everything as zero. What is testable here is the part
   * this grid owns — whether a row resolves to a scroll at all. That the rows
   * then mount is a browser-level concern; see the Testing docs page.
   */
  function countScrolls(run: () => void): number {
    const container = document.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    );
    if (container === null) throw new Error("no scroll container");
    const original = container.scrollTo;
    let calls = 0;
    container.scrollTo = (() => {
      calls += 1;
    }) as typeof container.scrollTo;
    try {
      act(run);
    } finally {
      container.scrollTo = original;
    }
    return calls;
  }

  it("scrolls for a row virtualization left out of the DOM", () => {
    const api = renderScrollGrid();

    // The point of the method: row 400 is real, and has no element — so there
    // is nothing for `scrollIntoView` to be called on.
    expect(queryPart("row", { rowId: "400" })).toBeNull();

    expect(countScrolls(() => api.scrollToRow({ rowId: "400" }))).toBe(1);
  });

  it("does not scroll for a row it cannot reach", () => {
    const api = renderScrollGrid();

    expect(countScrolls(() => api.scrollToRow({ rowId: "9999" }))).toBe(0);
  });

  it("answers false for a row the current view does not hold", () => {
    const api = renderScrollGrid();

    expect(api.scrollToRow({ rowId: "9999" })).toBe(false);
  });

  it("answers false for a row a filter has taken out", () => {
    const api = renderScrollGrid();

    act(() => {
      api.table.setGlobalFilter("Stockholm");
    });

    // Row 2 is Göteborg — filtered away, so there is nowhere to scroll to.
    expect(api.scrollToRow({ rowId: "2" })).toBe(false);
    expect(api.scrollToRow({ rowId: "1" })).toBe(true);
  });

  it("answers true for a pinned row without scrolling", () => {
    const api = renderScrollGrid({ enableRowPinning: true });

    act(() => {
      api.table.setRowPinning({ top: ["300"], bottom: [] });
    });

    // Parked at the edge: already on screen, and out of the scrolling order.
    expect(api.scrollToRow({ rowId: "300" })).toBe(true);
    expect(part("row", { rowId: "300" }, part("pinned-top"))).toBeInTheDocument();
  });
});

describe("onReachEnd", () => {
  function ReachGrid({
    rows,
    onReachEnd,
  }: {
    rows: TestRow[];
    onReachEnd: () => void;
  }) {
    const grid = useTMDataGrid<TestRow>({
      data: rows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<TestRow> onReachEnd={onReachEnd} />
      </TMDataGrid>
    );
  }

  it("fires once per row count and again when rows are appended", async () => {
    const calls: number[] = [];
    // Twelve rows all fit the stubbed 600px viewport, so the last row is
    // mounted immediately and the threshold is met on mount.
    const { rerender } = renderWithMantine(
      <ReachGrid rows={testRows} onReachEnd={() => calls.push(1)} />,
    );
    await waitFor(() => expect(calls.length).toBe(1));

    // Same count → the latch holds through re-renders.
    rerender(<ReachGrid rows={testRows} onReachEnd={() => calls.push(1)} />);
    expect(calls.length).toBe(1);

    // The append changes the count, which re-arms the latch.
    rerender(
      <ReachGrid
        rows={[...testRows, ...makeRows(2).map((row) => ({ ...row, id: row.id + 100 }))]}
        onReachEnd={() => calls.push(1)}
      />,
    );
    await waitFor(() => expect(calls.length).toBe(2));
  });

  it("does not fire on an empty grid", () => {
    const calls: number[] = [];
    renderWithMantine(<ReachGrid rows={[]} onReachEnd={() => calls.push(1)} />);
    expect(calls.length).toBe(0);
  });
});

describe("cell editing", () => {
  type Employee = { id: number; name: string; age: number; note: string };

  const editRows: Employee[] = [
    { id: 1, name: "Anna", age: 34, note: "a" },
    { id: 2, name: "Erik", age: 41, note: "b" },
  ];

  const editColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { validate: z.string().min(2, "Too short") },
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
      helper.accessor("note", {
        header: "Note",
        meta: { editable: false },
      }),
    ]);
  })();

  function EditGrid(options: Partial<UseTMDataGridOptions<Employee>> = {}) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns: editColumns,
      getRowId: (row) => String(row.id),
      editMode: "cell",
      selectionMode: "highlight",
      ...options,
    } as UseTMDataGridOptions<Employee>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    );
  }

  const cellAt = (rowIndex: number, columnIndex: number) =>
    within(bodyRows()[rowIndex]!).getAllByRole("gridcell")[columnIndex]!;

  const editorInput = () =>
    screen.getByRole("textbox", { name: "Edit Name" });

  it("opens on double-click, commits on Enter with the diff", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid onEditCommit={(args) => void commits.push(args)} />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Annika");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { rowId: string; changes: unknown[] };
    expect(commit.rowId).toBe("1");
    expect(commit.changes).toEqual([
      { columnId: "name", field: "name", previous: "Anna", next: "Annika" },
    ]);
    // The editor is gone; the cell shows content again (still the old data —
    // the grid never mutates `data`).
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
  });

  it("opens on F2 from the focused cell and reverts on Escape", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid onEditCommit={(args) => void commits.push(args)} />,
    );

    await user.click(cellAt(0, 0));
    await user.keyboard("{F2}");
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Wrong");
    await user.keyboard("{Escape}");

    expect(commits.length).toBe(0);
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    // Focus is back on the cell, ready for the next key.
    expect(document.activeElement).toBe(cellAt(0, 0));
  });

  it("opens seeded when a character is typed on the cell", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid />);

    await user.click(cellAt(0, 0));
    await user.keyboard("Z");

    // The seed replaced the value — the Sheets gesture.
    expect(editorInput()).toHaveValue("Z");
  });

  it("renders meta.editor as a component, hooks included", async () => {
    // A stateful custom editor — legal exactly because the grid renders it
    // as JSX instead of calling it.
    const StampEditor: TMDataGridEditorComponent = ({ field }) => {
      const [touches, setTouches] = useState(0);
      return (
        <div>
          <span data-testid="touch-count">{touches}</span>
          <input
            aria-label="Stamp name"
            value={String(field.state.value ?? "")}
            onChange={(event) => {
              setTouches((count) => count + 1);
              field.handleChange(event.currentTarget.value);
            }}
          />
        </div>
      );
    };
    const helper = createTMDataGridColumnHelper<Employee>();
    const customColumns = helper.columns([
      helper.accessor("name", { header: "Name", meta: { editor: StampEditor } }),
    ]);

    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        columns={customColumns}
        onEditCommit={(args) => void commits.push(args)}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = screen.getByRole("textbox", { name: "Stamp name" });
    await user.clear(input);
    await user.type(input, "Ann");
    // The editor's own state survived every keystroke — it is a component.
    expect(screen.getByTestId("touch-count").textContent).not.toBe("0");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: Array<{ next: unknown }> };
    expect(commit.changes[0]?.next).toBe("Ann");
  });

  it("blocks the commit on a field error and shows the message", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid onEditCommit={(args) => void commits.push(args)} />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "A");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Too short")).toBeInTheDocument();
    expect(commits.length).toBe(0);
    // Still editing — the invalid cell holds the edit.
    expect(editorInput()).toBeInTheDocument();
  });

  it("commits on Tab and moves to the next editable cell", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid onEditCommit={(args) => void commits.push(args)} />,
    );

    await user.dblClick(cellAt(0, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "Annika");
    await user.keyboard("{Tab}");

    await waitFor(() => expect(commits.length).toBe(1));
    // Age is next; Note is `editable: false` and would be skipped from Age.
    await waitFor(() =>
      expect(document.activeElement).toBe(cellAt(0, 1)),
    );
  });

  it("never opens on a column that opted out", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid />);

    await user.dblClick(cellAt(0, 2));

    expect(
      screen.queryByRole("textbox", { name: "Edit Note" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the draft on blur under cellConfirm, saving only through the check", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editMode="cellConfirm"
        onEditCommit={(args) => void commits.push(args)}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Annika");
    // Click away: the editor closes but the draft stays, dirty-marked.
    await user.click(cellAt(1, 1));
    expect(commits.length).toBe(0);
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    expect(cellAt(0, 0)).toHaveAttribute("data-dirty", "true");

    // Reopen and confirm through the ✓.
    await user.dblClick(cellAt(0, 0));
    expect(editorInput()).toHaveValue("Annika");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(commits.length).toBe(1));
  });

  it("row mode opens every editable cell from the pencil and saves them as one commit", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editMode="row"
        onEditCommit={(args) => void commits.push(args)}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );

    // Name and Age both open; Note (editable: false) does not.
    const name = screen.getByRole("textbox", { name: "Edit Name" });
    expect(screen.getByRole("textbox", { name: "Edit Age" })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Edit Note" }),
    ).not.toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Annika");
    const age = screen.getByRole("textbox", { name: "Edit Age" });
    await user.clear(age);
    await user.type(age, "35");

    await user.click(screen.getByRole("button", { name: "Save row" }));

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: Array<{ field: string }> };
    expect(commit.changes.map((change) => change.field).sort()).toEqual([
      "age",
      "name",
    ]);
  });

  it("row mode cancels the whole row from the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editMode="row"
        onEditCommit={(args) => void commits.push(args)}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );
    const name = screen.getByRole("textbox", { name: "Edit Name" });
    await user.clear(name);
    await user.type(name, "Thrown away");
    await user.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(commits.length).toBe(0);
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
  });

  it("blocks a row save on a cross-field refine, message on the Save", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editMode="row"
        rowValidators={{
          onSubmit: z
            .object({ name: z.string(), age: z.number() })
            .refine((row) => row.age < 100, { message: "Nobody is that old" }),
        }}
        onEditCommit={(args) => void commits.push(args)}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );
    const age = screen.getByRole("textbox", { name: "Edit Age" });
    await user.clear(age);
    await user.type(age, "120");
    await user.click(screen.getByRole("button", { name: "Save row" }));

    expect(commits.length).toBe(0);
    // Still editing, and the pathless message rides the Save's tooltip.
    expect(screen.getByRole("textbox", { name: "Edit Age" })).toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "Save row" }));
    expect(await screen.findByText("Nobody is that old")).toBeInTheDocument();
  });

  it("batch mode parks drafts on Enter and saves them through EditActions", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    function BatchGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editMode: "batch",
        selectionMode: "highlight",
        onEditCommit: (args) => void commits.push(args),
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <TMDataGrid.EditActions />
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<BatchGrid />);

    // Two rows edited; Enter parks each draft instead of committing.
    await user.dblClick(cellAt(0, 1));
    const nameInput = () => screen.getByRole("textbox", { name: "Edit Name" });
    const ageInput = () => screen.getByRole("textbox", { name: "Edit Age" });
    await user.clear(ageInput());
    await user.type(ageInput(), "35");
    await user.keyboard("{Enter}");
    await user.dblClick(cellAt(1, 0));
    await user.clear(nameInput());
    await user.type(nameInput(), "Erik B");
    await user.keyboard("{Enter}");

    expect(commits.length).toBe(0);
    expect(cellAt(0, 1)).toHaveAttribute("data-dirty", "true");
    expect(cellAt(1, 0)).toHaveAttribute("data-dirty", "true");

    await user.click(screen.getByRole("button", { name: "Save 2 rows" }));

    await waitFor(() => expect(commits.length).toBe(2));
    expect(screen.getByRole("button", { name: "Save 0 rows" })).toBeDisabled();
  });

  it("EditActions' Discard drops every draft", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    function BatchGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editMode: "batch",
        selectionMode: "highlight",
        onEditCommit: (args) => void commits.push(args),
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <TMDataGrid.EditActions />
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<BatchGrid />);

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Draft");
    await user.keyboard("{Enter}");
    expect(cellAt(0, 0)).toHaveAttribute("data-dirty", "true");

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).not.toHaveAttribute("data-dirty");
  });

  it("adds rows through the entry block and reports them with edits and deletions in one batch", async () => {
    const user = userEvent.setup();
    const batches: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editMode: "batch",
        selectionMode: "highlight",
        onEditCommitBatch: (args) => void batches.push(args),
        newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              add
            </button>
            <TMDataGrid.EditActions />
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EntryGrid />);

    // The entry block appears with open editors; type a name.
    await user.click(screen.getByRole("button", { name: "add" }));
    const entryRow = part("entry-row", { rowId: "__new__1" });
    const entryName = within(entryRow).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.type(entryName, "Ny Person");

    // Mark row 2 deleted through the lane; it renders struck through.
    await user.click(
      within(bodyRows()[1]!).getByRole("button", { name: "Delete row" }),
    );
    expect(bodyRows()[1]).toHaveAttribute("data-deleted", "true");
    expect(
      within(bodyRows()[1]!).getByRole("button", { name: "Restore row" }),
    ).toBeInTheDocument();

    // Save: the batch carries the add and the deletion together.
    await user.click(screen.getByRole("button", { name: "Save 2 rows" }));
    await waitFor(() => expect(batches.length).toBe(1));
    const batch = batches[0] as {
      rows: unknown[];
      added: Array<{ value: { name: string } }>;
      deleted: string[];
    };
    expect(batch.rows).toEqual([]);
    expect(batch.added.map((add) => add.value.name)).toEqual(["Ny Person"]);
    expect(batch.deleted).toEqual(["2"]);
    // The entry block is gone and the mark is cleared.
    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
    expect(bodyRows()[1]).not.toHaveAttribute("data-deleted", "true");
  });

  it("adds immediately from the entry row's check outside batch", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editMode: "cell",
        selectionMode: "highlight",
        onRowAdd: (args) => void adds.push(args),
        // The lane needs a reason to exist outside row mode.
        onRowDelete: () => {},
        newRowDefaults: () => ({ id: 0, name: "Ny", age: 20, note: "" }),
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              add
            </button>
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EntryGrid />);

    await user.click(screen.getByRole("button", { name: "add" }));
    const entryRow = part("entry-row", { rowId: "__new__1" });
    await user.click(
      within(entryRow).getByRole("button", { name: "Add row" }),
    );

    await waitFor(() => expect(adds.length).toBe(1));
    expect(adds[0]).toMatchObject({ value: { name: "Ny" } });
    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
  });

  it("clears the cell on Delete and commits the empty value", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid onEditCommit={(args) => void commits.push(args)} />,
    );

    await user.click(cellAt(1, 0));
    await user.keyboard("{Delete}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: unknown[] };
    expect(commit.changes).toEqual([
      { columnId: "name", field: "name", previous: "Erik", next: "" },
    ]);
  });
});

describe("typed columns in the filter panel", () => {
  type TypedRow = { id: number; status: string; active: boolean; hired: string };

  const typedRows: TypedRow[] = [
    { id: 1, status: "Paid", active: true, hired: "2026-01-15" },
    { id: 2, status: "Pending", active: false, hired: "2026-03-01" },
    { id: 3, status: "Overdue", active: true, hired: "2025-11-20" },
    { id: 4, status: "Paid", active: false, hired: "2026-06-05" },
  ];

  const typedColumns = (() => {
    const helper = createTMDataGridColumnHelper<TypedRow>();
    return helper.columns([
      helper.accessor("id", {
        header: "Id",
        meta: { type: "number", defaultFilterOperator: "between" },
      }),
      helper.accessor("status", {
        header: "Status",
        meta: { type: "select", options: "faceted" },
      }),
      helper.accessor("active", {
        header: "Active",
        meta: { type: "boolean" },
        cell: (info) => (info.getValue() ? "yes" : "no"),
      }),
      helper.accessor("hired", { header: "Hired", meta: { type: "date" } }),
    ]);
  })();

  function TypedGrid({ filterColumnId }: { filterColumnId: string }) {
    const grid = useTMDataGrid<TypedRow>({
      data: typedRows,
      columns: typedColumns,
      getRowId: (row) => String(row.id),
    });
    return (
      <>
        {/* Seeds the column's default operator and opens the panel on it —
            the same path the header menu's Filter item takes. */}
        <button
          type="button"
          onClick={() => openColumnFilter(grid, filterColumnId)}
        >
          open filter
        </button>
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TypedRow> />
        </TMDataGrid>
      </>
    );
  }

  const openFilter = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "open filter" }));
  };

  it("filters a select column through a multi-select of its faceted values", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="status" />);
    expect(gridRowCount()).toBe(typedRows.length);

    await openFilter(user);
    // The type's default operator, seeded by openColumnFilter.
    expect(screen.getByDisplayValue("is any of")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Value" }));
    await user.click(await screen.findByRole("option", { name: "Paid" }));

    expect(gridRowCount()).toBe(2);
  });

  it("filters a boolean column through the Yes/No dropdown", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="active" />);

    await openFilter(user);
    await user.click(screen.getByRole("combobox", { name: "Value" }));
    await user.click(await screen.findByRole("option", { name: "Yes" }));

    expect(gridRowCount()).toBe(2);
  });

  it("filters through a between pair, seeded by meta.defaultFilterOperator", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="id" />);

    await openFilter(user);
    // The column's own default, not the number type's "equals".
    expect(screen.getByDisplayValue("is between")).toBeInTheDocument();

    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    expect(from).toHaveAttribute("type", "number");

    fireEvent.change(from, { target: { value: "2" } });
    expect(gridRowCount()).toBe(3);

    fireEvent.change(to, { target: { value: "3" } });
    expect(gridRowCount()).toBe(2);

    // An emptied end reopens that side of the interval.
    fireEvent.change(from, { target: { value: "" } });
    expect(gridRowCount()).toBe(3);
  });

  it("filters a date column by calendar day through a date input", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="hired" />);

    await openFilter(user);
    // Switch the seeded "equals" to an ordering operator first.
    await user.click(screen.getByRole("combobox", { name: "Operator" }));
    await user.click(await screen.findByRole("option", { name: "is before" }));

    const input = screen.getByLabelText("Value");
    expect(input).toHaveAttribute("type", "date");
    fireEvent.change(input, { target: { value: "2026-01-01" } });

    expect(gridRowCount()).toBe(1);
  });
});

describe("filter controls", () => {
  type ControlRow = { id: number; status: string; active: boolean; hired: string };

  const controlRows: ControlRow[] = [
    { id: 1, status: "Paid", active: true, hired: "2026-01-15" },
    { id: 2, status: "Pending", active: false, hired: "2026-03-01" },
    { id: 3, status: "Overdue", active: true, hired: "2025-11-20" },
    { id: 4, status: "Paid", active: false, hired: "2026-06-05" },
  ];

  // A custom control sees only the bare value; the grid wraps it with the
  // current operator on the way into filter state.
  const StatusPicker: TMDataGridFilterControlComponent = ({ value, onChange }) => (
    <input
      aria-label="Status picker"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );

  const controlColumns = (() => {
    const helper = createTMDataGridColumnHelper<ControlRow>();
    return helper.columns([
      helper.accessor("id", {
        header: "Id",
        meta: {
          type: "number",
          defaultFilterOperator: "between",
          filterControl: DgRangeSliderFilter,
        },
      }),
      helper.accessor("status", {
        header: "Status",
        meta: { filterControl: DgAutocompleteFilter },
      }),
      helper.accessor("active", {
        header: "Active",
        meta: { type: "boolean", filterControl: DgTriStateFilter },
        cell: (info) => (info.getValue() ? "yes" : "no"),
      }),
      helper.accessor("hired", {
        header: "Hired",
        meta: {
          type: "date",
          defaultFilterOperator: "between",
          filterControl: DgDateRangeFilter,
        },
      }),
    ]);
  })();

  function ControlGrid({
    filterColumnId,
    columns = controlColumns,
  }: {
    filterColumnId: string;
    columns?: UseTMDataGridOptions<ControlRow>["columns"];
  }) {
    const grid = useTMDataGrid<ControlRow>({
      data: controlRows,
      columns,
      getRowId: (row) => String(row.id),
    });
    return (
      <>
        <button
          type="button"
          onClick={() => openColumnFilter(grid, filterColumnId)}
        >
          open filter
        </button>
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<ControlRow> />
        </TMDataGrid>
      </>
    );
  }

  const openFilter = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "open filter" }));
  };

  it("hands meta.filterControl the bare value and wraps what it writes", async () => {
    const helper = createTMDataGridColumnHelper<ControlRow>();
    const customColumns = helper.columns([
      helper.accessor("status", {
        header: "Status",
        meta: { filterControl: StatusPicker },
      }),
    ]);

    const user = userEvent.setup();
    renderWithMantine(
      <ControlGrid filterColumnId="status" columns={customColumns} />,
    );
    expect(gridRowCount()).toBe(controlRows.length);

    await openFilter(user);
    // The custom control replaced the built-in value input entirely.
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Status picker"), "Paid");
    // Written as the bare value, matched under the seeded "contains".
    expect(gridRowCount()).toBe(2);
  });

  it("filters booleans through DgTriStateFilter's segments", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ControlGrid filterColumnId="active" />);

    await openFilter(user);
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    expect(gridRowCount()).toBe(2);

    await user.click(screen.getByRole("radio", { name: "No" }));
    expect(gridRowCount()).toBe(2);

    // All clears the value — an inactive filter matches every row.
    await user.click(screen.getByRole("radio", { name: "All" }));
    expect(gridRowCount()).toBe(controlRows.length);
  });

  it("filters numbers through DgRangeSliderFilter, seeded from the data", async () => {
    renderWithMantine(<ControlGrid filterColumnId="id" />);

    fireEvent.click(screen.getByRole("button", { name: "open filter" }));
    const fromThumb = screen.getByRole("slider", { name: "From" });
    // Bounds came from the faceted values: 1–4.
    expect(fromThumb).toHaveAttribute("aria-valuemin", "1");
    expect(fromThumb).toHaveAttribute("aria-valuemax", "4");

    fireEvent.keyDown(fromThumb, { key: "ArrowRight" });
    // The pair became ["2", "4"] — ids 2, 3 and 4 remain.
    expect(gridRowCount()).toBe(3);
  });

  it("filters dates through DgDateRangeFilter's From/To pair", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ControlGrid filterColumnId="hired" />);

    await openFilter(user);
    const from = screen.getByLabelText("From");
    expect(from).toHaveAttribute("type", "date");

    fireEvent.change(from, { target: { value: "2026-01-01" } });
    expect(gridRowCount()).toBe(3);

    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-03-31" },
    });
    expect(gridRowCount()).toBe(2);
  });

  it("suggests the faceted values through DgAutocompleteFilter", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ControlGrid filterColumnId="status" />);

    await openFilter(user);
    const input = screen.getByRole("combobox", { name: "Value" });
    await user.type(input, "Pa");
    // The data's own values as suggestions…
    await user.click(await screen.findByRole("option", { name: "Paid" }));
    // …and the picked one filters under "contains".
    expect(gridRowCount()).toBe(2);
  });
});

/**
 * The attributes a consumer's own suite is written against — see the Testing
 * docs page. They are a published contract, so they get tests of their own
 * rather than being covered incidentally by whatever else queries them.
 */
describe("testing contract", () => {
  it("names the root and the grid element", () => {
    renderWithMantine(
      <Grid tableProps={{ "aria-label": "Employees" }} data-testid="employees" />,
    );

    const root = screen.getByTestId("employees");
    expect(root).toHaveAttribute("data-dg-root");
    // The scoping the whole contract rests on: a row is found *through* the
    // named root, which is what keeps two grids on a page apart.
    expect(part("row", { rowId: "1" }, root)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Employees" })).toBeInTheDocument();
  });

  it("addresses a cell by its row and column, with cell selection off", () => {
    const { container } = renderGridUi();

    const cell = container.querySelector(
      '[data-row-id="3"][data-column-id="name"]',
    );
    expect(cell).toHaveTextContent("Maria");
    // Not a `gridcell`: that role is cell selection's promise, and this grid
    // makes none.
    expect(cell).toHaveAttribute("role", "cell");
  });

  it("carries the column id on the header as well as the cells", () => {
    const { container } = renderGridUi();

    expect(header("name")).toHaveAttribute(
      "data-column-id",
      "name",
    );
    expect(
      container.querySelectorAll('[data-column-id="name"]').length,
    ).toBeGreaterThan(1);
  });

  it("publishes the row count the grid is showing, mounted or not", async () => {
    const user = userEvent.setup();
    renderGridUi();

    const grid = screen.getByRole("table");
    expect(grid).toHaveAttribute("data-dg-row-count", String(testRows.length));

    await user.click(part("filter-button"));
    await user.type(part("filter-value"), "3");

    expect(grid).toHaveAttribute("data-dg-row-count", "1");
  });

  it("marks itself busy while meta.loading is set", () => {
    const { rerender } = renderGridUi();
    expect(screen.getByRole("table")).not.toHaveAttribute("aria-busy");

    // Set even with rows on screen: a refetch is still a fetch, and this is
    // the only thing saying so once the body has stopped being empty.
    rerender(<Grid meta={{ loading: true }} />);
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(bodyRows().length).toBeGreaterThan(0);
  });

  it("reaches the chrome by test id under a translated grid", async () => {
    const user = userEvent.setup();
    // The point of the sweep: none of these ids move when the copy does.
    renderGridUi({ labels: TMDATAGRID_LABELS_SV });

    expect(part("toolbar")).toBeInTheDocument();
    expect(part("summary-count")).toHaveTextContent("12 / 12");

    await user.click(part("filter-button"));
    const filterRow = part("filter-row", { columnId: "id" });
    expect(filterRow).toHaveAttribute("data-column-id", "id");
    await user.type(part("filter-value", undefined, filterRow), "3");
    expect(gridRowCount()).toBe(1);

    await user.click(part("filter-panel-close"));
    expect(queryPart("filter-panel")).not.toBeInTheDocument();

    // Clearing takes the panel with it — nothing left in it to show.
    await user.click(part("filter-button"));
    await user.click(part("filter-clear-all"));
    expect(gridRowCount()).toBe(12);

    await user.click(part("columns-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });

  it("sorts and pages through the lane and pager test ids", async () => {
    const user = userEvent.setup();
    renderGridUi({ enablePagination: true, initialState: { pagination: { pageIndex: 0, pageSize: 5 } } });

    await user.click(part("header-sort", { columnId: "age" }));
    expect(header("age")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );

    expect(part("page-range")).toHaveTextContent("1–5 of 12");
    await user.click(part("page-next"));
    expect(part("page-range")).toHaveTextContent("6–10 of 12");
  });

  it("drives the edit lane and its editor by test id", async () => {
    const user = userEvent.setup();
    type Employee = { id: number; name: string; age: number };
    const helper = createTMDataGridColumnHelper<Employee>();
    const columns = helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
    const commits: Array<{ rowId: string }> = [];
    // Outside the component: a fresh array identity every render rebuilds the
    // row model, and the render that follows makes another one.
    const data: Array<Employee> = [{ id: 1, name: "Anna", age: 34 }];

    function EditGrid() {
      const grid = useTMDataGrid<Employee>({
        data,
        columns,
        getRowId: (row) => String(row.id),
        editMode: "row",
        selectionMode: "highlight",
        onEditCommit: (args) => void commits.push({ rowId: args.rowId }),
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }

    renderWithMantine(<EditGrid />);

    await user.click(part("edit-row", { rowId: "1" }));
    const editor = part("editor", { rowId: "1", columnId: "name" });
    await user.clear(part("editor-input", undefined, editor));
    await user.type(part("editor-input", undefined, editor), "Annika");
    await user.click(part("save-row", { rowId: "1" }));

    await waitFor(() => expect(commits).toEqual([{ rowId: "1" }]));
  });

  it("narrows through the search test id", async () => {
    const user = userEvent.setup();
    function SearchGrid() {
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row) => String(row.id),
      });
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <TMDataGrid.Search debounce={0} />
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    renderWithMantine(<SearchGrid />);

    await user.type(part("search"), "Sofia");
    // The count the docs tell a Playwright suite to wait on.
    expect(screen.getByRole("table")).toHaveAttribute("data-dg-row-count", "2");

    await user.click(part("search-clear"));
    expect(screen.getByRole("table")).toHaveAttribute("data-dg-row-count", "12");
  });

  it("ticks a row through its checkbox part", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("select-row", { rowId: "2" }));
    expect(part("row", { rowId: "2" })).toHaveAttribute(
      "data-selected",
      "true",
    );

    await user.click(part("select-all"));
    expect(part("row", { rowId: "1" })).toHaveAttribute(
      "data-selected",
      "true",
    );
  });
});

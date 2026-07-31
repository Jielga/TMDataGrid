import { Menu } from "@mantine/core";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  erased,
  renderGrid,
  renderWithMantine,
  testColumns,
  testRows,
  visibleColumnIds,
  type TestRow,
} from "../../test/gridHarness";
import { getColumnCapabilities } from "../core/capabilities";
import { TMDATAGRID_LABELS_SV } from "../core/labelsSv";
import { DETAILS_COLUMN_ID } from "./TMDataGridDetailsColumn";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";
import { TMDataGrid } from "./TMDataGrid";
import { TMDataGridFilterPills } from "./TMDataGridFilterPills";
import type { TMDataGridTableProps } from "./TMDataGridTable";
import {
  useTMDataGrid,
  type TMDataGridDetailsArgs,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

type GridProps = Partial<UseTMDataGridOptions<TestRow>> & {
  /** Everything under this key goes to `TMDataGrid.Table`, not to the hook. */
  tableProps?: TMDataGridTableProps<TestRow>;
};

/**
 * Smoke tests for the wiring between the chrome and the table: that a click on
 * a header sorts, that the panels write filter and visibility state, and that
 * the pager pages. TanStack's own behaviour is not re-tested here.
 */
function Grid({ tableProps, ...options }: GridProps = {}) {
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
        <TMDataGrid.Table<TestRow> {...tableProps} />
        <TMDataGrid.Footer />
      </TMDataGrid>
    </>

  );
}

const renderGridUi = (options: GridProps = {}) =>
  renderWithMantine(<Grid {...options} />);

const bodyRows = () =>
  screen
    .getAllByRole("row")
    .filter((row) => row.getAttribute("data-testid")?.startsWith("dg-row-"));

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

    fireEvent.contextMenu(screen.getByTestId("dg-header-city"));

    expect(itemLabels()).toEqual(fromButton);
  });

  it("leaves a control lane's header to the browser's own menu", () => {
    renderGridUi();

    // No column menu on the select-all lane, so nothing to open — the native
    // menu is the right answer there rather than an empty dropdown.
    fireEvent.contextMenu(screen.getByTestId(`dg-header-${SELECT_COLUMN_ID}`));

    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
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

  it("marks the control lanes, which the stylesheet unpads", () => {
    renderGridUi();
    const [firstRow] = bodyRows();

    // jsdom has no layout, so the clipping this guards against cannot be
    // asserted here: the cell padding grows with `size` and would squeeze the
    // box out of its fixed 36px track at `xl`. The attribute is what the CSS
    // hangs off, so it is what the test pins down.
    expect(screen.getByTestId("dg-header-__select__")).toHaveAttribute(
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
      row.getAttribute("data-testid")?.startsWith("dg-row-"),
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
    expect(screen.getByTestId("dg-header-__group__")).toBeInTheDocument();
    expect(screen.queryByTestId("dg-header-city")).not.toBeInTheDocument();
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

    expect(screen.getByTestId("dg-header-city")).toBeInTheDocument();
    expect(screen.queryByTestId("dg-header-__group__")).not.toBeInTheDocument();
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
      .map((header) => (header.getAttribute("data-testid") ?? "").replace("dg-header-", ""));

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
      : within(screen.getByTestId(`dg-row-${rowId}`)).getByRole("button", {
          name: /(Show|Hide) details/,
        });

  it("renders no panel until a row is expanded", () => {
    renderGridUi({ renderDetails });

    expect(detailsToggle("1")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("dg-details-1")).not.toBeInTheDocument();
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

    const panel = screen.getByTestId("dg-details-3");
    expect(panel).toHaveTextContent("Details for Maria");
    // Inside the row element: one measurement covers the row and its panel.
    expect(screen.getByTestId("dg-row-3")).toContainElement(panel);
    expect(screen.queryByTestId("dg-details-2")).not.toBeInTheDocument();
  });

  it("closes it again on the second click", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle("3"));
    await user.click(detailsToggle("3"));

    expect(screen.queryByTestId("dg-details-3")).not.toBeInTheDocument();
  });

  it("spans every column without adding a row to the count", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });
    const grid = screen.getByRole("table");
    const rowCount = grid.getAttribute("aria-rowcount");

    await user.click(detailsToggle("3"));

    // A cell spanning the row rather than a row of its own, so the count still
    // counts records.
    expect(screen.getByTestId("dg-details-3")).toHaveAttribute(
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

    expect(screen.getByTestId("dg-details-3")).toBeInTheDocument();
    expect(screen.getByTestId("dg-row-3")).toHaveAttribute(
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
      .map((header) => header.getAttribute("data-testid"));
    expect(headers.slice(0, 3)).toEqual([
      `dg-header-${SELECT_COLUMN_ID}`,
      `dg-header-${GROUP_COLUMN_ID}`,
      `dg-header-${DETAILS_COLUMN_ID}`,
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
    expect(focused().closest('[data-testid^="dg-row-"]')).toBeNull();
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
    expect(screen.getByText("No rows match your filters")).toBeInTheDocument();
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

    await user.click(screen.getByTestId("dg-header-city"));
    await user.keyboard("{Shift>}");
    await user.click(screen.getByTestId("dg-header-age"));
    await user.keyboard("{/Shift}");

    // Both columns sort at once: city first, age appended by the Shift.
    expect(screen.getByTestId("dg-header-city")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(screen.getByTestId("dg-header-age")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(
      within(screen.getByTestId("dg-header-city")).getByTestId("dg-sort-index"),
    ).toHaveTextContent("1");
    expect(
      within(screen.getByTestId("dg-header-age")).getByTestId("dg-sort-index"),
    ).toHaveTextContent("2");
  });

  it("collapses back to one sort on a plain click, hiding the priorities", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByTestId("dg-header-city"));
    await user.keyboard("{Shift>}");
    await user.click(screen.getByTestId("dg-header-age"));
    await user.keyboard("{/Shift}");
    await user.click(screen.getByTestId("dg-header-name"));

    expect(screen.getByTestId("dg-header-name")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(screen.getByTestId("dg-header-city")).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(screen.queryByTestId("dg-sort-index")).not.toBeInTheDocument();
  });
});

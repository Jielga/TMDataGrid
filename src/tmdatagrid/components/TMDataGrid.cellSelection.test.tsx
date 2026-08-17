import { Menu } from "@mantine/core";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  bodyRows,
  cellAt,
  renderedRowIds,
  renderGridUi,
  selectedCells,
  testRows,
} from "../../test/gridHarness";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";

/**
 * The cell cursor and the range rectangle. Split from TMDataGrid.test.tsx
 * for worker parallelism; the shared scaffolding lives in the harness.
 */
describe("cell selection", () => {
  /**
   * All twelve test rows are mounted under jsdom - the virtualizer falls back
   * to a 600px viewport, which is more than they need - so a move never has to
   * wait for a scroll to mount its target here.
   */
  /** Where the keyboard is, read off the DOM rather than off the store. */
  const focused = () => document.activeElement as HTMLElement;

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

    // Still a table of cells, and nothing in the body is reachable by Tab -
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
    // 1-based, and in render order - the checkbox lane is column 1.
    expect(cellAt(0, 0)).toHaveAttribute("aria-colindex", "1");
    expect(cellAt(0, 4)).toHaveAttribute("aria-colindex", "5");
  });

  it("gives the body exactly one tab stop", () => {
    renderGridUi({ cellSelection: "single" });

    const stops = screen
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("tabindex") === "0");

    // The first cell stands in until the grid has been entered, so Tab always
    // has somewhere to land - and only one somewhere.
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(cellAt(0, 0));
  });

  it("takes the body's controls out of the tab order", () => {
    renderGridUi({ cellSelection: "single", renderDetails: () => "panel" });

    // Every checkbox and chevron in the body. Left tabbable, Tab would walk
    // through one per mounted row - and how many that is depends on the scroll
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

    // Out of the body entirely - not into the next row's checkbox, and not into
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
    // reach - which is the whole point of the pair.
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

    // Inside the cell now - the arrow keys belong to whatever holds the focus,
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
    // Moving the cell is not selecting - the keyboard walks the grid freely.
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

    // Row 3 - City "Malmö", the third of the repeating three.
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

describe("cell selection - ranges", () => {
  const rangeGrid = () => renderGridUi({ cellSelection: "range" });

  it("selects the rectangle a drag covers", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // Name of row 1 down to Age of row 3 - a two-by-three block, dragged from
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

    // A plain arrow is a move, not an extension - the block comes back to the
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

    // The checkbox lane through to Name - the lane holds a control, not data.
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


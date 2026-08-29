import { Button, Menu } from "@mantine/core";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  header,
  openColumnMenu,
  part,
  parts,
  queryPart,
  renderGridUi,
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDATAGRID_LABELS_EN } from "../core/labels";
import { useTMDataGrid } from "../useTMDataGrid";
import { TMDataGrid } from "./TMDataGrid";

/** Every hideable column of the harness grid, in render order. */
const HIDEABLE = ["id", "name", "age", "city"];

const toggledColumnIds = () =>
  parts("columns-toggle").map((item) => item.dataset.columnId);

/**
 * A grid whose toolbar is whatever the test passes. The harness toolbar is
 * fixed, and these cases are about what a consumer puts in the menu.
 */
function MenuGrid({ children }: { children: ReactNode }) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
  });

  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Toolbar>{children}</TMDataGrid.Toolbar>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>
  );
}

describe("TMDataGrid.Menu", () => {
  it("opens from the burger and lists a consumer's own item", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <Menu.Item>Export CSV</Menu.Item>
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));

    expect(
      screen.getByRole("menuitem", { name: "Export CSV" }),
    ).toBeInTheDocument();
  });

  it("lists one checkbox item per hideable column", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));

    expect(toggledColumnIds()).toEqual(HIDEABLE);
    expect(part("columns-toggle", { columnId: "city" })).toHaveAttribute(
      "role",
      "menuitemcheckbox",
    );

    await user.click(part("columns-toggle", { columnId: "city" }));

    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
    // A checkbox item is not a command, so the menu is still open behind it.
    expect(toggledColumnIds()).toEqual(HIDEABLE);
  });

  it("narrows the list from the search box", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.type(part("columns-search"), "ci");

    expect(toggledColumnIds()).toEqual(["city"]);

    await user.clear(part("columns-search"));
    await user.type(part("columns-search"), "zzz");

    expect(toggledColumnIds()).toEqual([]);
    expect(
      screen.getByText(TMDATAGRID_LABELS_EN.columnsNoMatch("zzz")),
    ).toBeInTheDocument();
  });

  it("shows and hides every listed column from one item", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle-all"));

    for (const columnId of HIDEABLE) {
      expect(queryPart("header", { columnId })).not.toBeInTheDocument();
    }

    await user.click(part("columns-toggle-all"));

    for (const columnId of HIDEABLE) {
      expect(header(columnId)).toBeInTheDocument();
    }
  });

  it("shows all from a partial state rather than hiding the rest", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));

    // Some shown but not all. The item stays checked - it carries the minus
    // rather than the tick - and the click completes the set.
    expect(part("columns-toggle-all")).toHaveAttribute("aria-checked", "true");

    await user.click(part("columns-toggle-all"));

    for (const columnId of HIDEABLE) {
      expect(header(columnId)).toBeInTheDocument();
    }
  });

  it("Reset layout brings a hidden column back", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();

    await user.click(part("columns-reset"));

    expect(header("city")).toBeInTheDocument();
  });

  it("offers no toggles on a grid where nothing can be hidden", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableHiding: false });

    await user.click(part("menu-button"));

    expect(screen.queryAllByRole("menuitemcheckbox")).toHaveLength(0);
  });

  it("works inside a consumer's own Mantine menu", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <Menu>
          <Menu.Target>
            <Button>View</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <TMDataGrid.Menu.ColumnToggles />
          </Menu.Dropdown>
        </Menu>
      </MenuGrid>,
    );

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(toggledColumnIds()).toEqual(HIDEABLE);

    await user.click(part("columns-toggle", { columnId: "city" }));

    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });

  it("moves ArrowDown from the search to the first column, past items above", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <Menu.Item>Export CSV</Menu.Item>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));
    await user.click(part("columns-search"));
    await user.keyboard("{ArrowDown}");

    // Mantine's own walk would have started at "Export CSV", the dropdown's
    // first item, and Enter would have run it.
    expect(part("columns-toggle", { columnId: "id" })).toHaveFocus();
  });

  it("hangs the chooser off the header menu's Manage columns submenu", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await openColumnMenu(user, "City");
    // `Menu.Sub` opens on hover or on ArrowRight, never on a click.
    await user.hover(screen.getByRole("menuitem", { name: "Manage columns" }));

    await waitFor(() => expect(toggledColumnIds()).toEqual(HIDEABLE));

    // Not `user.click`: it moves the pointer off the sub target first, and the
    // submenu's safe-polygon guard has no geometry to work with under jsdom,
    // so it closes the dropdown before the click can land.
    fireEvent.click(part("columns-toggle", { columnId: "name" }));

    expect(queryPart("header", { columnId: "name" })).not.toBeInTheDocument();
  });
});

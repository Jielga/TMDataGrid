import { Button, Menu } from "@mantine/core";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  bodyRows,
  openColumnMenu,
  part,
  queryPart,
  renderedRowIds,
  renderGridUi,
} from "../../test/gridHarness";

/**
 * The P2 render slots: the two chrome slots that hand over
 * `{ state, actions, Controls }`, and the two menu slots that hand back the
 * grid's own items.
 *
 * What is worth pinning here is the seam, not the chrome behind it: that a
 * `Controls` member is the built-in control rather than a lookalike, and that
 * the handback decides composition rather than the grid guessing.
 */

describe("renderPagination", () => {
  const paged = {
    enablePagination: true,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  };

  it("hands over the state, the actions and the built-in controls", () => {
    const seen: Array<string> = [];

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ state, actions, Controls }) => {
          seen.push(
            `${state.pageIndex}/${state.pageCount}:${state.rowCount}:${state.from}-${state.to}`,
          );
          return (
            <>
              <Controls.PageSize />
              <Button onClick={() => actions.nextPage()}>Forward</Button>
            </>
          );
        },
      },
    });

    expect(seen[0]).toBe("0/3:12:1-5");
    // The built-in select, not a rebuilt one - same part, same options.
    expect(part("page-size")).toBeInTheDocument();
    // The built-in pager was not asked for, so it is not there.
    expect(queryPart("page-next")).not.toBeInTheDocument();
  });

  it("pages the grid through the actions it was handed", async () => {
    const user = userEvent.setup();

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ actions }) => (
          <Button onClick={() => actions.nextPage()}>Forward</Button>
        ),
      },
    });

    expect(renderedRowIds()).toEqual(["1", "2", "3", "4", "5"]);
    await user.click(screen.getByRole("button", { name: "Forward" }));
    expect(renderedRowIds()).toEqual(["6", "7", "8", "9", "10"]);
  });

  it("keeps the built-in pager working when it is the part reused", async () => {
    const user = userEvent.setup();

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ Controls }) => (
          <>
            <span>Custom label</span>
            <Controls.Pager />
          </>
        ),
      },
    });

    expect(screen.getByText("Custom label")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(renderedRowIds()).toEqual(["6", "7", "8", "9", "10"]);
  });

  it("reports paging as suspended while a grouping is active", () => {
    const seen: Array<boolean> = [];

    renderGridUi({
      ...paged,
      initialState: {
        pagination: { pageIndex: 0, pageSize: 5 },
        grouping: ["name"],
      },
      footerProps: {
        renderPagination: ({ state }) => {
          seen.push(state.isPagingActive);
          return <span>Pager</span>;
        },
      },
    });

    expect(seen[0]).toBe(false);
  });
});

describe("renderColumnMenuItems", () => {
  it("hands back the items the grid would have rendered", async () => {
    const user = userEvent.setup();
    const seen: Array<number> = [];

    renderGridUi({
      tableProps: {
        renderColumnMenuItems: ({ column, internalItems }) => {
          seen.push(internalItems.length);
          return [
            ...internalItems,
            <Menu.Item key="stats">Stats for {column.id}</Menu.Item>,
          ];
        },
      },
    });

    await openColumnMenu(user, "Name");

    expect(seen[0]).toBeGreaterThan(0);
    // The built-ins survive alongside the addition.
    expect(
      screen.getByRole("menuitem", { name: "Sort by ASC" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Stats for name" }),
    ).toBeInTheDocument();
  });

  it("replaces the menu when the built-ins are dropped", async () => {
    const user = userEvent.setup();

    renderGridUi({
      tableProps: {
        renderColumnMenuItems: () => [<Menu.Item key="only">Only mine</Menu.Item>],
      },
    });

    await openColumnMenu(user, "Name");

    expect(
      screen.getByRole("menuitem", { name: "Only mine" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Sort by ASC" }),
    ).not.toBeInTheDocument();
  });

  it("leaves no menu button at all when it returns nothing", () => {
    renderGridUi({ tableProps: { renderColumnMenuItems: () => [] } });

    expect(
      screen.queryByRole("button", { name: "Name column menu" }),
    ).not.toBeInTheDocument();
  });

  it("is given the column it is opening", async () => {
    const user = userEvent.setup();
    const columns: Array<string> = [];

    renderGridUi({
      tableProps: {
        renderColumnMenuItems: ({ column, internalItems }) => {
          columns.push(column.id);
          return internalItems;
        },
      },
    });

    await openColumnMenu(user, "Name");

    expect(columns).toContain("name");
  });
});

describe("renderRowContextMenu", () => {
  /** Right-clicks the Name cell of a row. Cell 0 is the checkbox column. */
  const contextClickName = (rowIndex: number) =>
    // `gridcell`, not `cell`: cell selection flips the roles - see the
    // Testing docs page.
    fireEvent.contextMenu(
      within(bodyRows()[rowIndex]).getAllByRole("gridcell")[2],
    );

  const ranged = { cellSelection: "range" as const };

  it("keeps the grid's items above its own when internalItems is untouched", async () => {
    renderGridUi({
      ...ranged,
      tableProps: {
        renderRowContextMenu: () => <Menu.Item>Mine</Menu.Item>,
      },
    });

    contextClickName(0);

    // Both halves, the grid's first - today's zero-config behavior.
    expect(await screen.findByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Mine" })).toBeInTheDocument();
  });

  it("hands the composition over once internalItems is read", async () => {
    renderGridUi({
      ...ranged,
      tableProps: {
        // Read but deliberately not rendered: taking the handback means
        // owning the whole menu, dropping the grid's half included.
        renderRowContextMenu: ({ internalItems }) => {
          void internalItems;
          return <Menu.Item>Mine only</Menu.Item>;
        },
      },
    });

    contextClickName(0);

    expect(
      await screen.findByRole("menuitem", { name: "Mine only" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("renders the grid's items where they are placed", async () => {
    renderGridUi({
      ...ranged,
      tableProps: {
        renderRowContextMenu: ({ internalItems }) => (
          <>
            <Menu.Item>First mine</Menu.Item>
            {internalItems}
          </>
        ),
      },
    });

    contextClickName(0);

    const items = await screen.findAllByRole("menuitem");
    expect(items[0]).toHaveTextContent("First mine");
    expect(items.map((item) => item.textContent)).toContain("Copy");
  });
});

describe("EditActions renderActions", () => {
  const editable = {
    editing: { mode: "cell" as const, onCommit: vi.fn() },
  };

  it("hands over the pending count and the built-in buttons", () => {
    const seen: Array<number> = [];

    renderGridUi({
      ...editable,
      editActionsProps: {
        renderActions: ({ state, Controls }) => {
          seen.push(state.pendingCount);
          return (
            <>
              <span>Pending: {state.pendingCount}</span>
              <Controls.Save />
            </>
          );
        },
      },
    });

    expect(seen[0]).toBe(0);
    expect(screen.getByText("Pending: 0")).toBeInTheDocument();
    // The built-in Save, by its part - and disabled, with nothing pending.
    expect(part("save-all")).toBeDisabled();
    expect(queryPart("discard-all")).not.toBeInTheDocument();
  });

  it("renders nothing at all while editing is off", () => {
    renderGridUi({
      editActionsProps: { renderActions: () => <span>Should not render</span> },
    });

    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
  });
});

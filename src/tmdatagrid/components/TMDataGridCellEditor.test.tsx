import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type UseTMDataGridOptions,
} from "../index";

/**
 * The built-in typed editors, opened and driven the way a user does it —
 * through the grid, not the components in isolation. Each editor's one
 * distinctive behaviour is the thing under test: what it writes back, and
 * when it commits. The string editor's open/commit/cancel/seed flows live in
 * TMDataGrid.test.tsx's "cell editing".
 */
type Task = {
  id: number;
  done: boolean;
  due: Date | null;
  dueIso: string;
  status: string;
  tags: Array<string>;
};

const helper = createTMDataGridColumnHelper<Task>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const taskColumns = helper.columns([
  helper.accessor("done", {
    header: "Done",
    meta: { type: "boolean" },
    cell: (info) => (info.getValue() ? "yes" : "no"),
  }),
  helper.accessor("due", { header: "Due", meta: { type: "date" } }),
  helper.accessor("dueIso", { header: "Due ISO", meta: { type: "date" } }),
  helper.accessor("status", {
    header: "Status",
    meta: { type: "select", options: ["Pending", "Paid", "Overdue"] },
  }),
  helper.accessor("tags", {
    header: "Tags",
    meta: { type: "multiSelect", options: ["red", "blue", "green"] },
  }),
]);

const tasks: Array<Task> = [
  {
    id: 1,
    done: false,
    due: new Date(2026, 7, 1), // 2026-08-01 local
    dueIso: "2026-08-01",
    status: "Pending",
    tags: ["red"],
  },
];

type Commit = TMDataGridEditCommitArgs<Task>;

function EditorGrid({
  onEditCommit,
  ...options
}: Partial<UseTMDataGridOptions<Task>>) {
  const grid = useTMDataGrid<Task>({
    data: tasks,
    columns: taskColumns,
    getRowId: (row) => String(row.id),
    editMode: "cell",
    selectionMode: "highlight",
    onEditCommit,
    ...options,
  } as UseTMDataGridOptions<Task>);
  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Table<Task> />
    </TMDataGrid>
  );
}

/** By the published coordinates — the way a consumer's test would. */
function cell(container: HTMLElement, columnId: string) {
  const found = container.querySelector<HTMLElement>(
    `[role="gridcell"][data-row-id="1"][data-column-id="${columnId}"]`,
  );
  if (found === null) throw new Error(`no cell for column "${columnId}"`);
  return found;
}

function renderEditorGrid() {
  const commits: Array<Commit> = [];
  const rendered = renderWithMantine(
    <EditorGrid onEditCommit={(args) => void commits.push(args as Commit)} />,
  );
  return { ...rendered, commits };
}

describe("the boolean editor", () => {
  it("edits through a checkbox and writes a boolean back", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "done"));
    const box = screen.getByRole("checkbox", { name: "Edit Done" });
    await user.click(box);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      { columnId: "done", field: "done", previous: false, next: true },
    ]);
  });
});

describe("the date editor", () => {
  it("keeps writing Dates to a cell that held a Date", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "due"));
    const input = screen.getByLabelText("Edit Due");
    // The native date input presents the Date's local day.
    expect(input).toHaveValue("2026-08-01");
    fireEvent.change(input, { target: { value: "2026-08-20" } });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    const next = commits[0]?.changes[0]?.next;
    if (!(next instanceof Date)) throw new Error("expected a Date back");
    expect(next.toLocaleDateString("sv-SE")).toBe("2026-08-20");
  });

  it("keeps writing strings to a cell that held an ISO string", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "dueIso"));
    fireEvent.change(screen.getByLabelText("Edit Due ISO"), {
      target: { value: "2026-08-20" },
    });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      {
        columnId: "dueIso",
        field: "dueIso",
        previous: "2026-08-01",
        next: "2026-08-20",
      },
    ]);
  });

  it("writes null for a cleared date, whichever shape the cell held", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "due"));
    fireEvent.change(screen.getByLabelText("Edit Due"), {
      target: { value: "" },
    });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe(null);
  });
});

describe("the select editor", () => {
  it("commits on pick under cell mode — the pick is the edit", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "status"));
    await user.click(screen.getByRole("combobox", { name: "Edit Status" }));
    await user.click(await screen.findByRole("option", { name: "Paid" }));

    // No Enter — picking committed and closed the editor.
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      { columnId: "status", field: "status", previous: "Pending", next: "Paid" },
    ]);
    expect(
      screen.queryByRole("combobox", { name: "Edit Status" }),
    ).not.toBeInTheDocument();
  });
});

describe("the multiSelect editor", () => {
  it("builds the set across picks and only commits on Enter", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "tags"));
    const input = screen.getByRole("combobox", { name: "Edit Tags" });
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "blue" }));
    await user.click(await screen.findByRole("option", { name: "green" }));

    // Building a set takes several picks; none of them is the commit.
    expect(commits.length).toBe(0);

    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toEqual(["red", "blue", "green"]);
  });
});

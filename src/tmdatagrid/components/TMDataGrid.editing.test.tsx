import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bodyRows,
  cellAt,
  part,
  queryPart,
  renderWithMantine,
} from "../../test/gridHarness";
import type { TMDataGridEditorComponent } from "../core/editEngine";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

/**
 * Cell, row and batch editing through the real grid. Split from
 * TMDataGrid.test.tsx for worker parallelism; the shared scaffolding lives
 * in the harness. The typed editors' own behaviour is in
 * TMDataGridCellEditor.test.tsx.
 */
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

  // This grid has no checkbox lane, so its columns start at cell 0:
  // [Name, Age, Note].
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
    // The editor is gone; the cell shows content again (still the old data -
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

    // The seed replaced the value - the Sheets gesture.
    expect(editorInput()).toHaveValue("Z");
  });

  it("renders meta.editor as a component, hooks included", async () => {
    // A stateful custom editor - legal exactly because the grid renders it
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
    // The editor's own state survived every keystroke - it is a component.
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
    // Still editing - the invalid cell holds the edit.
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

  function BatchGrid({
    onEditCommit,
  }: {
    onEditCommit: (args: unknown) => void;
  }) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns: editColumns,
      getRowId: (row) => String(row.id),
      editMode: "batch",
      selectionMode: "highlight",
      onEditCommit,
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

  it("batch mode parks drafts on Enter and saves them through EditActions", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <BatchGrid onEditCommit={(args) => void commits.push(args)} />,
    );

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
    renderWithMantine(
      <BatchGrid onEditCommit={(args) => void commits.push(args)} />,
    );

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


import { useState } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bodyRows,
  cellAt,
  part,
  parts,
  queryPart,
  renderWithMantine,
} from "../../test/gridHarness";
import type { TMDataGridEditorComponent } from "../core/editEngine";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridEditingOptions,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * Cell, row and draft editing through the real grid. Split from
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

  /** The same rows with row two out - a stable identity, for the remount. */
  const firstRowOnly: Employee[] = [editRows[0]!];

  const editColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { validate: z.string().min(2, "Too short") } },
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
      helper.accessor("note", {
        header: "Note",
        meta: { edit: { enabled: false } },
      }),
    ]);
  })();

  /** `editing` is partial here: the tests override members of the default. */
  type EditGridProps = Omit<
    Partial<UseTMDataGridOptions<Employee>>,
    "editing"
  > & { editing?: Partial<TMDataGridEditingOptions<Employee>> };

  function EditGrid({ editing, ...options }: EditGridProps = {}) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns: editColumns,
      getRowId: (row) => String(row.id),
      editing: { mode: "cell", ...editing },
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
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
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
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
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

  it("renders meta.edit.editor as a component, hooks included", async () => {
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
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { editor: StampEditor } },
      }),
    ]);

    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        columns={customColumns}
        editing={{ onCommit: (args) => void commits.push(args) }}
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
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
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
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    await user.dblClick(cellAt(0, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "Annika");
    await user.keyboard("{Tab}");

    await waitFor(() => expect(commits.length).toBe(1));
    // Age is next; Note is `edit.enabled: false` and is skipped from Age.
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
        editing={{
          mode: "cellConfirm",
          onCommit: (args) => void commits.push(args),
        }}
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
    // The kept draft is what the cell shows - `data` still says "Anna".
    expect(cellAt(0, 0)).toHaveTextContent("Annika");

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
        editing={{ mode: "row", onCommit: (args) => void commits.push(args) }}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );

    // Name and Age both open; Note (edit.enabled: false) does not.
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

  it("row mode edits a second row alongside a dirty first one", async () => {
    const user = userEvent.setup();
    const commits: Array<{ rowId: string }> = [];
    renderWithMantine(
      <EditGrid
        editing={{
          mode: "row",
          onCommit: (args) => void commits.push(args as { rowId: string }),
        }}
      />,
    );

    // Row one, opened from a cell and dirtied.
    await user.dblClick(cellAt(0, 0));
    const firstName = within(bodyRows()[0]!).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.clear(firstName);
    await user.type(firstName, "Annika");

    // Row two, from a cell too. Nothing about row one refuses it, and row one
    // is neither saved nor discarded to make room.
    await user.dblClick(cellAt(1, 0));

    expect(parts("save-row")).toHaveLength(2);
    expect(commits.length).toBe(0);
    expect(firstName).toHaveValue("Annika");
    const secondName = within(bodyRows()[1]!).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.clear(secondName);
    await user.type(secondName, "Erika");

    // Each row saves on its own: row two's ✓ commits row two and leaves row
    // one open with its draft.
    await user.click(
      within(bodyRows()[1]!).getByRole("button", { name: "Save row" }),
    );
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.rowId).toBe("2");
    expect(
      within(bodyRows()[1]!).queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    expect(
      within(bodyRows()[0]!).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Annika");

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Save row" }),
    );
    await waitFor(() => expect(commits.length).toBe(2));
    expect(commits[1]?.rowId).toBe("1");
  });

  it("row mode puts the caret in the cell the gesture named, not on the cell", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid editing={{ mode: "row", onCommit: () => {} }} />);

    // The whole row opens, and Age - the cell double-clicked - holds the
    // caret. The focused-cell ring lands on the same cell, so it has nothing
    // to pull the caret back to.
    await user.dblClick(cellAt(0, 1));
    expect(screen.getByRole("textbox", { name: "Edit Name" })).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Edit Age" }),
    );

    // The pencil names no column, so the row's first editable cell takes it.
    await user.click(within(bodyRows()[1]!).getByRole("button", { name: "Edit row" }));
    expect(document.activeElement).toBe(
      within(bodyRows()[1]!).getByRole("textbox", { name: "Edit Name" }),
    );
    // And opening row two did not move row one's caret out of its editor.
    expect(parts("save-row")).toHaveLength(2);
  });

  it("places the caret from the keyboard's open gestures too", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid editing={{ mode: "row", onCommit: () => {} }} />);

    // Enter on the cell cursor's cell, not the row's first.
    await user.click(cellAt(0, 1));
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Edit Age" }),
    );

    // F2 on a second row, same rule - and the first row stays open.
    await user.click(cellAt(1, 0));
    await user.keyboard("{F2}");
    expect(document.activeElement).toBe(
      within(bodyRows()[1]!).getByRole("textbox", { name: "Edit Name" }),
    );
    expect(parts("save-row")).toHaveLength(2);
  });

  it("places the caret in a custom editor that never asks for focus", async () => {
    const user = userEvent.setup();

    /**
     * A `meta.edit.editor` has no focus prop to honour and no reason to focus
     * itself. The grid places the caret, so this one gets it anyway. No
     * `editor-input` either: the first focusable element inside is the target.
     */
    const BareEditor: TMDataGridEditorComponent = ({ field }) => (
      <input
        aria-label="Bare Age"
        value={typeof field.state.value === "number" ? field.state.value : 0}
        onChange={(event) => field.handleChange(Number(event.target.value))}
      />
    );
    const bareColumns = (() => {
      const helper = createTMDataGridColumnHelper<Employee>();
      return helper.columns([
        helper.accessor("name", { header: "Name" }),
        helper.accessor("age", {
          header: "Age",
          meta: { type: "number", edit: { editor: BareEditor } },
        }),
      ]);
    })();

    function BareGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: bareColumns,
        getRowId: (row) => String(row.id),
        editing: { mode: "row", onCommit: () => {} },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }

    renderWithMantine(<BareGrid />);
    await user.dblClick(cellAt(0, 1));

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Bare Age" }),
    );
  });

  it("row mode keeps the caret when another open row remounts", async () => {
    const user = userEvent.setup();

    /**
     * Row two leaves the row model and comes back - a filter, a page, or the
     * virtualizer scrolling it away, which is the same unmount. Its draft
     * lives outside the DOM, so its editors remount over the same form.
     */
    function RemountingGrid() {
      const [hideSecond, setHideSecond] = useState(false);
      const grid = useTMDataGrid<Employee>({
        // Both identities are stable: `useTMDataGrid` memoizes on the data
        // reference, and a fresh array each render is a render loop.
        data: hideSecond ? firstRowOnly : editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: { mode: "row", onCommit: () => {} },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <>
          <button type="button" onClick={() => setHideSecond((it) => !it)}>
            Toggle row two
          </button>
          <TMDataGrid {...grid}>
            <TMDataGrid.Table<Employee> />
          </TMDataGrid>
        </>
      );
    }

    renderWithMantine(<RemountingGrid />);
    const toggle = screen.getByRole("button", { name: "Toggle row two" });

    // Two rows open, then the caret moved by hand into the first row's Age -
    // the second row is still the one `active` names.
    await user.click(within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }));
    await user.click(within(bodyRows()[1]!).getByRole("button", { name: "Edit row" }));
    const firstAge = within(bodyRows()[0]!).getByRole("textbox", {
      name: "Edit Age",
    });
    await user.click(firstAge);
    expect(document.activeElement).toBe(firstAge);

    // Row two out and back. Its editors remount, and the caret stays put -
    // the row was focused once, when it opened. `fireEvent` rather than
    // `user.click`, which would focus the button: the real trigger is the
    // virtualizer, and it does not touch the focus either.
    fireEvent.click(toggle);
    expect(parts("save-row")).toHaveLength(1);
    fireEvent.click(toggle);
    expect(parts("save-row")).toHaveLength(2);
    expect(document.activeElement).toBe(
      within(bodyRows()[0]!).getByRole("textbox", { name: "Edit Age" }),
    );
  });

  it("row mode cancels the whole row from the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{ mode: "row", onCommit: (args) => void commits.push(args) }}
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
        editing={{
          mode: "row",
          rowValidators: {
            onSubmit: z
              .object({ name: z.string(), age: z.number() })
              .refine((row) => row.age < 100, { message: "Nobody is that old" }),
          },
          onCommit: (args) => void commits.push(args),
        }}
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

  /**
   * A grid with the draft store on: the toolbar's Save and Discard, plus an
   * add button for the entry block - `addRow` has no chrome of its own. The
   * gesture is the other axis, so it is a prop; `"cell"` is what these tests
   * mostly drive, and the mode matrix covers the rest.
   */
  function DraftGrid({
    mode = "cell",
    columns = editColumns,
    onCommit,
    onCommitDrafts,
    onRowAdd,
    onRowDelete,
    newRowDefaults,
    newRowsSticky,
  }: {
    mode?: "cell" | "cellConfirm" | "row";
    columns?: UseTMDataGridOptions<Employee>["columns"];
    onCommit?: (args: unknown) => void;
    onCommitDrafts?: (args: unknown) => void;
    onRowAdd?: (args: unknown) => void;
    onRowDelete?: () => void;
    newRowDefaults?: () => Employee;
    newRowsSticky?: boolean;
  }) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns,
      getRowId: (row) => String(row.id),
      editing: {
        mode,
        draft: true,
        onCommit,
        onCommitDrafts,
        onRowAdd,
        onRowDelete,
        newRowDefaults,
        newRowsSticky,
      },
      selectionMode: "highlight",
    } as UseTMDataGridOptions<Employee>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <button type="button" onClick={() => grid.edit.addRow()}>
            add
          </button>
          <TMDataGrid.DraftActions />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    );
  }

  /** Name through a renderer of its own - what a parked draft renders with. */
  const starColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", {
        header: "Name",
        cell: ({ getValue }) => `*${String(getValue())}*`,
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
  })();

  const entryDefaults = (): Employee => ({ id: 0, name: "", age: 20, note: "" });

  /** Opens an entry row and types a name into it, stopping short of the ✓. */
  async function typeIntoEntryRow(user: UserEvent, name: string) {
    await user.click(screen.getByRole("button", { name: "add" }));
    await user.type(
      within(part("entry-row", { rowId: "__new__1" })).getByRole("textbox", {
        name: "Edit Name",
      }),
      name,
    );
  }

  it("marks a parked draft with data-draft and clears it on save", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid onCommit={() => {}} />);

    // Row attributes carry "true"/"false" rather than being dropped.
    const row = () => part("row", { rowId: "1" });
    expect(row()).toHaveAttribute("data-draft", "false");

    await user.dblClick(cellAt(0, 0));
    await user.clear(screen.getByRole("textbox", { name: "Edit Name" }));
    await user.type(screen.getByRole("textbox", { name: "Edit Name" }), "Annika");
    // Leaving the cell decides the row under `"cell"`: dirty, and parked.
    await user.click(cellAt(1, 1));
    expect(row()).toHaveAttribute("data-dirty", "true");
    expect(row()).toHaveAttribute("data-draft", "true");

    await user.click(screen.getByRole("button", { name: "Save 1 row" }));
    await waitFor(() =>
      expect(row()).toHaveAttribute("data-draft", "false"),
    );
  });

  it("parks drafts on Enter and saves them through DraftActions", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid onCommit={(args) => void commits.push(args)} />,
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

  it("DraftActions' Discard drops every draft", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid onCommit={(args) => void commits.push(args)} />,
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

  it("shows a parked draft through the column's own renderer, marked in the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        columns={starColumns}
        onCommit={(args) => void commits.push(args)}
        onRowDelete={() => {}}
      />,
    );

    // Clean: `data` through the renderer, and the lane offers the trash.
    expect(cellAt(0, 0)).toHaveTextContent("*Anna*");
    expect(queryPart("delete-row", { rowId: "1" })).toBeInTheDocument();

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Annika");
    await user.keyboard("{Enter}");

    // The draft renders through the same `cell` the committed value does.
    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).toHaveTextContent("*Annika*");
    expect(bodyRows()[0]).toHaveAttribute("data-dirty", "true");

    // The lane is the marker and the revert - no per-row save, and the trash
    // stands down until the row is clean again.
    const marker = part("row-state", { rowId: "1" });
    expect(marker).toHaveAttribute("data-state", "edited");
    expect(marker).toHaveAttribute("aria-label", "Edited row");
    expect(part("revert-row", { rowId: "1" })).toHaveAttribute(
      "aria-label",
      "Revert changes",
    );
    expect(queryPart("save-row", { rowId: "1" })).not.toBeInTheDocument();
    expect(queryPart("cancel-row", { rowId: "1" })).not.toBeInTheDocument();
    expect(queryPart("delete-row", { rowId: "1" })).not.toBeInTheDocument();
  });

  it("reverts one row's draft from the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        columns={starColumns}
        onCommit={(args) => void commits.push(args)}
        onRowDelete={() => {}}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "Annika");
    await user.keyboard("{Enter}");
    expect(cellAt(0, 0)).toHaveTextContent("*Annika*");

    await user.click(part("revert-row", { rowId: "1" }));

    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).toHaveTextContent("*Anna*");
    expect(bodyRows()[0]).toHaveAttribute("data-dirty", "false");
    expect(queryPart("row-state", { rowId: "1" })).not.toBeInTheDocument();
    expect(queryPart("delete-row", { rowId: "1" })).toBeInTheDocument();
  });

  it("confirms an entry row into a value row in the flow block", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        onRowAdd={(args) => void adds.push(args)}
        newRowDefaults={entryDefaults}
      />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    // Entered, awaiting Save all: a value row, still in the entry block's
    // markup but out of the sticky part of it.
    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).toHaveAttribute("data-committed", "true");
    expect(entryRow).toHaveAttribute("data-new", "true");
    expect(within(entryRow).queryByRole("textbox")).not.toBeInTheDocument();
    expect(entryRow).toHaveTextContent("Ny Person");
    expect(adds.length).toBe(0);
    expect(part("row-state", { rowId: "__new__1" })).toHaveAttribute(
      "data-state",
      "new",
    );
    expect(entryRow.closest("[data-dg-entry-flow-block]")).not.toBeNull();
    expect(entryRow.closest("[data-dg-entry-block]")).toBeNull();
  });

  it("confirms an entry row on Enter inside its editor", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        onRowAdd={(args) => void adds.push(args)}
        newRowDefaults={entryDefaults}
      />,
    );

    // Enter in the entry block confirms the entry - it does not park a cell
    // the way Enter in a body row does.
    await typeIntoEntryRow(user, "Ny Person");
    await user.keyboard("{Enter}");

    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).toHaveAttribute("data-committed", "true");
    expect(within(entryRow).queryByRole("textbox")).not.toBeInTheDocument();
    expect(entryRow).toHaveTextContent("Ny Person");
    expect(adds.length).toBe(0);
  });

  it("keeps a confirmed entry row sticky when newRowsSticky is set", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DraftGrid newRowDefaults={entryDefaults} newRowsSticky />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).toHaveAttribute("data-committed", "true");
    expect(entryRow.closest("[data-dg-entry-block]")).not.toBeNull();
    expect(entryRow.closest("[data-dg-entry-flow-block]")).toBeNull();
  });

  it("re-opens a confirmed entry row from the lane's pencil", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid newRowDefaults={entryDefaults} />);

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    await user.click(part("edit-row", { rowId: "__new__1" }));

    // The editors come back over the same form, draft and all.
    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).toHaveAttribute("data-committed", "false");
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Ny Person");
    expect(queryPart("row-state", { rowId: "__new__1" })).not.toBeInTheDocument();
  });

  it("discards a confirmed entry row from the lane", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid newRowDefaults={entryDefaults} />);

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    await user.click(part("discard-new-row", { rowId: "__new__1" }));

    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
  });

  it("adds rows through the entry block and reports them with edits and deletions in one save", async () => {
    const user = userEvent.setup();
    const saves: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          draft: true,
          onCommitDrafts: (args) => void saves.push(args),
          newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              add
            </button>
            <TMDataGrid.DraftActions />
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
    // OK the entry: only committed rows are part of a save.
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));
    expect(part("entry-row", { rowId: "__new__1" })).toHaveAttribute(
      "data-committed",
      "true",
    );

    // Mark row 2 deleted through the lane; it renders struck through.
    await user.click(
      within(bodyRows()[1]!).getByRole("button", { name: "Delete row" }),
    );
    expect(bodyRows()[1]).toHaveAttribute("data-deleted", "true");
    expect(
      within(bodyRows()[1]!).getByRole("button", { name: "Restore row" }),
    ).toBeInTheDocument();
    expect(part("row-state", { rowId: "2" })).toHaveAttribute(
      "data-state",
      "deleted",
    );

    // Save: the payload carries the add and the deletion together.
    await user.click(screen.getByRole("button", { name: "Save 2 rows" }));
    await waitFor(() => expect(saves.length).toBe(1));
    const saved = saves[0] as {
      rows: unknown[];
      added: Array<{ value: { name: string } }>;
      deleted: string[];
    };
    expect(saved.rows).toEqual([]);
    expect(saved.added.map((add) => add.value.name)).toEqual(["Ny Person"]);
    expect(saved.deleted).toEqual(["2"]);
    // The entry block is gone and the mark is cleared.
    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
    expect(bodyRows()[1]).not.toHaveAttribute("data-deleted", "true");
  });

  it("leaves an entry row that was never OK'd out of the save, still open", async () => {
    const user = userEvent.setup();
    const saves: Array<{ added: unknown[]; deleted: string[] }> = [];
    renderWithMantine(
      <DraftGrid
        newRowDefaults={entryDefaults}
        onCommitDrafts={(args) => void saves.push(args as never)}
      />,
    );

    // One entry row typed into but not OK'd, and one deletion mark, which is
    // a decision the moment it is made.
    await user.click(screen.getByRole("button", { name: "add" }));
    await user.type(
      within(part("entry-row", { rowId: "__new__1" })).getByRole("textbox", {
        name: "Edit Name",
      }),
      "Halvfärdig",
    );
    await user.click(
      within(bodyRows()[1]!).getByRole("button", { name: "Delete row" }),
    );

    // Save counts the deletion only, and says the row is still being edited.
    expect(part("open-rows-note")).toHaveTextContent("1 row still being edited");
    await user.click(screen.getByRole("button", { name: "Save 1 row" }));
    await waitFor(() => expect(saves.length).toBe(1));
    expect(saves[0]?.added).toEqual([]);
    expect(saves[0]?.deleted).toEqual(["2"]);

    // The undecided row is untouched: still open, still holding what was
    // typed, ready to be finished.
    expect(part("entry-row", { rowId: "__new__1" })).toHaveAttribute(
      "data-committed",
      "false",
    );
    expect(
      within(part("entry-row", { rowId: "__new__1" })).getByRole("textbox", {
        name: "Edit Name",
      }),
    ).toHaveValue("Halvfärdig");
  });

  it("adds immediately from the entry row's check outside draft", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onRowAdd: (args) => void adds.push(args),
          // The lane needs a reason to exist outside row mode.
          onRowDelete: () => {},
          newRowDefaults: () => ({ id: 0, name: "Ny", age: 20, note: "" }),
        },
        selectionMode: "highlight",
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

  it("seeds the entry row's editors from addRow's argument", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onRowAdd: (args) => void adds.push(args),
          onRowDelete: () => {},
          newRowDefaults: () => ({ id: 0, name: "Ny", age: 20, note: "" }),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button
              type="button"
              onClick={() => grid.edit.addRow({ name: "Kopia", age: 44 })}
            >
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
    // The editors open on the argument, not on newRowDefaults' "Ny".
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Kopia");
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Age" }),
    ).toHaveValue("44");

    await user.click(within(entryRow).getByRole("button", { name: "Add row" }));

    await waitFor(() => expect(adds.length).toBe(1));
    // What the argument left out still comes from newRowDefaults.
    expect(adds[0]).toMatchObject({
      value: { name: "Kopia", age: 44, note: "" },
    });
  });

  it("clears the cell on Delete and commits the empty value", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    // Age carries no rule, so clearing it commits the type's empty value.
    await user.click(cellAt(1, 1));
    await user.keyboard("{Delete}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: unknown[] };
    expect(commit.changes).toEqual([
      { columnId: "age", field: "age", previous: 41, next: null },
    ]);
  });

  it("refuses Delete on a cell whose column rule rejects the empty value", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    // Name is `min(2)`. Delete opens no editor, so the column's validator
    // only runs because the engine runs it - the commit has to be refused
    // rather than writing "" past the rule.
    await user.click(cellAt(1, 0));
    await user.keyboard("{Delete}");

    await waitFor(() =>
      expect(cellAt(1, 0)).toHaveAttribute("data-invalid", "true"),
    );
    expect(commits).toEqual([]);
  });

  it("puts the caret in a new entry row's first editable cell", async () => {
    const user = userEvent.setup();
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
        },
        selectionMode: "highlight",
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
    expect(document.activeElement).toBe(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    );
  });

  it("puts the caret in an entry row whose first editor is a custom one", async () => {
    const user = userEvent.setup();

    /** Focuses nothing itself, exactly like the body-row case above. */
    const BareEditor: TMDataGridEditorComponent = ({ field }) => (
      <input
        aria-label="Bare Name"
        value={typeof field.state.value === "string" ? field.state.value : ""}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    );
    const bareColumns = (() => {
      const helper = createTMDataGridColumnHelper<Employee>();
      return helper.columns([
        helper.accessor("name", {
          header: "Name",
          meta: { edit: { editor: BareEditor } },
        }),
        helper.accessor("age", { header: "Age", meta: { type: "number" } }),
      ]);
    })();

    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: bareColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
        },
        selectionMode: "highlight",
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
    expect(document.activeElement).toBe(
      within(entryRow).getByRole("textbox", { name: "Bare Name" }),
    );
  });
});

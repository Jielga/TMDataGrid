import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MantineWrapper } from "../../test/gridHarness";
import {
  clearedValueForType,
  getEditFieldName,
  normalizeFieldValidate,
  type TMDataGridEditCommitArgs,
} from "./editEngine";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridEditingOptions,
  type TMDataGridRowData,
  type UseTMDataGridOptions,
} from "../index";

type Person = {
  id: number;
  name: string;
  age: number;
  address: { city: string };
};

const helper = createTMDataGridColumnHelper<Person>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", { header: "Age", meta: { type: "number" } }),
  // A nested path: Form addresses fields by dot-path, so this edits
  // values.address.city with no extra machinery.
  helper.accessor("address.city", { header: "City", id: "city" }),
  // No accessorKey and no editField - not editable.
  helper.accessor((row) => `${row.name} (${String(row.age)})`, {
    id: "display",
    header: "Display",
  }),
  helper.accessor("name", {
    id: "readonlyName",
    header: "Locked",
    meta: { edit: { enabled: false } },
  }),
]);

const people: Array<Person> = [
  { id: 1, name: "Anna", age: 34, address: { city: "Stockholm" } },
  { id: 2, name: "Erik", age: 41, address: { city: "Malmö" } },
];

function renderEditGrid(
  editing: Partial<TMDataGridEditingOptions<Person>> = {},
) {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Person>({
        data: people,
        columns,
        getRowId: (row) => String(row.id),
        editing: { mode: "cell", ...editing },
      } as UseTMDataGridOptions<Person>),
    { wrapper: MantineWrapper },
  );
  return result;
}

describe("getEditFieldName", () => {
  it("prefers meta.edit.field, falls back to accessorKey, refuses accessorFn", () => {
    expect(
      getEditFieldName({ columnDef: { meta: { edit: { field: "custom.path" } } } }),
    ).toBe("custom.path");
    expect(
      getEditFieldName({
        columnDef: { accessorKey: "address.city" } as never,
      }),
    ).toBe("address.city");
    expect(getEditFieldName({ columnDef: {} })).toBe(null);
  });
});

describe("normalizeFieldValidate", () => {
  it("lifts a bare schema or function into onChange", () => {
    const schema = z.string();
    expect(normalizeFieldValidate(schema)).toEqual({ onChange: schema });
    const fn = () => undefined;
    expect(normalizeFieldValidate(fn)).toEqual({ onChange: fn });
    expect(normalizeFieldValidate({ onBlur: schema })).toEqual({
      onBlur: schema,
    });
    expect(normalizeFieldValidate(undefined)).toBe(undefined);
  });
});

describe("clearedValueForType", () => {
  it("empties by type", () => {
    expect(clearedValueForType("string")).toBe("");
    expect(clearedValueForType("multiSelect")).toEqual([]);
    expect(clearedValueForType("boolean")).toBe(false);
    expect(clearedValueForType("number")).toBe(null);
    expect(clearedValueForType("date")).toBe(null);
  });
});

describe("edit engine", () => {
  it("opens a form on begin, keyed by row id", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });

    expect(edit.state.active).toEqual({ rowId: "1", columnId: "name" });
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.getForm("1")?.state.values).toEqual(people[0]);
  });

  it("refuses to open on a column that cannot edit", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "display" });
    edit.begin({ rowId: "1", columnId: "readonlyName" });

    expect(edit.state.active).toBe(null);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("projects dirty fields as values diverge, and keeps the draft with no editor mounted", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    edit.getForm("1")?.setFieldValue("name", "Annika");
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);

    // The virtualization claim, tested directly: closing the editor (a
    // scroll-away unmounts it) leaves the form and its draft in place.
    edit.deactivate();
    expect(edit.state.active).toBe(null);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
  });

  it("projects the row as drafted, so a cell can render the draft", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    expect(edit.state.rows["1"]?.values).toEqual(people[0]);

    edit.getForm("1")?.setFieldValue("name", "Annika");

    expect(edit.state.rows["1"]?.values["name"]).toBe("Annika");
    // The form's own values object, which is what makes the projection
    // reference-stable across meta-only form events.
    expect(edit.state.rows["1"]?.values).toBe(edit.getForm("1")?.state.values);
  });

  it("commits through onCommit with the per-field diff, then drops the form", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "city" });

    edit.getForm("1")?.setFieldValue("address.city", "Uppsala");
    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.rowId).toBe("1");
    expect(args.source).toBe("cell");
    expect(args.original).toEqual(people[0]);
    expect(args.value.address.city).toBe("Uppsala");
    expect(args.changes).toEqual([
      {
        columnId: "city",
        field: "address.city",
        previous: "Stockholm",
        next: "Uppsala",
      },
    ]);
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.active).toBe(null);
  });

  it("drops a pristine form on commit without calling the consumer", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("keeps the form open when the consumer rejects, with the error on the row", async () => {
    const grid = renderEditGrid({
      onCommit: () => Promise.reject(new Error("server said no")),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    // The draft is intact - a slow or failing save never flickers back.
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("blocks the commit on a real Zod row schema, pathed issues onto fields", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      onCommit,
      rowValidators: {
        onSubmit: z.object({
          name: z.string().min(2, "Too short"),
          age: z.number(),
        }),
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "A");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");

    // Fixing the value lets the same commit through.
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("commits the row being left when cell mode begins on another row", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    edit.begin({ rowId: "2", columnId: "name" });
    // begin's implicit commit is async; give it a microtask.
    await vi.waitFor(() => {
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(edit.state.openRowIds).toEqual(["2"]);
      expect(edit.state.active).toEqual({ rowId: "2", columnId: "name" });
    });
  });

  it("accumulates drafts across rows under cellConfirm", () => {
    const grid = renderEditGrid({ mode: "cellConfirm" });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
  });

  it("row mode opens a second row alongside a dirty first one", () => {
    const grid = renderEditGrid({ mode: "row" });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: null });
    expect(edit.state.active).toEqual({ rowId: "1", columnId: null });

    // A dirty row is not a reason to refuse the next one, and not a reason to
    // discard it either: each row's save is its own.
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: null });

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.active).toEqual({ rowId: "2", columnId: null });
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("row mode commits and cancels one open row without touching the others", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", onCommit });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: null });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: null });
    edit.getForm("2")?.setFieldValue("name", "Erik B");
    expect(edit.state.openRowIds).toEqual(["1", "2"]);

    // Row 2's Save is row 2's alone: one commit, and row 1's draft intact.
    await expect(edit.commit("2")).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const committed = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(committed.rowId).toBe("2");
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");

    // And row 1's Cancel drops only row 1.
    edit.cancel("1");
    expect(edit.state.openRowIds).toEqual([]);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("the draft store parks a commit: validated, kept, and no consumer call", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(true);

    // Nothing reaches the consumer until submitAll; the draft stays open and
    // dirty, and the editor it was made in closes.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
    expect(edit.state.active).toBe(null);
  });

  it("a parked commit still validates, and a failing one keeps its errors", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit,
      rowValidators: {
        onSubmit: z.object({
          name: z.string().min(2, "Too short"),
          age: z.number(),
        }),
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "A");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");
  });

  it("drops a pristine row under draft too, without a consumer call", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("every mode but draft reports a commit to the consumer", async () => {
    // The regression guard for the park: parking is draft's policy alone.
    for (const mode of ["cell", "cellConfirm", "row"] as const) {
      const onCommit = vi.fn();
      const grid = renderEditGrid({ mode, onCommit });
      const { edit } = grid.current;
      edit.begin({ rowId: "1", columnId: "name" });
      edit.getForm("1")?.setFieldValue("name", "Annika");

      await expect(edit.commit("1")).resolves.toBe(true);

      expect(onCommit, mode).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]?.[0], mode).toMatchObject({ source: mode });
      expect(edit.state.openRowIds, mode).toEqual([]);
    }
  });

  it("submitAll commits every dirty row through the per-row loop", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");

    await expect(edit.submitAll()).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("submitAll with onCommitDrafts makes one consumer call for the lot", async () => {
    const onCommit = vi.fn();
    const onCommitDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit,
      onCommitDrafts,
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "age" });
    edit.getForm("2")?.setFieldValue("age", 42);

    await expect(edit.submitAll()).resolves.toBe(true);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCommitDrafts).toHaveBeenCalledTimes(1);
    const { rows: draftRows } = onCommitDrafts.mock.calls[0]?.[0] as {
      rows: Array<TMDataGridEditCommitArgs<Person>>;
    };
    expect(draftRows.map((row) => row.rowId).sort()).toEqual(["1", "2"]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("a rejected save keeps every draft", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommitDrafts: () => Promise.reject(new Error("no")),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");

    await expect(edit.submitAll()).resolves.toBe(false);

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("addRow opens an entry form and commit adds it through onRowAdd", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "",
        age: 18,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;

    const tempId = edit.addRow();
    expect(edit.state.newRows).toEqual([{ tempId, committed: false }]);
    expect(edit.getForm(tempId)?.state.values["age"]).toBe(18);

    edit.getForm(tempId)?.setFieldValue("name", "Ny Person");
    await expect(edit.commit(tempId)).resolves.toBe(true);

    expect(onRowAdd).toHaveBeenCalledTimes(1);
    const args = onRowAdd.mock.calls[0]?.[0] as {
      tempId: string;
      value: Person;
    };
    expect(args.tempId).toBe(tempId);
    expect(args.value.name).toBe("Ny Person");
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("addRow(values) seeds the entry row over newRowDefaults", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "",
        age: 18,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;

    const tempId = edit.addRow({ name: "Ny Person", age: 42 });

    // The argument wins per key; what it leaves out keeps the default.
    const values = edit.getForm(tempId)?.state.values;
    expect(values?.["name"]).toBe("Ny Person");
    expect(values?.["age"]).toBe(42);
    expect(values?.["address"]).toEqual({ city: "Lund" });

    await expect(edit.commit(tempId)).resolves.toBe(true);

    const args = onRowAdd.mock.calls[0]?.[0] as { value: Person };
    expect(args.value.name).toBe("Ny Person");
    expect(args.value.age).toBe(42);
  });

  it("addRow(values) works with no newRowDefaults and leaves the next row blank", () => {
    const grid = renderEditGrid({ onRowAdd: vi.fn() });
    const { edit } = grid.current;

    const seeded = edit.addRow({ name: "Seedad" });
    expect(edit.getForm(seeded)?.state.values["name"]).toBe("Seedad");

    // Per call, not a lasting default.
    const blank = edit.addRow();
    expect(edit.getForm(blank)?.state.values["name"]).toBeUndefined();
    expect(edit.state.newRows).toEqual([
      { tempId: seeded, committed: false },
      { tempId: blank, committed: false },
    ]);
  });

  it("draft mode confirms an entry row instead of adding it, and re-opens it", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny Person",
        age: 18,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();

    await expect(edit.commit(tempId)).resolves.toBe(true);

    // Entered, awaiting Save all: the form stays, the entry is marked
    // confirmed, and nothing was added anywhere.
    expect(onRowAdd).not.toHaveBeenCalled();
    expect(edit.state.newRows).toEqual([{ tempId, committed: true }]);
    expect(edit.state.openRowIds).toEqual([tempId]);

    // The re-edit gesture: begin re-arms the entry's editors.
    edit.begin({ rowId: tempId, columnId: "name" });

    expect(edit.state.newRows).toEqual([{ tempId, committed: false }]);
    expect(edit.state.active).toEqual({ rowId: tempId, columnId: "name" });
  });

  it("deleteRow reports immediately outside draft, toggles the mark under it", () => {
    const onRowDelete = vi.fn();
    const immediate = renderEditGrid({ onRowDelete });
    immediate.current.edit.deleteRow("1");
    expect(onRowDelete).toHaveBeenCalledTimes(1);
    expect(onRowDelete.mock.calls[0]?.[0]).toMatchObject({ rowId: "1" });

    const draft = renderEditGrid({ mode: "row", draft: true, onRowDelete: vi.fn() });
    draft.current.edit.deleteRow("1");
    expect(draft.current.edit.state.deletedRowIds).toEqual(["1"]);
    draft.current.edit.deleteRow("1");
    expect(draft.current.edit.state.deletedRowIds).toEqual([]);
  });

  it("deleteRow on an uncommitted entry row just discards the entry", () => {
    const onRowDelete = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onRowDelete });
    const { edit } = grid.current;
    const tempId = edit.addRow();

    edit.deleteRow(tempId);

    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
    expect(onRowDelete).not.toHaveBeenCalled();
  });

  it("submitAll's draft payload carries rows, added and deleted together", async () => {
    const onCommitDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommitDrafts,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    const tempId = edit.addRow();
    edit.deleteRow("2");

    await expect(edit.submitAll()).resolves.toBe(true);

    expect(onCommitDrafts).toHaveBeenCalledTimes(1);
    const args = onCommitDrafts.mock.calls[0]?.[0] as {
      rows: Array<{ rowId: string }>;
      added: Array<{ tempId: string; value: Person }>;
      deleted: Array<string>;
    };
    expect(args.rows.map((row) => row.rowId)).toEqual(["1"]);
    expect(args.added.map((add) => add.tempId)).toEqual([tempId]);
    expect(args.deleted).toEqual(["2"]);
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
  });

  it("submitAll adds a confirmed entry row through onRowAdd on the per-row path", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);
    expect(onRowAdd).not.toHaveBeenCalled();

    await expect(edit.submitAll()).resolves.toBe(true);

    // Confirming is not adding - the add happens here, at Save all.
    expect(onRowAdd).toHaveBeenCalledTimes(1);
    expect(onRowAdd.mock.calls[0]?.[0]).toMatchObject({
      tempId,
      value: { name: "Ny" },
    });
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("submitAll carries a confirmed entry row in the drafts payload's added", async () => {
    const onCommitDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommitDrafts,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);

    await expect(edit.submitAll()).resolves.toBe(true);

    expect(onCommitDrafts).toHaveBeenCalledTimes(1);
    const args = onCommitDrafts.mock.calls[0]?.[0] as {
      added: Array<{ tempId: string; value: Person }>;
    };
    expect(args.added.map((add) => add.tempId)).toEqual([tempId]);
    expect(args.added[0]?.value.name).toBe("Ny");
    expect(edit.state.newRows).toEqual([]);
  });

  it("keeps a confirmed entry row that no longer validates at submitAll", async () => {
    const onCommitDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommitDrafts,
      rowValidators: {
        onSubmit: z.object({
          name: z.string().min(2, "Too short"),
          age: z.number(),
        }),
      },
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);
    // The same form the entry's editors write through - a consumer holding it
    // in a drawer writes here too, and a confirmed row is not frozen.
    edit.getForm(tempId)?.setFieldValue("name", "N");

    await expect(edit.submitAll()).resolves.toBe(false);

    // Nothing valid to report, and the entry is still there to be fixed.
    expect(onCommitDrafts).not.toHaveBeenCalled();
    expect(edit.state.newRows).toEqual([{ tempId, committed: true }]);
    expect(edit.state.rows[tempId]?.errorFields).toContain("name");
  });

  it("cancel drops the draft without a consumer call", () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    edit.cancel("1");

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.rows["1"]).toBe(undefined);
  });

  it("clearCell writes the type's empty value and commits it", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.clearCell("1", "age")).resolves.toBe(true);

    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes).toEqual([
      { columnId: "age", field: "age", previous: 34, next: null },
    ]);
  });

  it("clearCell parks the cleared value under draft", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;

    await expect(edit.clearCell("1", "age")).resolves.toBe(true);

    // Delete writes the empty value and parks it like any other edit.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["age"]);
    expect(edit.getForm("1")?.state.values["age"]).toBe(null);
  });

  it("cancelAll drops every draft, mark and entry in one motion", () => {
    const onCommit = vi.fn();
    const onCommitDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommitDrafts,
      onCommit,
      onRowDelete: vi.fn(),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.deleteRow("2");
    edit.addRow();

    edit.cancelAll();

    // Back to a clean slate - the discard-all button's whole promise.
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
    expect(edit.state.active).toBe(null);
    expect(edit.getForm("1")).toBe(undefined);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCommitDrafts).not.toHaveBeenCalled();
  });

  it("canDeleteRows follows the handlers the mode can deliver to", () => {
    // Immediate modes need onRowDelete - there is nowhere else to report.
    expect(renderEditGrid().current.edit.canDeleteRows()).toBe(false);
    expect(
      renderEditGrid({ onRowDelete: vi.fn() }).current.edit.canDeleteRows(),
    ).toBe(true);

    // Draft can also deliver deletions through the drafts commit.
    expect(
      renderEditGrid({ mode: "row", draft: true }).current.edit.canDeleteRows(),
    ).toBe(false);
    expect(
      renderEditGrid({ mode: "row", draft: true, onCommitDrafts: vi.fn() })
        .current.edit.canDeleteRows(),
    ).toBe(true);
  });

  it("gates per-row editability through isRowEditable and meta.edit.enabled", () => {
    const grid = renderEditGrid({
      isRowEditable: (row) => row.original.id !== 2,
    });
    const { edit } = grid.current;
    // The same erasure the context provider performs - canEditCell is chrome.
    const table = grid.current.table as unknown as TMDataGridApi<TMDataGridRowData>["table"];

    edit.begin({ rowId: "2", columnId: "name" });
    expect(edit.state.openRowIds).toEqual([]);

    const nameColumn = table.getColumn("name");
    const lockedColumn = table.getColumn("readonlyName");
    if (!nameColumn || !lockedColumn) throw new Error("columns missing");
    expect(edit.canEditCell(table.getRow("1"), nameColumn)).toBe(true);
    expect(edit.canEditCell(table.getRow("2"), nameColumn)).toBe(false);
    expect(edit.canEditCell(table.getRow("1"), lockedColumn)).toBe(false);
  });
});

describe("the draft store", () => {
  /** A validated column, to prove commits validate without mounted editors. */
  const validatedColumns = helper.columns([
    helper.accessor("name", {
      header: "Name",
      meta: { edit: { validate: z.string().min(2, "Too short") } },
    }),
    helper.accessor("age", { header: "Age", meta: { type: "number" } }),
  ]);

  function renderValidatedGrid(
    editing: Partial<TMDataGridEditingOptions<Person>> = {},
  ) {
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: people,
          columns: validatedColumns,
          getRowId: (row) => String(row.id),
          editing: { mode: "row", draft: true, ...editing },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    return result;
  }

  it("commit moves an existing row in, saveDrafts sends only what is in", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    // Row 1 is OK'd, row 2 only typed into - the difference the store keeps.
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna Committed");
    await expect(edit.commit("1")).resolves.toBe(true);
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik Open");

    expect(edit.state.committedRowIds).toEqual(["1"]);

    await expect(edit.saveDrafts()).resolves.toBe(true);

    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      rows: Array<{ rowId: string }>;
    };
    expect(args.rows.map((row) => row.rowId)).toEqual(["1"]);
    // The open row is untouched by the save: still open, still holding it.
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.openRowIds).toEqual(["2"]);
    expect(edit.getForm("2")?.state.values["name"]).toBe("Erik Open");
  });

  it("names the payload buckets updated / created / deleted", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    edit.addRow({ name: "Ny", age: 30 });
    const tempId = edit.state.newRows[0]!.tempId;
    await edit.commit(tempId);
    edit.deleteRow("2");

    await edit.saveDrafts();

    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
      created: Array<{ tempId: string }>;
      deleted: Array<string>;
      rows: Array<{ rowId: string }>;
      added: Array<{ tempId: string }>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
    expect(args.created.map((row) => row.tempId)).toEqual([tempId]);
    expect(args.deleted).toEqual(["2"]);
    // The pre-2.0 names carry the same arrays until they are removed.
    expect(args.rows).toBe(args.updated);
    expect(args.added).toBe(args.created);
  });

  it("keeps the drafts a result reports as failed", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: () => ({ updated: { "2": false } }),
    });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", `Namn ${rowId}`);
      await edit.commit(rowId);
    }
    expect(edit.state.committedRowIds).toEqual(["1", "2"]);

    await expect(edit.saveDrafts()).resolves.toBe(false);

    // Row 1 saved and is gone; row 2 stays committed, values intact, so the
    // next save retries it.
    expect(edit.state.committedRowIds).toEqual(["2"]);
    expect(edit.getForm("1")).toBeUndefined();
    expect(edit.getForm("2")?.state.values["name"]).toBe("Namn 2");
  });

  it("keeps a failed entry row and a failed deletion mark", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: ({ created, deleted }) => ({
        created: { [created[0]!.tempId]: false },
        deleted: { [deleted[0]!]: false },
      }),
    });
    const { edit } = grid.current;

    edit.addRow({ name: "Ny", age: 30 });
    const tempId = edit.state.newRows[0]!.tempId;
    await edit.commit(tempId);
    edit.deleteRow("2");

    await expect(edit.saveDrafts()).resolves.toBe(false);

    expect(edit.state.newRows).toEqual([{ tempId, committed: true }]);
    expect(edit.state.deletedRowIds).toEqual(["2"]);
  });

  it("saves the whole bucket a result answers with a boolean", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: () => ({ updated: false }),
    });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", `Namn ${rowId}`);
      await edit.commit(rowId);
    }

    await expect(edit.saveDrafts()).resolves.toBe(false);
    expect(edit.state.committedRowIds).toEqual(["1", "2"]);
  });

  it("saves everything a result does not name", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      // An empty result says nothing failed.
      onSaveDrafts: () => ({}),
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    edit.deleteRow("2");

    await expect(edit.saveDrafts()).resolves.toBe(true);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
  });

  it("a save during a save joins it instead of sending the payload twice", async () => {
    let resolveSave: () => void = () => {};
    const onSaveDrafts = vi.fn(
      () => new Promise<void>((resolve) => (resolveSave = resolve)),
    );
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");

    const first = edit.saveDrafts();
    const second = edit.saveDrafts();
    // The collector phase runs before the consumer call; release the save
    // only once it is actually awaiting.
    await vi.waitFor(() => expect(onSaveDrafts).toHaveBeenCalled());
    resolveSave();

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    expect(edit.state.committedRowIds).toEqual([]);
  });

  it("re-opening a committed row takes it back out of the store", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    expect(edit.state.committedRowIds).toEqual(["1"]);

    // Editing it again makes it undecided, so a save must not send it.
    edit.begin({ rowId: "1", columnId: "name" });
    expect(edit.state.committedRowIds).toEqual([]);

    await expect(edit.saveDrafts()).resolves.toBe(true);
    expect(onSaveDrafts).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
  });

  it("commitAll submits the open rows, holding back the ones that fail", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderValidatedGrid({ onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "E"); // fails min(2)

    await expect(edit.commitAll()).resolves.toBe(false);
    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.rows["2"]?.errorFields).toContain("name");

    await edit.saveDrafts();
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      rows: Array<{ rowId: string }>;
    };
    expect(args.rows.map((row) => row.rowId)).toEqual(["1"]);
  });

  it("validates a commit against the column rules with no editor mounted", async () => {
    const grid = renderValidatedGrid({ onSaveDrafts: vi.fn() });
    const { edit } = grid.current;

    // No editors are mounted here: the rule lives on the column, so the
    // engine has to be the one running it.
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "A");
    await expect(edit.commit("1")).resolves.toBe(false);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");

    // And the error clears once the value is fixed.
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(edit.state.committedRowIds).toEqual(["1"]);
  });

  it("addRows opens a batch, and reports every row as open", async () => {
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts: vi.fn() });
    const { edit } = grid.current;

    const result = await edit.addRows([
      { name: "Ett", age: 1 },
      { name: "Tva", age: 2 },
    ]);

    expect(result.committed).toEqual([]);
    expect(result.open).toHaveLength(2);
    expect(edit.state.newRows.every((newRow) => !newRow.committed)).toBe(true);
    expect(edit.getForm(result.open[0]!)?.state.values["name"]).toBe("Ett");
  });

  it("addRows with commit lands the valid rows and leaves the rest open", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderValidatedGrid({ onSaveDrafts });
    const { edit } = grid.current;

    // The import case: raw data in, validated, only the bad rows left open.
    const result = await edit.addRows(
      [
        { name: "Giltig", age: 1 },
        { name: "X", age: 2 },
        { name: "Ocksa giltig", age: 3 },
      ],
      { commit: true },
    );

    expect(result.committed).toHaveLength(2);
    expect(result.open).toHaveLength(1);
    expect(edit.getForm(result.open[0]!)?.state.values["name"]).toBe("X");
    expect(edit.state.rows[result.open[0]!]?.errorFields).toContain("name");

    await edit.saveDrafts();
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      added: Array<{ value: Person }>;
    };
    expect(args.added.map((add) => add.value.name)).toEqual([
      "Giltig",
      "Ocksa giltig",
    ]);
    // The rejected row is still there to be fixed.
    expect(edit.state.newRows).toHaveLength(1);
  });

  it("addRows with commit adds through onRowAdd under the immediate modes", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({ mode: "cell", onRowAdd });
    const { edit } = grid.current;

    // No draft store to park in, so a commit is the add - one call per row.
    const result = await edit.addRows(
      [
        { name: "Ett", age: 1 },
        { name: "Tva", age: 2 },
      ],
      { commit: true },
    );

    expect(result.committed).toHaveLength(2);
    expect(onRowAdd).toHaveBeenCalledTimes(2);
    expect(edit.state.newRows).toEqual([]);
  });

  it("saveDrafts sends nothing while the store is empty", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Bara oppen");

    await expect(edit.saveDrafts()).resolves.toBe(true);
    expect(onSaveDrafts).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
  });

  it("the deprecated submitAll is commitAll then saveDrafts", async () => {
    const onCommitDrafts = vi.fn();
    // The deprecated callback name still reaches the engine, too.
    const grid = renderEditGrid({ mode: "row", draft: true, onCommitDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");

    // Never committed, yet submitAll saves it - that is what it always did.
    await expect(edit.submitAll()).resolves.toBe(true);
    const args = onCommitDrafts.mock.calls[0]?.[0] as {
      rows: Array<{ rowId: string }>;
    };
    expect(args.rows.map((row) => row.rowId)).toEqual(["1"]);
  });
});

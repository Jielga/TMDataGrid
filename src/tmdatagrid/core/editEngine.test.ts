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
  // No accessorKey and no editField — not editable.
  helper.accessor((row) => `${row.name} (${String(row.age)})`, {
    id: "display",
    header: "Display",
  }),
  helper.accessor("name", {
    id: "readonlyName",
    header: "Locked",
    meta: { editable: false },
  }),
]);

const people: Array<Person> = [
  { id: 1, name: "Anna", age: 34, address: { city: "Stockholm" } },
  { id: 2, name: "Erik", age: 41, address: { city: "Malmö" } },
];

function renderEditGrid(
  options: Partial<UseTMDataGridOptions<Person>> = {},
) {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Person>({
        data: people,
        columns,
        getRowId: (row) => String(row.id),
        editMode: "cell",
        ...options,
      } as UseTMDataGridOptions<Person>),
    { wrapper: MantineWrapper },
  );
  return result;
}

describe("getEditFieldName", () => {
  it("prefers meta.editField, falls back to accessorKey, refuses accessorFn", () => {
    expect(
      getEditFieldName({ columnDef: { meta: { editField: "custom.path" } } }),
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

  it("commits through onEditCommit with the per-field diff, then drops the form", async () => {
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({ onEditCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "city" });

    edit.getForm("1")?.setFieldValue("address.city", "Uppsala");
    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onEditCommit).toHaveBeenCalledTimes(1);
    const args = onEditCommit.mock
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
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({ onEditCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onEditCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("keeps the form open when the consumer rejects, with the error on the row", async () => {
    const grid = renderEditGrid({
      onEditCommit: () => Promise.reject(new Error("server said no")),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    // The draft is intact — a slow or failing save never flickers back.
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("blocks the commit on a real Zod row schema, pathed issues onto fields", async () => {
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({
      onEditCommit,
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

    expect(onEditCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");

    // Fixing the value lets the same commit through.
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(onEditCommit).toHaveBeenCalledTimes(1);
  });

  it("commits the row being left when cell mode begins on another row", async () => {
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({ onEditCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    edit.begin({ rowId: "2", columnId: "name" });
    // begin's implicit commit is async; give it a microtask.
    await vi.waitFor(() => {
      expect(onEditCommit).toHaveBeenCalledTimes(1);
      expect(edit.state.openRowIds).toEqual(["2"]);
      expect(edit.state.active).toEqual({ rowId: "2", columnId: "name" });
    });
  });

  it("accumulates drafts across rows under cellConfirm", () => {
    const grid = renderEditGrid({ editMode: "cellConfirm" });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
  });

  it("row mode refuses the pencil while another row is dirty, swaps a pristine one", () => {
    const grid = renderEditGrid({ editMode: "row" });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: null });
    expect(edit.state.active).toEqual({ rowId: "1", columnId: null });

    // Pristine — leaving drops it and opens the next row.
    edit.begin({ rowId: "2", columnId: null });
    expect(edit.state.openRowIds).toEqual(["2"]);

    // Dirty — the open row keeps the edit until saved or cancelled.
    edit.getForm("2")?.setFieldValue("name", "Erik B");
    edit.begin({ rowId: "1", columnId: null });
    expect(edit.state.openRowIds).toEqual(["2"]);
    expect(edit.state.active).toEqual({ rowId: "2", columnId: null });
  });

  it("submitAll commits every dirty row through the per-row loop", async () => {
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({ editMode: "batch", onEditCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");

    await expect(edit.submitAll()).resolves.toBe(true);

    expect(onEditCommit).toHaveBeenCalledTimes(2);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("submitAll with onEditCommitBatch makes one consumer call for the lot", async () => {
    const onEditCommit = vi.fn();
    const onEditCommitBatch = vi.fn();
    const grid = renderEditGrid({
      editMode: "batch",
      onEditCommit,
      onEditCommitBatch,
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "age" });
    edit.getForm("2")?.setFieldValue("age", 42);

    await expect(edit.submitAll()).resolves.toBe(true);

    expect(onEditCommit).not.toHaveBeenCalled();
    expect(onEditCommitBatch).toHaveBeenCalledTimes(1);
    const { rows: batchRows } = onEditCommitBatch.mock.calls[0]?.[0] as {
      rows: Array<TMDataGridEditCommitArgs<Person>>;
    };
    expect(batchRows.map((row) => row.rowId).sort()).toEqual(["1", "2"]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("a rejected batch keeps every draft", async () => {
    const grid = renderEditGrid({
      editMode: "batch",
      onEditCommitBatch: () => Promise.reject(new Error("no")),
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
    expect(edit.state.newRows).toEqual([{ tempId }]);
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

  it("deleteRow reports immediately outside batch, toggles the mark under it", () => {
    const onRowDelete = vi.fn();
    const immediate = renderEditGrid({ onRowDelete });
    immediate.current.edit.deleteRow("1");
    expect(onRowDelete).toHaveBeenCalledTimes(1);
    expect(onRowDelete.mock.calls[0]?.[0]).toMatchObject({ rowId: "1" });

    const batch = renderEditGrid({ editMode: "batch", onRowDelete: vi.fn() });
    batch.current.edit.deleteRow("1");
    expect(batch.current.edit.state.deletedRowIds).toEqual(["1"]);
    batch.current.edit.deleteRow("1");
    expect(batch.current.edit.state.deletedRowIds).toEqual([]);
  });

  it("deleteRow on an uncommitted entry row just discards the entry", () => {
    const onRowDelete = vi.fn();
    const grid = renderEditGrid({ editMode: "batch", onRowDelete });
    const { edit } = grid.current;
    const tempId = edit.addRow();

    edit.deleteRow(tempId);

    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
    expect(onRowDelete).not.toHaveBeenCalled();
  });

  it("submitAll's batch payload carries rows, added and deleted together", async () => {
    const onEditCommitBatch = vi.fn();
    const grid = renderEditGrid({
      editMode: "batch",
      onEditCommitBatch,
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

    expect(onEditCommitBatch).toHaveBeenCalledTimes(1);
    const args = onEditCommitBatch.mock.calls[0]?.[0] as {
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

  it("cancel drops the draft without a consumer call", () => {
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({ onEditCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    edit.cancel("1");

    expect(onEditCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.rows["1"]).toBe(undefined);
  });

  it("clearCell writes the type's empty value and commits it", async () => {
    const onEditCommit = vi.fn();
    const grid = renderEditGrid({ onEditCommit });
    const { edit } = grid.current;

    await expect(edit.clearCell("1", "age")).resolves.toBe(true);

    const args = onEditCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes).toEqual([
      { columnId: "age", field: "age", previous: 34, next: null },
    ]);
  });

  it("gates per-row editability through isRowEditable and meta.editable", () => {
    const grid = renderEditGrid({
      isRowEditable: (row) => row.original.id !== 2,
    });
    const { edit } = grid.current;
    // The same erasure the context provider performs — canEditCell is chrome.
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

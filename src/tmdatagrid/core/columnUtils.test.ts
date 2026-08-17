import { describe, expect, it } from "vitest";
import { erased, renderGrid, type TestRow } from "../../test/gridHarness";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import { getColumnDefaultOperator, isColumnReorderable } from "./columnUtils";

/**
 * The trivial meta readers (`getColumnLabel`, `getColumnType`,
 * `getColumnAlign`) are exercised all over the component suite; what earns
 * tests here are the two helpers carrying an actual rule - the header-group
 * ordering ban, and the filter-operator fallback chain - asked of real
 * TanStack columns, whose `parent` wiring is the thing under test.
 */
const helper = createTMDataGridColumnHelper<TestRow>();

const groupedColumns = helper.columns([
  helper.group({
    id: "person",
    header: "Person",
    columns: helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]),
  }),
  helper.accessor("city", { header: "City" }),
  helper.accessor("id", {
    header: "ID",
    meta: { type: "number", enableOrdering: false },
  }),
]);

function columnOf(id: string) {
  const api = erased(
    renderGrid({ columns: groupedColumns } as never).result.current,
  );
  const column = api.table.getColumn(id);
  if (column === undefined) throw new Error(`no column "${id}"`);
  return column;
}

describe("isColumnReorderable", () => {
  it("allows a top-level column", () => {
    expect(isColumnReorderable(columnOf("city"))).toBe(true);
  });

  it("refuses a leaf inside a header group, whatever its own meta says", () => {
    // Moving it out from under the group would leave the group header
    // spanning columns that no longer belong to it.
    expect(isColumnReorderable(columnOf("name"))).toBe(false);
    expect(isColumnReorderable(columnOf("age"))).toBe(false);
  });

  it("obeys meta.enableOrdering on a column that could otherwise move", () => {
    expect(isColumnReorderable(columnOf("id"))).toBe(false);
  });
});

describe("getColumnDefaultOperator", () => {
  it("falls back to the type's default operator", () => {
    expect(getColumnDefaultOperator(columnOf("city"))).toBe("contains");
    expect(getColumnDefaultOperator(columnOf("age"))).toBe("equals");
  });

  it("prefers meta.defaultFilterOperator when the column names one", () => {
    const columns = helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { defaultFilterOperator: "startsWith" },
      }),
    ]);
    const api = erased(renderGrid({ columns } as never).result.current);

    const column = api.table.getColumn("name");
    expect(column && getColumnDefaultOperator(column)).toBe("startsWith");
  });
});

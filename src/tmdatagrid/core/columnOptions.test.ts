import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MantineWrapper } from "../../test/gridHarness";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridRowData,
} from "../index";
import { optionsToComboboxData, resolveColumnOptions } from "./columnOptions";

type Order = {
  id: number;
  status: string;
  city: string;
  tags: Array<string>;
};

const helper = createTMDataGridColumnHelper<Order>();

const STATUS_OPTIONS = [
  "Pending",
  { value: "Paid", label: "Paid in full", color: "green" },
] as const;

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const columns = helper.columns([
  helper.accessor("status", {
    header: "Status",
    meta: { type: "select", options: STATUS_OPTIONS },
  }),
  helper.accessor("city", {
    header: "City",
    meta: { type: "select", options: "faceted" },
  }),
  helper.accessor("tags", {
    header: "Tags",
    meta: { type: "multiSelect", options: "faceted" },
  }),
  helper.accessor("id", {
    header: "ID",
    meta: {
      type: "select",
      options: ({ row }) =>
        row === undefined ? ["for-filter"] : [`for-row-${String(row.id)}`],
    },
  }),
]);

const rows: Array<Order> = [
  { id: 1, status: "Paid", city: "Malmö", tags: ["red", "blue"] },
  { id: 2, status: "Pending", city: "Stockholm", tags: ["blue"] },
  { id: 3, status: "Paid", city: "Stockholm", tags: [] },
];

function renderOrderGrid() {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Order>({
        data: rows,
        columns,
        getRowId: (row) => String(row.id),
      }),
    { wrapper: MantineWrapper },
  );
  // The same erasure the context provider performs.
  return result.current as unknown as TMDataGridApi<TMDataGridRowData>;
}

function column(api: TMDataGridApi<TMDataGridRowData>, id: string) {
  const found = api.table.getColumn(id);
  if (!found) throw new Error(`no column ${id}`);
  return found;
}

describe("resolveColumnOptions", () => {
  it("normalises a static list, keeping option fields and lifting strings", () => {
    const api = renderOrderGrid();
    expect(
      resolveColumnOptions({ table: api.table, column: column(api, "status") }),
    ).toEqual([
      { value: "Pending" },
      { value: "Paid", label: "Paid in full", color: "green" },
    ]);
  });

  it("reads faceted options from the values present, sorted", () => {
    const api = renderOrderGrid();
    expect(
      resolveColumnOptions({ table: api.table, column: column(api, "city") }),
    ).toEqual([{ value: "Malmö" }, { value: "Stockholm" }]);
  });

  it("flattens array cells into their elements for faceted options", () => {
    const api = renderOrderGrid();
    expect(
      resolveColumnOptions({ table: api.table, column: column(api, "tags") }),
    ).toEqual([{ value: "blue" }, { value: "red" }]);
  });

  it("passes the row through to a function source, when there is one", () => {
    const api = renderOrderGrid();
    const idColumn = column(api, "id");
    expect(
      resolveColumnOptions({ table: api.table, column: idColumn }),
    ).toEqual([{ value: "for-filter" }]);
    expect(
      resolveColumnOptions({
        table: api.table,
        column: idColumn,
        row: api.table.getRow("2"),
      }),
    ).toEqual([{ value: "for-row-2" }]);
  });

  it("is empty without a declaration, unless a fallback is given", () => {
    const api = renderOrderGrid();
    const cityColumn = column(api, "city");
    // The same column with its declaration removed — what a plain select
    // column with no `meta.options` looks like to the resolver.
    const bare = {
      ...cityColumn,
      columnDef: { ...cityColumn.columnDef, meta: {} },
      getFacetedUniqueValues: cityColumn.getFacetedUniqueValues.bind(cityColumn),
    } as typeof cityColumn;
    expect(resolveColumnOptions({ table: api.table, column: bare })).toEqual(
      [],
    );
    expect(
      resolveColumnOptions({ table: api.table, column: bare, fallback: "faceted" }),
    ).toEqual([{ value: "Malmö" }, { value: "Stockholm" }]);
  });
});

describe("optionsToComboboxData", () => {
  it("fills labels from values and keeps disabled", () => {
    expect(
      optionsToComboboxData([
        { value: "a" },
        { value: "b", label: "B!", disabled: true },
      ]),
    ).toEqual([
      { value: "a", label: "a" },
      { value: "b", label: "B!", disabled: true },
    ]);
  });

  it("folds group fields into Mantine group entries, ungrouped first", () => {
    expect(
      optionsToComboboxData([
        { value: "x", group: "Late" },
        { value: "a" },
        { value: "y", group: "Late" },
        { value: "z", group: "Early" },
      ]),
    ).toEqual([
      { value: "a", label: "a" },
      {
        group: "Late",
        items: [
          { value: "x", label: "x" },
          { value: "y", label: "y" },
        ],
      },
      { group: "Early", items: [{ value: "z", label: "z" }] },
    ]);
  });
});

import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erased, renderGrid, testRows } from "../../test/gridHarness";
import {
  buildCellMatrix,
  buildGridCellMatrix,
  formatExportValue,
  toClipboardText,
  toExcelCsv,
} from "./cellExport";

const nordic = { decimalComma: true };

describe("formatExportValue", () => {
  it("writes numbers with the decimal mark the separator implies", () => {
    expect(formatExportValue(12.5, nordic)).toBe("12,5");
    expect(formatExportValue(12.5, { decimalComma: false })).toBe("12.5");
    expect(formatExportValue(42, nordic)).toBe("42");
  });

  it("writes an empty cell for nothing, and for a number that is not one", () => {
    expect(formatExportValue(null, nordic)).toBe("");
    expect(formatExportValue(undefined, nordic)).toBe("");
    expect(formatExportValue(Number.NaN, nordic)).toBe("");
    expect(formatExportValue(Number.POSITIVE_INFINITY, nordic)).toBe("");
  });

  it("writes dates in the ISO-shaped Nordic form Excel parses", () => {
    expect(formatExportValue(new Date(2026, 6, 31), nordic)).toMatch(
      /^2026-07-31/,
    );
    expect(formatExportValue(new Date(Number.NaN), nordic)).toBe("");
  });

  it("keeps what an object held rather than stringifying it to nothing", () => {
    expect(formatExportValue({ a: 1 }, nordic)).toBe('{"a":1}');
    expect(formatExportValue(true, nordic)).toBe("true");
  });

  it("joins a multiSelect cell's array the way it reads on screen", () => {
    expect(formatExportValue(["Paid", "Pending"], nordic)).toBe("Paid, Pending");
    // Elements go through the same formatting as scalar cells.
    expect(formatExportValue([1.5, 2], nordic)).toBe("1,5, 2");
    expect(formatExportValue([], nordic)).toBe("");
  });
});

describe("buildCellMatrix", () => {
  // The range-export path: what Ctrl+C over a cell rectangle writes.
  function gridSlice() {
    const api = erased(renderGrid().result.current);
    const columns = [
      ...api.table.getLeftVisibleLeafColumns(),
      ...api.table.getCenterVisibleLeafColumns(),
      ...api.table.getRightVisibleLeafColumns(),
    ];
    // Render order: the checkbox lane first, then id, name, age, city.
    expect(columns[0]?.id).toBe("__select__");
    return { rows: api.table.getRowModel().rows, columns };
  }

  it("flattens the selected rectangle, headers first", () => {
    const { rows, columns } = gridSlice();

    const matrix = buildCellMatrix({
      rows,
      columns,
      bounds: { top: 0, bottom: 1, left: 1, right: 2 },
      includeHeaders: true,
      decimalComma: true,
    });

    expect(matrix).toEqual([
      ["ID", "Name"],
      ["1", "Anna"],
      ["2", "Erik"],
    ]);
  });

  it("drops a control column the rectangle swept over", () => {
    const { rows, columns } = gridSlice();

    const matrix = buildCellMatrix({
      rows,
      columns,
      bounds: { top: 0, bottom: 0, left: 0, right: 1 },
      includeHeaders: false,
      decimalComma: true,
    });

    // The checkbox lane holds a control, not a value — exporting it would
    // paste an empty column that shifts everything to its right.
    expect(matrix).toEqual([["1"]]);
  });

  it("writes nothing when the rectangle held only control columns", () => {
    const { rows, columns } = gridSlice();

    const matrix = buildCellMatrix({
      rows,
      columns,
      bounds: { top: 0, bottom: 5, left: 0, right: 0 },
      includeHeaders: true,
      decimalComma: true,
    });

    expect(matrix).toEqual([]);
  });

  it("skips bounds rows that are not there to read", () => {
    const { rows, columns } = gridSlice();

    const matrix = buildCellMatrix({
      rows,
      columns,
      bounds: { top: rows.length - 1, bottom: rows.length + 3, left: 1, right: 1 },
      includeHeaders: false,
      decimalComma: true,
    });

    expect(matrix).toEqual([[String(rows.length)]]);
  });
});

describe("toClipboardText", () => {
  it("separates cells with tabs and rows with CRLF", () => {
    expect(
      toClipboardText([
        ["Anna", "34"],
        ["Erik", "41"],
      ]),
    ).toBe("Anna\t34\r\nErik\t41");
  });

  it("quotes a value that would otherwise end the cell early", () => {
    expect(toClipboardText([["a\tb", 'say "hi"', "one\ntwo"]])).toBe(
      '"a\tb"\t"say ""hi"""\t"one\ntwo"',
    );
  });
});

describe("toExcelCsv", () => {
  const csv = toExcelCsv(
    [
      ["Name", "Age"],
      ["Anna", "34,5"],
    ],
    { separator: ";" },
  );

  it("leads with the BOM and the separator directive Excel reads", () => {
    // Without the BOM Excel reads the file as ANSI and å ä ö arrive broken;
    // without `sep=` it guesses the separator from the locale.
    expect(csv.startsWith("﻿sep=;\r\n")).toBe(true);
  });

  it("separates with semicolons and ends every line with CRLF", () => {
    expect(csv).toBe("﻿sep=;\r\nName;Age\r\nAnna;34,5\r\n");
  });

  it("quotes a value holding the separator", () => {
    expect(
      toExcelCsv([["Stockholm; Sweden"]], { separator: ";" }),
    ).toContain('"Stockholm; Sweden"');
    // A comma is just a character when the separator is a semicolon.
    expect(toExcelCsv([["34,5"]], { separator: ";" })).toContain("34,5\r\n");
  });

  it("takes a comma separator for a grid whose users are not Nordic", () => {
    expect(toExcelCsv([["a", "b"]], { separator: "," })).toBe(
      "﻿sep=,\r\na,b\r\n",
    );
  });
});

describe("buildGridCellMatrix", () => {
  it("exports every filtered row across every visible data column", () => {
    const { result } = renderGrid();
    const matrix = buildGridCellMatrix({ table: result.current.table });

    // Header row plus every data row; the checkbox lane is dropped.
    expect(matrix.length).toBe(testRows.length + 1);
    expect(matrix[0]).toEqual(["ID", "Name", "Age", "City"]);
    expect(matrix[1]).toEqual(["1", "Anna", "20", "Stockholm"]);
  });

  it("exports all pages of a paginated grid, not the one on screen", () => {
    const { result } = renderGrid({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });

    const matrix = buildGridCellMatrix({
      table: result.current.table,
      includeHeaders: false,
    });

    expect(matrix.length).toBe(testRows.length);
  });

  it("leaves out hidden columns and follows the filters", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.getColumn("city")?.toggleVisibility(false);
      result.current.table.setColumnFilters([
        { id: "name", value: { operator: "equals", value: "Anna" } },
      ]);
    });

    const matrix = buildGridCellMatrix({ table: result.current.table });

    expect(matrix[0]).toEqual(["ID", "Name", "Age"]);
    const names = matrix.slice(1).map((row) => row[1]);
    expect(names.every((name) => name === "Anna")).toBe(true);
    expect(names.length).toBeGreaterThan(0);
  });

  it("exports the records of a grouped grid, never its group rows", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setGrouping(["city"]);
    });

    const matrix = buildGridCellMatrix({
      table: result.current.table,
      includeHeaders: false,
    });

    // Every record, collapsed groups included — and only records.
    expect(matrix.length).toBe(testRows.length);
  });
});

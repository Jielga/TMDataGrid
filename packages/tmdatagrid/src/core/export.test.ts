import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erased, renderGrid, testRows, type TestRow } from "../../test/gridHarness";
import { captureDownloads } from "../../test/downloadStub";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import {
  buildCellMatrix,
  buildGridCellMatrix,
  formatExportValue,
  toClipboardText,
  toExcelCsv,
  buildExportData,
  countSelectedExportRows,
  csvExcelFormat,
  csvFormat,
  DEFAULT_EXPORT_OPTIONS,
  exportGrid,
  fromCellExportOptions,
  getExportableColumns,
  guardFormula,
  jsonFormat,
  resolveExportOptions,
  tsvFormat,
  type TMDataGridExportData,
} from "./export";

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

    // The checkbox lane holds a control, not a value - exporting it would
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

    // Every record, collapsed groups included - and only records.
    expect(matrix.length).toBe(testRows.length);
  });
});

const sample: TMDataGridExportData = {
  columnIds: ["name", "amount", "note"],
  headers: ["Name", "Amount", "Note"],
  rows: [
    ["Anna", 12.5, "=SUM(A1)"],
    ["Erik", -5, null],
  ],
};

describe("buildExportData", () => {
  it("collects raw values, labels and ids for every filtered row", () => {
    const { result } = renderGrid();

    const data = buildExportData({ table: result.current.table });

    expect(data.columnIds).toEqual(["id", "name", "age", "city"]);
    expect(data.headers).toEqual(["ID", "Name", "Age", "City"]);
    expect(data.rows).toHaveLength(testRows.length);
    expect(data.rows[0]).toEqual([1, "Anna", 20, "Stockholm"]);
  });

  it("takes the selected rows in grid order, whatever order they were ticked in", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setRowSelection({ "3": true, "1": true });
      result.current.table.setSorting([{ id: "id", desc: true }]);
    });

    const data = buildExportData({
      table: result.current.table,
      rows: "selected",
    });

    expect(data.rows.map((row) => row[0])).toEqual([3, 1]);
  });

  it("drops a column under enableExport: false and writes exportValue instead of the value", () => {
    const helper = createTMDataGridColumnHelper<TestRow>();
    const columns = helper.columns([
      helper.accessor("id", { header: "ID" }),
      helper.accessor("name", {
        header: "Name",
        meta: { exportValue: ({ value }) => String(value).toUpperCase() },
      }),
      helper.accessor("city", { header: "City", meta: { enableExport: false } }),
    ]);
    const { result } = renderGrid({ columns });

    const data = buildExportData({ table: result.current.table });

    expect(data.columnIds).toEqual(["id", "name"]);
    expect(data.rows[0]).toEqual([1, "ANNA"]);
  });

  it("counts the ticked rows of the view rather than the selection map", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setRowSelection({ "1": true, "2": true });
      result.current.table.setColumnFilters([
        { id: "name", value: { operator: "equals", value: "Anna" } },
      ]);
    });

    // Row 2 is Erik: filtered out, still in the map, not in the export.
    expect(countSelectedExportRows(result.current.table)).toBe(1);
    expect(
      buildExportData({ table: result.current.table, rows: "selected" }).rows,
    ).toHaveLength(1);
  });
});

describe("the text formats", () => {
  it("csvExcelFormat writes the Excel dialect and guards formulas", async () => {
    const text = await csvExcelFormat().write(sample, { includeHeaders: true });

    expect(text).toBe(
      "﻿sep=;\r\nName;Amount;Note\r\nAnna;12,5;'=SUM(A1)\r\nErik;-5;\r\n",
    );
  });

  it("csvFormat writes RFC 4180 with a dot decimal and no directive", async () => {
    const text = await csvFormat().write(sample, { includeHeaders: false });

    expect(text).toBe("﻿Anna,12.5,'=SUM(A1)\r\nErik,-5,\r\n");
  });

  it("tsvFormat writes tabs", async () => {
    const text = await tsvFormat().write(sample, { includeHeaders: true });

    expect(text).toBe(
      "﻿Name\tAmount\tNote\r\nAnna\t12,5\t'=SUM(A1)\r\nErik\t-5\t\r\n",
    );
  });

  it("escapeFormulas: false writes the text as it is", async () => {
    const text = await csvFormat({ escapeFormulas: false }).write(sample, {
      includeHeaders: false,
    });

    expect(text).toContain(",=SUM(A1)\r\n");
  });

  it("jsonFormat keeps numbers as numbers and dates as ISO strings", async () => {
    const when = new Date(Date.UTC(2026, 6, 31, 12));
    const text = await jsonFormat().write(
      {
        columnIds: ["n", "w", "x"],
        headers: ["N", "When", "X"],
        rows: [[1.5, when, undefined]],
      },
      { includeHeaders: true },
    );

    expect(JSON.parse(String(text))).toEqual([
      { N: 1.5, When: "2026-07-31T12:00:00.000Z", X: null },
    ]);
  });
});

describe("guardFormula", () => {
  it("prefixes text a spreadsheet would run", () => {
    expect(guardFormula("=1+1")).toBe("'=1+1");
    expect(guardFormula("@cmd")).toBe("'@cmd");
    expect(guardFormula("-")).toBe("'-");
    expect(guardFormula("+46 70 123 45 67")).toBe("'+46 70 123 45 67");
  });

  it("leaves numbers and plain text alone", () => {
    expect(guardFormula("-5")).toBe("-5");
    expect(guardFormula("+4670123")).toBe("+4670123");
    expect(guardFormula("hello")).toBe("hello");
    expect(guardFormula("")).toBe("");
  });
});

describe("toClipboardText over export data", () => {
  it("writes values only, with the decimal mark it is given", () => {
    expect(toClipboardText(sample, { decimalComma: false })).toBe(
      "Anna\t12.5\t'=SUM(A1)\r\nErik\t-5\t",
    );
  });
});

describe("exportGrid", () => {
  it("downloads the grid under the format's extension", async () => {
    const downloads = captureDownloads();
    const { result } = renderGrid();

    await exportGrid({
      table: result.current.table,
      options: { fileName: "people", format: csvFormat() },
    });

    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.fileName).toBe("people.csv");
    expect(await downloads[0]?.text()).toContain(
      "﻿ID,Name,Age,City\r\n1,Anna,20,Stockholm\r\n",
    );
  });

  it("downloads nothing when no column can be exported", async () => {
    const downloads = captureDownloads();
    const helper = createTMDataGridColumnHelper<TestRow>();
    const { result } = renderGrid({
      columns: helper.columns([
        helper.accessor("id", { header: "ID", meta: { enableExport: false } }),
      ]),
    });

    await exportGrid({ table: result.current.table });

    expect(downloads).toHaveLength(0);
  });
});

describe("resolveExportOptions", () => {
  it("folds overrides over the defaults, skipping undefined fields", () => {
    const format = jsonFormat();

    const resolved = resolveExportOptions(
      { fileName: "a" },
      { fileName: undefined, format },
      undefined,
    );

    expect(resolved).toEqual({
      format,
      fileName: "a",
      includeHeaders: true,
      columns: "visible",
    });
    expect(resolveExportOptions()).toEqual(DEFAULT_EXPORT_OPTIONS);
  });

  it("converts the deprecated cellExport options into a format", () => {
    const options = fromCellExportOptions({
      separator: ",",
      decimalComma: false,
      fileName: "x",
    });

    expect(options.fileName).toBe("x");
    expect(options.format?.id).toBe("csvExcel");
    expect(options.format?.decimalComma).toBe(false);
    expect(fromCellExportOptions({ fileName: "y" }).format).toBeUndefined();
  });
});

describe("column selection", () => {
  it('takes hidden columns under "all" and leaves them out under "visible"', () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.getColumn("city")?.toggleVisibility(false);
    });

    expect(buildExportData({ table: result.current.table }).columnIds).toEqual([
      "id",
      "name",
      "age",
    ]);
    expect(
      buildExportData({ table: result.current.table, columns: "all" }).columnIds,
    ).toEqual(["id", "name", "age", "city"]);
  });

  it("takes a list of ids in render order, unknown ones ignored", () => {
    const { result } = renderGrid();

    const data = buildExportData({
      table: result.current.table,
      columns: ["city", "nope", "id"],
    });

    expect(data.columnIds).toEqual(["id", "city"]);
    expect(data.rows[0]).toEqual([1, "Stockholm"]);
  });

  it("lists every exportable column for the picker, lanes left out", () => {
    const { result } = renderGrid();

    expect(
      getExportableColumns(result.current.table).map((column) => column.id),
    ).toEqual(["id", "name", "age", "city"]);
  });
});

describe("a grouped grid", () => {
  it("writes the grouped column and never the tree lane", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setGrouping(["city"]);
    });

    const data = buildExportData({ table: result.current.table });

    // The tree lane is a display column with nothing to read; the city it
    // shows is the city column's, which `groupedColumnMode: "remove"` only
    // took off the screen.
    expect(data.columnIds).not.toContain("__group__");
    expect(data.columnIds).toContain("city");
    expect(data.rows).toHaveLength(testRows.length);
  });
});

import { describe, expect, it } from "vitest";
import { parseCsv, toCsvLine } from "./conditionCsv";

describe("parseCsv", () => {
  it("reads plain records, numbering them from 1", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["c", "d"] },
    ]);
  });

  it("keeps a quoted comma, newline and doubled quote inside one cell", () => {
    const rows = parseCsv('title,contains,"engineer, senior"\nx,y,"a""b"\n');
    expect(rows[0].cells[2]).toBe("engineer, senior");
    expect(rows[1].cells[2]).toBe('a"b');
    expect(parseCsv('a,"one\ntwo",b')).toEqual([
      { line: 1, cells: ["a", "one\ntwo", "b"] },
    ]);
  });

  it("reads a file written with CRLF, and one without a final newline", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["c", "d"] },
    ]);
    expect(parseCsv("a,b")).toEqual([{ line: 1, cells: ["a", "b"] }]);
  });

  it("has no rows for an empty file, and one empty cell for a blank line", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("a\n\nb")).toEqual([
      { line: 1, cells: ["a"] },
      { line: 2, cells: [""] },
      { line: 3, cells: ["b"] },
    ]);
  });

  it("round-trips through the writer", () => {
    const cells = ['engineer, senior', 'say "hi"', "plain", "two\nlines"];
    expect(parseCsv(toCsvLine(cells))[0].cells).toEqual(cells);
  });
});

import { describe, expect, it } from "vitest";
import {
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

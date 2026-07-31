import type { Column, Row } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import type { TMDataGridRangeBounds } from "./cellRange";
import { getColumnLabel, isControlColumn } from "./columnUtils";

/**
 * The byte order mark Excel looks for before it will read a file as UTF-8.
 * Built from its code point rather than pasted in: a literal BOM is invisible
 * in a source file, and an invisible character nobody can see is one somebody
 * eventually deletes.
 */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** The selected block, flattened to text. One inner array per row. */
export type TMDataGridCellMatrix = Array<Array<string>>;

/**
 * How values are written out.
 *
 * The defaults are the Nordic ones, because they are the ones that need
 * choosing: an Excel running a Swedish, Norwegian, Danish or Finnish locale
 * reads `;` as its list separator and `,` as its decimal mark, and a file
 * written the other way opens as one column of text. Both are settable for a
 * grid whose users run something else.
 */
export type TMDataGridCellExportOptions = {
  /** CSV field separator. Defaults to `";"`. */
  separator?: string;
  /** Write numbers as `1,5` rather than `1.5`. Defaults to `true`. */
  decimalComma?: boolean;
  /** Column labels as the first row. Defaults to `true`. */
  includeHeaders?: boolean;
  /** Without extension. Defaults to `"export"`. */
  fileName?: string;
};

type ResolvedExportOptions = Required<TMDataGridCellExportOptions>;

export const DEFAULT_CELL_EXPORT_OPTIONS: ResolvedExportOptions = {
  separator: ";",
  decimalComma: true,
  includeHeaders: true,
  fileName: "export",
};

/**
 * One value as text.
 *
 * Deliberately not the rendered cell: what a cell renders is React, and often a
 * badge, a link or an icon rather than the value. The value is what a
 * spreadsheet wants, and it is the one thing every column is guaranteed to
 * have.
 */
export function formatExportValue(
  value: unknown,
  { decimalComma }: { decimalComma: boolean },
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const text = String(value);
    return decimalComma ? text.replace(".", ",") : text;
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  // `sv-SE` is ISO-shaped — 2026-07-31, 2026-07-31 14:05:00 — which is both the
  // Nordic form and the one Excel parses as a date rather than as text.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toLocaleString("sv-SE");
  }
  // An object in a cell is a shape the grid cannot know. JSON at least keeps
  // what was there, where `String(value)` would write "[object Object]".
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

export type BuildCellMatrixArgs = {
  rows: ReadonlyArray<Row<TMDataGridFeatures, TMDataGridRowData>>;
  /** Every visible column, in render order — the same list the bounds index into. */
  columns: ReadonlyArray<Column<TMDataGridFeatures, TMDataGridRowData, unknown>>;
  bounds: TMDataGridRangeBounds;
  includeHeaders: boolean;
  decimalComma: boolean;
};

/**
 * The selected rectangle as rows of text.
 *
 * The generated lanes — the checkbox, the tree chevron, the details chevron —
 * are dropped even when the rectangle covers them. They hold controls rather
 * than data, so a column of empty strings is all they could contribute, and
 * pasting one into a spreadsheet only shifts everything to its right.
 */
export function buildCellMatrix({
  rows,
  columns,
  bounds,
  includeHeaders,
  decimalComma,
}: BuildCellMatrixArgs): TMDataGridCellMatrix {
  const selectedColumns = columns
    .slice(bounds.left, bounds.right + 1)
    .filter((column) => !isControlColumn(column.id));
  if (selectedColumns.length === 0) return [];

  const matrix: TMDataGridCellMatrix = [];
  if (includeHeaders) {
    matrix.push(selectedColumns.map((column) => getColumnLabel(column)));
  }

  for (let index = bounds.top; index <= bounds.bottom; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;
    matrix.push(
      selectedColumns.map((column) =>
        formatExportValue(row.getValue(column.id), { decimalComma }),
      ),
    );
  }
  return matrix;
}

/**
 * Quotes a field when it holds something that would otherwise end it early.
 * Doubling the quote is how both CSV and Excel's own clipboard format escape
 * one, so the same rule serves both.
 */
function escapeField(value: string, separator: string): string {
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * The clipboard format spreadsheets read: tab between cells, CRLF between rows.
 *
 * Tabs rather than commas because that is what Excel, Sheets and Numbers all
 * put on the clipboard themselves — paste it and the cells land in cells. A
 * comma-separated string pastes into a single column, which is the thing this
 * exists to avoid.
 */
export function toClipboardText(matrix: TMDataGridCellMatrix): string {
  return matrix
    .map((row) => row.map((value) => escapeField(value, "\t")).join("\t"))
    .join("\r\n");
}

/**
 * A CSV that opens straight into columns in Excel.
 *
 * Three things make that true, and all three are needed:
 *
 * | Part | Why |
 * | ---- | --- |
 * | `sep=;` first line | Excel's own directive — it stops guessing and uses this |
 * | UTF-8 BOM | without it Excel reads the file as ANSI, and å ä ö arrive broken |
 * | CRLF line endings | what Excel writes, and what its importer is happiest with |
 *
 * The `sep=` line is Excel's alone; other readers show it as a first row. That
 * is the trade this makes — the file is for Excel, and "it just opens" is worth
 * more than being a well-behaved CSV nobody was going to feed to a parser.
 */
export function toExcelCsv(
  matrix: TMDataGridCellMatrix,
  { separator }: { separator: string },
): string {
  const body = matrix
    .map((row) => row.map((value) => escapeField(value, separator)).join(separator))
    .join("\r\n");
  return `${UTF8_BOM}sep=${separator}\r\n${body}\r\n`;
}

/**
 * Puts text on the clipboard, reporting whether it landed.
 *
 * The async clipboard API only resolves for a document that has the focus and a
 * user gesture behind it — both true when this runs off Ctrl+C or a menu item.
 * It is still allowed to reject (a permissions policy, a page that lost focus
 * mid-copy), so the result is a boolean rather than a promise nobody checks.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Downloads text as a file, through the one mechanism a library can use: an
 * anchor with an object URL behind it, clicked. Revoked on the next frame —
 * immediately would race the browser's own read of it.
 */
export function downloadTextFile({
  fileName,
  text,
  mimeType = "text/csv;charset=utf-8",
}: {
  fileName: string;
  text: string;
  mimeType?: string;
}): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

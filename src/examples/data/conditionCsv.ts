/**
 * The CSV reader the query builder recipe imports with.
 *
 * RFC 4180 as far as a spreadsheet export goes - comma separators, `"` around
 * a cell that contains a comma, a quote or a newline, `""` for a literal quote
 * - and nothing beyond that: no configurable delimiter, no type inference, no
 * streaming. A file the user picked is already in memory by the time it is
 * parsed, so the whole text is walked once.
 *
 * One pass over the string rather than `split("\n").map(split(","))`: a quoted
 * cell may hold either character, so the line and the cell have to be found by
 * the same scan. It also keeps the allocation down to one array per row, which
 * is what a 20 000-row import notices.
 */

export type CsvRow = {
  /**
   * 1-based line in the file - what the user sees in their spreadsheet, so
   * what a rejected row is reported by. A quoted newline does not advance it:
   * the number counts records, not physical lines.
   */
  line: number;
  cells: Array<string>;
};

const QUOTE = '"';
const COMMA = ",";
const CR = "\r";
const LF = "\n";

/**
 * Every record in the file, header row included - whether the first row is a
 * header is the caller's to decide, since a headerless file is a valid export.
 * A trailing newline adds no row; a blank line in the middle does, with one
 * empty cell, and the caller rejects it like any other malformed row.
 */
export function parseCsv(text: string): Array<CsvRow> {
  const rows: Array<CsvRow> = [];
  if (text.length === 0) return rows;

  let cells: Array<string> = [];
  let cell = "";
  let quoted = false;
  let line = 1;

  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push({ line, cells });
    cells = [];
    line += 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char !== QUOTE) {
        cell += char;
        continue;
      }
      // `""` inside a quoted cell is one literal quote; a lone quote closes it.
      if (text[index + 1] === QUOTE) {
        cell += QUOTE;
        index += 1;
        continue;
      }
      quoted = false;
      continue;
    }

    if (char === QUOTE && cell === "") {
      quoted = true;
      continue;
    }
    if (char === COMMA) {
      endCell();
      continue;
    }
    if (char === CR) continue; // CRLF: the LF ends the row.
    if (char === LF) {
      endRow();
      continue;
    }
    cell += char;
  }

  // A file that does not end in a newline still ends its last row.
  if (cell !== "" || cells.length > 0) endRow();

  return rows;
}

/** `["a", 'b,c']` → `a,"b,c"` - the inverse, for writing a file back out. */
export function toCsvLine(cells: ReadonlyArray<string>): string {
  return cells
    .map((value) =>
      /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value,
    )
    .join(",");
}

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toCsvLine } from "./data/conditionCsv";
import { QueryBuilderForm } from "./demos/recipes/QueryBuilderForm";
import { gridRowCount, part, parts, renderWithMantine } from "../test/gridHarness";

/**
 * A load test for the query builder's CSV import: 20 000 conditions through
 * the file input, then the interactions a user has next.
 *
 * jsdom does no layout and paints nothing, so what these numbers measure is
 * the JavaScript - parse, the form's write, TanStack's row model, the
 * virtualizer's slice and React's render of it. Real paint time is on top of
 * them, and the row count the virtualizer mounts here is the one
 * `vitest.setup.ts` fakes a 1200x600 viewport for. What the test asserts is
 * therefore *shape*, not milliseconds: a run that is linear in the file's size
 * passes on any machine, and the quadratic ones this recipe invites - a scan
 * per row in the collection validator, a write per row into the form - do not.
 */

const SMALL = 5_000;
const LARGE = 20_000;

/** The two conditions the form starts with, plus the file's rows. */
const INITIAL_ROWS = 2;

const FIELDS = ["title", "status", "hired"] as const;
const OPERATORS = {
  title: ["contains", "equals", "starts with"],
  status: ["equals", "does not equal"],
  hired: ["before", "after", "on"],
} as const;
const DAY_MS = 86_400_000;

/** Every row a different value, the way a real export's rows differ. */
const VALUES = {
  title: (index: number) => `engineer, grade ${index}`, // quoted by the writer
  status: (index: number) => `Active ${index}`,
  hired: (index: number) =>
    new Date(Date.UTC(2000, 0, 1) + index * DAY_MS).toISOString().slice(0, 10),
} as const;

/**
 * A file of valid, non-identical conditions: the field and operator cycle, so
 * only the value tells most rows apart and the collection validator has to
 * look at all three.
 */
function makeCsv(count: number): string {
  const lines: Array<string> = [toCsvLine(["field", "operator", "value"])];
  for (let index = 0; index < count; index += 1) {
    const field = FIELDS[index % FIELDS.length];
    const operators = OPERATORS[field];
    lines.push(
      toCsvLine([field, operators[index % operators.length], VALUES[field](index)]),
    );
  }
  return lines.join("\r\n");
}

const fileInput = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]')!;

/** Wall-clock over one act, in whole milliseconds. */
async function timed(label: string, run: () => Promise<void>): Promise<number> {
  const started = performance.now();
  await run();
  const elapsed = Math.round(performance.now() - started);
  console.log(`[load] ${label}: ${elapsed} ms`);
  return elapsed;
}

/** Picks the file, then waits for every row to be in the grid. */
async function importCsv(text: string, expectedRows: number) {
  const file = new File([text], "conditions.csv", { type: "text/csv" });
  await act(async () => {
    fireEvent.change(fileInput(), { target: { files: [file] } });
  });
  await waitFor(() => expect(gridRowCount()).toBe(expectedRows), {
    timeout: 60_000,
  });
}

describe("query builder CSV import", () => {
  it(`imports ${LARGE.toLocaleString("en")} rows and stays interactive`, async () => {
    const csv = makeCsv(LARGE);
    console.log(`[load] file: ${LARGE} rows, ${(csv.length / 1e6).toFixed(2)} MB`);

    renderWithMantine(<QueryBuilderForm />);
    expect(gridRowCount()).toBe(INITIAL_ROWS);

    const importMs = await timed("import 20 000 rows", () =>
      importCsv(csv, LARGE + INITIAL_ROWS),
    );

    // Every row landed, and the report says so rather than the form's error.
    expect(screen.getByText(`${LARGE} imported`)).toBeInTheDocument();
    expect(
      screen.queryByText(/Two conditions are identical/),
    ).not.toBeInTheDocument();
    // The quoted cell came back whole - a comma inside a value is one cell.
    expect(document.body.textContent).toContain("engineer, grade 0");

    // Search is what the user does next, and it needs the form to have
    // validated 20 002 conditions.
    const search = screen.getByRole("button", { name: "Search" });
    expect(search).toBeEnabled();
    const submitMs = await timed("submit", async () => {
      await act(async () => {
        fireEvent.click(search);
      });
    });
    expect(
      screen.getByText(`Searching … to … with ${LARGE + INITIAL_ROWS} condition(s)`),
    ).toBeInTheDocument();

    // A sort walks every row through TanStack's row model.
    const sortMs = await timed("sort by Value", async () => {
      await act(async () => {
        fireEvent.click(part("header", { columnId: "value" }));
      });
    });

    // One row edit: the pencil, then Save. `onCommit` rewrites the form's
    // array, which re-runs the collection validator over all 20 002.
    const editMs = await timed("open and save one row", async () => {
      await act(async () => {
        fireEvent.click(parts("edit-row")[0]!);
      });
      await act(async () => {
        fireEvent.click(part("save-row"));
      });
    });

    // Typing in a header field must not cost anything the grid does: the
    // subscription that reads it sits in the availability cell.
    const typeMs = await timed("type in Title", async () => {
      await act(async () => {
        fireEvent.change(screen.getByLabelText("Title"), {
          target: { value: "architect" },
        });
      });
    });

    // Ceilings, not budgets: each is far above a healthy run on a laptop and
    // far below what the quadratic version of the same step costs.
    expect(importMs).toBeLessThan(30_000);
    expect(submitMs).toBeLessThan(5_000);
    expect(sortMs).toBeLessThan(10_000);
    expect(editMs).toBeLessThan(10_000);
    expect(typeMs).toBeLessThan(5_000);
  }, 180_000);

  it("reports the lines it could not read", async () => {
    renderWithMantine(<QueryBuilderForm />);
    // The demo's own sample file: five records, the last naming a field the
    // form has no editor for.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sample file" }));
    });

    expect(gridRowCount()).toBe(INITIAL_ROWS + 4);
    expect(
      screen.getByText(/4 imported, 1 skipped \(Line 6: "grade" is not a field\)/),
    ).toBeInTheDocument();
  });

  it("costs the same per row at 5 000 and at 20 000", async () => {
    const small = makeCsv(SMALL);
    const large = makeCsv(LARGE);

    const { unmount } = renderWithMantine(<QueryBuilderForm />);
    const smallMs = await timed("import 5 000 rows", () =>
      importCsv(small, SMALL + INITIAL_ROWS),
    );
    unmount();

    renderWithMantine(<QueryBuilderForm />);
    const largeMs = await timed("import 20 000 rows", () =>
      importCsv(large, LARGE + INITIAL_ROWS),
    );

    // Four times the rows. Linear work lands near 4x, and the fixed cost of
    // the mount pulls the ratio down rather than up; anything with a scan per
    // row lands at 16x or worse. 8x is the line between the two.
    const ratio = largeMs / Math.max(smallMs, 1);
    console.log(`[load] 20k/5k ratio: ${ratio.toFixed(1)}x`);
    expect(ratio).toBeLessThan(8);
  }, 180_000);
});

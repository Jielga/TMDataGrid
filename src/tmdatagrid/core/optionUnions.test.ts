import { describe, expect, it } from "vitest";
import type { UseTMDataGridOptions } from "../useTMDataGrid";
import { useTMDataGrid } from "../useTMDataGrid";

/**
 * Compile-time contracts for the option unions. Nothing here runs: the hook
 * calls live in a function that is never invoked, and `tsc` is the assertion
 * - it fails the build on a missing error exactly as it does on a real one,
 * because an `@ts-expect-error` with nothing to swallow is itself an error.
 */

type Person = { id: number; name: string };
declare const data: Person[];
declare const columns: UseTMDataGridOptions<Person>["columns"];
declare const getRowId: (row: Person) => string;

export function useCompileTimeContracts() {
  // Legal: batch with its batch save.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "batch", onCommitBatch: async () => {} },
  });
  // Legal: batch without it - `submitAll` falls back to the per-row loop.
  useTMDataGrid<Person>({ data, columns, getRowId, editing: { mode: "batch" } });
  // Legal: an immediate mode with the per-row commit.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "cell", onCommit: () => {} },
  });
  // Legal: no editing at all.
  useTMDataGrid<Person>({ data, columns });
  // Legal: editing switched off by a condition - the object may be undefined.
  useTMDataGrid<Person>({ data, columns, getRowId, editing: undefined });

  // @ts-expect-error -- editing requires getRowId: the forms are keyed by row
  // id, and the index fallback points at a different record after any sort.
  useTMDataGrid<Person>({ data, columns, editing: { mode: "cell" } });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: {
      mode: "cell",
      // @ts-expect-error -- onCommitBatch exists only under mode "batch"; no
      // other mode's submitAll ever calls it.
      onCommitBatch: async () => {},
    },
  });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    // @ts-expect-error -- `mode` is what the rest of the object acts on, so
    // an editing object without one is a compile error, not a dead option.
    editing: { onCommit: () => {} },
  });
}

describe("option unions", () => {
  it("holds its contracts at compile time (see useCompileTimeContracts)", () => {
    // The real assertions are the @ts-expect-error lines above; this test
    // exists so the file counts as a suite.
    expect(typeof useCompileTimeContracts).toBe("function");
  });
});

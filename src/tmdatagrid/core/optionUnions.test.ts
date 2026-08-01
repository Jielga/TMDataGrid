import { describe, expect, it } from "vitest";
import type { UseTMDataGridOptions } from "../useTMDataGrid";
import { useTMDataGrid } from "../useTMDataGrid";

/**
 * Compile-time contracts for the option unions. Nothing here runs: the hook
 * calls live in a function that is never invoked, and `tsc` is the assertion
 * — it fails the build on a missing error exactly as it does on a real one,
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
    editMode: "batch",
    onEditCommitBatch: async () => {},
  });
  // Legal: batch without it — `submitAll` falls back to the per-row loop.
  useTMDataGrid<Person>({ data, columns, getRowId, editMode: "batch" });
  // Legal: an immediate mode with the per-row commit.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editMode: "cell",
    onEditCommit: () => {},
  });
  // Legal: no editing, no editing options.
  useTMDataGrid<Person>({ data, columns });

  // @ts-expect-error -- editing requires getRowId: the forms are keyed by row
  // id, and the index fallback points at a different record after any sort.
  useTMDataGrid<Person>({ data, columns, editMode: "cell" });

  // @ts-expect-error -- onEditCommitBatch exists only under editMode "batch";
  // no other mode's submitAll ever calls it.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editMode: "cell",
    onEditCommitBatch: async () => {},
  });

  // @ts-expect-error -- an editing callback without editMode acts on nothing.
  useTMDataGrid<Person>({ data, columns, onEditCommit: () => {} });

  // @ts-expect-error -- same for the entry-row options.
  useTMDataGrid<Person>({ data, columns, onRowAdd: async () => {} });
}

describe("option unions", () => {
  it("holds its contracts at compile time (see useCompileTimeContracts)", () => {
    // The real assertions are the @ts-expect-error lines above; this test
    // exists so the file counts as a suite.
    expect(typeof useCompileTimeContracts).toBe("function");
  });
});

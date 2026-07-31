import { describe, expect, it } from "vitest";
import { isSameCell, resolveCellMove } from "./cellNavigation";

/** A 10×4 grid with the focus in the middle of it. */
const move = (
  key: string,
  overrides: Partial<Parameters<typeof resolveCellMove>[0]> = {},
) =>
  resolveCellMove({
    key,
    ctrlKey: false,
    from: { rowIndex: 5, columnIndex: 2 },
    rowCount: 10,
    columnCount: 4,
    pageRows: 3,
    ...overrides,
  });

describe("resolveCellMove", () => {
  it("moves one cell per arrow key", () => {
    expect(move("ArrowDown")).toEqual({ rowIndex: 6, columnIndex: 2 });
    expect(move("ArrowUp")).toEqual({ rowIndex: 4, columnIndex: 2 });
    expect(move("ArrowRight")).toEqual({ rowIndex: 5, columnIndex: 3 });
    expect(move("ArrowLeft")).toEqual({ rowIndex: 5, columnIndex: 1 });
  });

  it("moves a viewport of rows per page key", () => {
    expect(move("PageDown")).toEqual({ rowIndex: 8, columnIndex: 2 });
    expect(move("PageUp")).toEqual({ rowIndex: 2, columnIndex: 2 });
  });

  it("takes Home and End to the ends of the row", () => {
    expect(move("Home")).toEqual({ rowIndex: 5, columnIndex: 0 });
    expect(move("End")).toEqual({ rowIndex: 5, columnIndex: 3 });
  });

  it("takes Ctrl+Home and Ctrl+End to the corners of the grid", () => {
    expect(move("Home", { ctrlKey: true })).toEqual({
      rowIndex: 0,
      columnIndex: 0,
    });
    expect(move("End", { ctrlKey: true })).toEqual({
      rowIndex: 9,
      columnIndex: 3,
    });
  });

  it("clamps at the edges rather than wrapping", () => {
    // The position it started from, not null: the caller still has to claim the
    // key, or the body would scroll under a focus that did not move.
    expect(move("ArrowUp", { from: { rowIndex: 0, columnIndex: 2 } })).toEqual({
      rowIndex: 0,
      columnIndex: 2,
    });
    expect(
      move("ArrowLeft", { from: { rowIndex: 5, columnIndex: 0 } }),
    ).toEqual({ rowIndex: 5, columnIndex: 0 });
    expect(
      move("ArrowRight", { from: { rowIndex: 5, columnIndex: 3 } }),
    ).toEqual({ rowIndex: 5, columnIndex: 3 });
    // A page past the end stops at the last row rather than overshooting it.
    expect(move("PageDown", { from: { rowIndex: 9, columnIndex: 2 } })).toEqual({
      rowIndex: 9,
      columnIndex: 2,
    });
  });

  it("leaves keys that are not navigation alone", () => {
    expect(move("a")).toBeNull();
    expect(move("Enter")).toBeNull();
    expect(move("Tab")).toBeNull();
    expect(move(" ")).toBeNull();
  });

  it("has nowhere to go in an empty grid", () => {
    expect(move("ArrowDown", { rowCount: 0 })).toBeNull();
    expect(move("ArrowRight", { columnCount: 0 })).toBeNull();
  });
});

describe("isSameCell", () => {
  it("compares by ids, not by identity", () => {
    expect(isSameCell({ rowId: "3", columnId: "name" }, { rowId: "3", columnId: "name" })).toBe(true);
    expect(isSameCell({ rowId: "3", columnId: "name" }, { rowId: "4", columnId: "name" })).toBe(false);
    expect(isSameCell({ rowId: "3", columnId: "name" }, { rowId: "3", columnId: "age" })).toBe(false);
  });

  it("treats null as a cell of its own", () => {
    expect(isSameCell(null, null)).toBe(true);
    expect(isSameCell(null, { rowId: "3", columnId: "name" })).toBe(false);
    expect(isSameCell({ rowId: "3", columnId: "name" }, null)).toBe(false);
  });
});

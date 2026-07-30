import { describe, expect, it, vi } from "vitest";
import type { TableState } from "@tanstack/react-table";
import {
  DATA_STATE_SLICES,
  hasPersistenceKeys,
  readPersistedState,
  SETTINGS_STATE_SLICES,
  type TMDataGridPersistence,
  writePersistedState,
} from "./persistence";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type GridState = TableState<TMDataGridFeatures>;

/** A complete, valid state — tests narrow or corrupt it as needed. */
function gridState(overrides: Partial<GridState> = {}): GridState {
  return {
    columnFilters: [{ id: "name", value: { operator: "contains", value: "a" } }],
    globalFilter: "search",
    sorting: [{ id: "name", desc: true }],
    pagination: { pageIndex: 2, pageSize: 50 },
    columnVisibility: { name: false },
    columnSizing: { name: 120 },
    columnOrder: ["name", "age"],
    columnPinning: { left: ["name"], right: [] },
    ...overrides,
  } as GridState;
}

const stored = (key: string): Record<string, unknown> =>
  JSON.parse(window.localStorage.getItem(key) ?? "{}");

describe("hasPersistenceKeys", () => {
  it("is false without a usable key", () => {
    expect(hasPersistenceKeys(undefined)).toBe(false);
    expect(hasPersistenceKeys({})).toBe(false);
    // A key entry with an empty key name configures nothing.
    expect(hasPersistenceKeys({ dataKey: ["", ["sorting"]] })).toBe(false);
  });

  it("is true as soon as either key is set", () => {
    expect(hasPersistenceKeys({ dataKey: "d" })).toBe(true);
    expect(hasPersistenceKeys({ settingsKey: "s" })).toBe(true);
  });
});

describe("writePersistedState", () => {
  it("splits the slices across the two keys", () => {
    writePersistedState(gridState(), { dataKey: "d", settingsKey: "s" });

    expect(Object.keys(stored("d")).sort()).toEqual([...DATA_STATE_SLICES].sort());
    expect(Object.keys(stored("s")).sort()).toEqual(
      [...SETTINGS_STATE_SLICES].sort(),
    );
  });

  it("writes only the listed slices when a key is narrowed", () => {
    writePersistedState(gridState(), { dataKey: ["d", ["sorting"]] });

    expect(Object.keys(stored("d"))).toEqual(["sorting"]);
  });

  it("writes nothing without a key", () => {
    writePersistedState(gridState(), {});

    expect(window.localStorage.length).toBe(0);
  });

  it("uses sessionStorage when asked", () => {
    writePersistedState(gridState(), {
      dataKey: "d",
      storageMode: "sessionStorage",
    });

    expect(window.sessionStorage.getItem("d")).not.toBeNull();
    expect(window.localStorage.getItem("d")).toBeNull();
  });

  it("swallows a storage failure", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() =>
      writePersistedState(gridState(), { dataKey: "d" }),
    ).not.toThrow();
  });

  it("honours a custom serializer", () => {
    const persist: TMDataGridPersistence = {
      dataKey: ["d", ["sorting"]],
      serialize: (value) => `custom:${JSON.stringify(value)}`,
    };
    writePersistedState(gridState(), persist);

    expect(window.localStorage.getItem("d")).toMatch(/^custom:/);
  });
});

describe("readPersistedState", () => {
  it("round-trips what was written", () => {
    const persist: TMDataGridPersistence = { dataKey: "d", settingsKey: "s" };
    const state = gridState();
    writePersistedState(state, persist);

    const restored = readPersistedState(persist);

    expect(restored.sorting).toEqual(state.sorting);
    expect(restored.pagination).toEqual(state.pagination);
    expect(restored.columnOrder).toEqual(state.columnOrder);
    expect(restored.columnPinning).toEqual(state.columnPinning);
  });

  it("returns nothing when no key is configured", () => {
    expect(readPersistedState(undefined)).toEqual({});
    expect(readPersistedState({})).toEqual({});
  });

  it("ignores a payload written before the selection was narrowed", () => {
    writePersistedState(gridState(), { dataKey: "d" });

    // Same key, but the caller has since opted out of everything but sorting.
    const restored = readPersistedState({ dataKey: ["d", ["sorting"]] });

    expect(restored.sorting).toBeDefined();
    expect(restored.pagination).toBeUndefined();
    expect(restored.columnFilters).toBeUndefined();
  });

  it("survives unparsable or non-object payloads", () => {
    window.localStorage.setItem("d", "{not json");
    expect(readPersistedState({ dataKey: "d" })).toEqual({});

    window.localStorage.setItem("d", '"a string"');
    expect(readPersistedState({ dataKey: "d" })).toEqual({});

    window.localStorage.setItem("d", "null");
    expect(readPersistedState({ dataKey: "d" })).toEqual({});
  });

  it("honours a custom deserializer", () => {
    window.localStorage.setItem("d", `custom:${JSON.stringify(gridState())}`);

    const restored = readPersistedState({
      dataKey: "d",
      deserialize: (value) => JSON.parse(value.replace(/^custom:/, "")),
    });

    expect(restored.sorting).toEqual([{ id: "name", desc: true }]);
  });

  describe("shape guards", () => {
    /** Writes a raw payload past the serializer, the way a stale build would. */
    const write = (payload: Record<string, unknown>) =>
      window.localStorage.setItem("k", JSON.stringify(payload));

    const readAll = () =>
      readPersistedState({ dataKey: "k", settingsKey: "k" });

    it("drops a slice of the wrong shape and keeps the rest", () => {
      write({
        sorting: "descending",
        pagination: { pageIndex: 1, pageSize: 25 },
      });

      const restored = readAll();

      expect(restored.sorting).toBeUndefined();
      expect(restored.pagination).toEqual({ pageIndex: 1, pageSize: 25 });
    });

    it("rejects malformed sorting entries", () => {
      write({ sorting: [{ id: "name" }] });
      expect(readAll().sorting).toBeUndefined();

      write({ sorting: [{ id: 1, desc: true }] });
      expect(readAll().sorting).toBeUndefined();

      write({ sorting: [{ id: "name", desc: true }] });
      expect(readAll().sorting).toEqual([{ id: "name", desc: true }]);
    });

    it("rejects a pagination slice that could not index a page", () => {
      write({ pagination: { pageIndex: -1, pageSize: 25 } });
      expect(readAll().pagination).toBeUndefined();

      write({ pagination: { pageIndex: 0, pageSize: 0 } });
      expect(readAll().pagination).toBeUndefined();

      write({ pagination: { pageIndex: 0 } });
      expect(readAll().pagination).toBeUndefined();
    });

    it("rejects column records with the wrong value type", () => {
      write({ columnVisibility: { name: "yes" } });
      expect(readAll().columnVisibility).toBeUndefined();

      write({ columnSizing: { name: "120" } });
      expect(readAll().columnSizing).toBeUndefined();

      write({ columnOrder: ["a", 2] });
      expect(readAll().columnOrder).toBeUndefined();
    });

    it("requires both pinned lanes to be string arrays", () => {
      write({ columnPinning: { left: ["a"] } });
      expect(readAll().columnPinning).toBeUndefined();

      write({ columnPinning: { left: ["a"], right: [] } });
      expect(readAll().columnPinning).toEqual({ left: ["a"], right: [] });
    });

    it("requires column filters to carry an id", () => {
      write({ columnFilters: [{ value: "x" }] });
      expect(readAll().columnFilters).toBeUndefined();

      write({ columnFilters: [{ id: "name", value: "x" }] });
      expect(readAll().columnFilters).toEqual([{ id: "name", value: "x" }]);
    });

    it("leaves the untyped global filter alone", () => {
      write({ globalFilter: { anything: true } });
      expect(readAll().globalFilter).toEqual({ anything: true });
    });
  });
});

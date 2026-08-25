import { act, render } from "@testing-library/react";
import { useState } from "react";
import { useCreateAtom } from "@tanstack/react-store";
import { describe, expect, it, vi } from "vitest";
import type { ColumnVisibilityState } from "@tanstack/react-table";
import {
  MantineWrapper,
  renderedHeaderIds,
  renderGrid,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { type TMDataGridApi, useTMDataGrid } from "../index";
import {
  findFrozenStateSlices,
  sameStateValue,
  stabilizeControlledState,
} from "./controlledState";

describe("sameStateValue", () => {
  it("sees through a fresh object literal", () => {
    expect(sameStateValue({ city: false }, { city: false })).toBe(true);
    expect(
      sameStateValue(
        [{ id: "name", value: { operator: "contains", value: "a" } }],
        [{ id: "name", value: { operator: "contains", value: "a" } }],
      ),
    ).toBe(true);
  });

  it("compares the maps table-core builds, which have no prototype", () => {
    const map = Object.assign(Object.create(null) as ColumnVisibilityState, {
      city: false,
    });
    expect(sameStateValue(map, { city: false })).toBe(true);
  });

  it("separates values that differ", () => {
    expect(sameStateValue({ city: false }, { city: true })).toBe(false);
    expect(sameStateValue({ city: false }, { city: false, age: false })).toBe(
      false,
    );
    expect(sameStateValue([{ id: "a" }], [{ id: "b" }])).toBe(false);
    expect(sameStateValue(["a"], ["a", "b"])).toBe(false);
  });

  it("compares anything that is not data by identity", () => {
    const date = new Date(0);
    expect(sameStateValue(date, date)).toBe(true);
    expect(sameStateValue(date, new Date(0))).toBe(false);
  });
});

describe("stabilizeControlledState", () => {
  it("keeps last render's object when every slice says the same thing", () => {
    const previous = { columnVisibility: { city: false }, sorting: [] };
    expect(
      stabilizeControlledState({ columnVisibility: { city: false }, sorting: [] }, previous),
    ).toBe(previous);
  });

  it("keeps the unchanged slices when one of them moves", () => {
    const previous = {
      columnVisibility: { city: false },
      sorting: [{ id: "name", desc: false }],
    };
    const next = stabilizeControlledState(
      {
        columnVisibility: { city: false },
        sorting: [{ id: "name", desc: true }],
      },
      previous,
    );

    expect(next).not.toBe(previous);
    expect(next?.columnVisibility).toBe(previous.columnVisibility);
    expect(next?.sorting).toEqual([{ id: "name", desc: true }]);
  });

  it("publishes a slice that appears or disappears", () => {
    const previous = { columnVisibility: { city: false } };
    expect(
      stabilizeControlledState(
        { columnVisibility: { city: false }, sorting: [] },
        previous,
      ),
    ).not.toBe(previous);
    expect(stabilizeControlledState({}, previous)).not.toBe(previous);
  });

  it("passes the first render through", () => {
    const first = { columnVisibility: { city: false } };
    expect(stabilizeControlledState(first, undefined)).toBe(first);
    expect(stabilizeControlledState(undefined, first)).toBeUndefined();
  });
});

describe("findFrozenStateSlices", () => {
  it("names a controlled slice with no callback behind it", () => {
    expect(
      findFrozenStateSlices({
        state: { columnVisibility: { city: false }, sorting: [] },
      }),
    ).toEqual([
      { slice: "columnVisibility", handler: "onColumnVisibilityChange" },
      { slice: "sorting", handler: "onSortingChange" },
    ]);
  });

  it("is quiet about a slice the consumer holds", () => {
    expect(
      findFrozenStateSlices({
        state: { columnVisibility: { city: false } },
        onColumnVisibilityChange: () => {},
      }),
    ).toEqual([]);
    // An external atom outranks `state` and takes the writes itself.
    expect(
      findFrozenStateSlices({
        state: { columnVisibility: { city: false } },
        atoms: { columnVisibility: {} },
      }),
    ).toEqual([]);
  });

  it("is quiet with nothing controlled", () => {
    expect(findFrozenStateSlices({})).toEqual([]);
  });
});

/**
 * The grid a consumer writes when they reach for controlled state: the options
 * object, and the `state` inside it, are built in the render body. Issue #39 is
 * that this used to render forever.
 */
function ControlledGrid({
  onRender,
  columnVisibility,
  onColumnVisibilityChange,
  onReady,
}: {
  onRender: () => void;
  columnVisibility: ColumnVisibilityState;
  onColumnVisibilityChange?: (updater: unknown) => void;
  onReady?: (api: TMDataGridApi<TestRow>) => void;
}) {
  onRender();
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row: TestRow) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange,
  } as never);
  onReady?.(grid);

  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>
  );
}

describe("controlled state on the grid", () => {
  it("does not re-render itself forever (#39)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let renders = 0;
    let api: TMDataGridApi<TestRow> | null = null;

    render(
      <ControlledGrid
        onRender={() => {
          renders += 1;
          if (renders > 20) throw new Error(`render loop at ${renders}`);
        }}
        columnVisibility={{ city: false }}
        onReady={(grid) => {
          api = grid;
        }}
      />,
      { wrapper: MantineWrapper },
    );

    const mounted = renders;
    // Any state change re-renders the consumer, which is what used to hand the
    // table a new `state` object and start the cycle.
    act(() => api!.table.setSorting([{ id: "name", desc: true }]));

    expect(renders - mounted).toBeLessThanOrEqual(3);
    expect(renderedHeaderIds()).not.toContain("city");
    warn.mockRestore();
  });

  it("warns about a slice nothing can write back to", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderGrid({ state: { columnVisibility: { city: false } } } as never);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "state.columnVisibility is controlled but no onColumnVisibilityChange",
      ),
    );
    warn.mockRestore();
  });

  it("holds the value the consumer publishes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({ city: false });
      return (
        <ControlledGrid
          onRender={() => {}}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={(updater) =>
            setColumnVisibility((old) =>
              typeof updater === "function"
                ? (updater(old) as ColumnVisibilityState)
                : (updater as ColumnVisibilityState),
            )
          }
          onReady={(grid) => {
            api = grid;
          }}
        />
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).not.toContain("city");

    act(() => api!.table.getColumn("city")!.toggleVisibility(true));
    expect(renderedHeaderIds()).toContain("city");

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the tree lane on while a controlled visibility map is in play", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({ city: false });
      return (
        <ControlledGrid
          onRender={() => {}}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={(updater) =>
            setColumnVisibility((old) =>
              typeof updater === "function"
                ? (updater(old) as ColumnVisibilityState)
                : (updater as ColumnVisibilityState),
            )
          }
          onReady={(grid) => {
            api = grid;
          }}
        />
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).not.toContain("__group__");

    // The lane's visibility is the grid's own entry in a map the consumer now
    // owns - the sync would drop it on the next render.
    act(() => api!.table.setGrouping(["age"]));
    expect(renderedHeaderIds()).toContain("__group__");

    act(() => api!.table.setGrouping([]));
    expect(renderedHeaderIds()).not.toContain("__group__");

    warn.mockRestore();
  });

  it("hides the tree lane when an atom owns the visibility map", () => {
    let api: TMDataGridApi<TestRow> | null = null;

    function AtomOwned() {
      // The v9 route that needs no callback: the table writes through the atom,
      // and `initialState` never reaches the slice.
      const columnVisibility = useCreateAtom<ColumnVisibilityState>({
        city: false,
      });
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row: TestRow) => String(row.id),
        atoms: { columnVisibility },
      } as never);
      api = grid;

      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    render(<AtomOwned />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).not.toContain("__group__");
    expect(renderedHeaderIds()).not.toContain("city");

    act(() => api!.table.setGrouping(["age"]));
    expect(renderedHeaderIds()).toContain("__group__");
  });

  it("keeps the control lanes out of a controlled visibility map", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ControlledGrid
        onRender={() => {}}
        columnVisibility={{ __select__: false, city: false }}
      />,
      { wrapper: MantineWrapper },
    );

    expect(renderedHeaderIds()).toContain("__select__");
    warn.mockRestore();
  });
});

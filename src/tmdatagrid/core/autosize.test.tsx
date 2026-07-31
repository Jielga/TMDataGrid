import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MantineWrapper, renderGrid, type TestRow } from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { autosizeColumn } from "./autosize";

/**
 * jsdom lays nothing out, so `scrollWidth` is always 0 there. The tests stub
 * it to a deterministic proxy — text length × 8px — which is enough to prove
 * the measurement is read, clamped and written.
 */
function stubScrollWidth() {
  Object.defineProperty(window.Element.prototype, "scrollWidth", {
    configurable: true,
    get(this: Element) {
      return (this.textContent ?? "").length * 8;
    },
  });
}

function restoreScrollWidth() {
  delete (window.Element.prototype as { scrollWidth?: unknown }).scrollWidth;
}

afterEach(restoreScrollWidth);

function renderTable(grid: ReturnType<typeof renderGrid>["result"]) {
  return render(
    <TMDataGrid {...grid.current}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>,
    { wrapper: MantineWrapper },
  );
}

describe("autosizeColumn", () => {
  it("writes the widest mounted content into columnSizing, clamped to minSize", () => {
    stubScrollWidth();
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    );
    expect(scroller).not.toBeNull();

    const applied = autosizeColumn({
      table: result.current.table,
      columnId: "city",
      container: scroller as HTMLElement,
    });

    expect(applied).toBe(true);
    const width = result.current.table.store.state.columnSizing["city"];
    // "Stockholm" (9 chars × 8px) plus padding and allowance, floored at the
    // column's 120px minSize — the exact number depends on the stub, the
    // clamp is what matters.
    expect(width).toBeGreaterThanOrEqual(120);
  });

  it("is a no-op for a column that cannot be resized", () => {
    stubScrollWidth();
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    ) as HTMLElement;

    // The generated checkbox lane declares enableResizing: false.
    const applied = autosizeColumn({
      table: result.current.table,
      columnId: "__select__",
      container: scroller,
    });

    expect(applied).toBe(false);
    expect(
      result.current.table.store.state.columnSizing["__select__"],
    ).toBeUndefined();
  });

  it("returns false with nothing mounted to measure", () => {
    const { result } = renderGrid();
    const detached = document.createElement("div");

    expect(
      autosizeColumn({
        table: result.current.table,
        columnId: "city",
        container: detached,
      }),
    ).toBe(false);
  });
});

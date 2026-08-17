import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MantineWrapper, renderGrid, type TestRow } from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { autosizeColumn, measureColumnContentWidth } from "./autosize";

/**
 * jsdom lays nothing out, so `scrollWidth` is always 0 there. The tests stub
 * it to a deterministic proxy (text length × a chosen px width), which is
 * enough to prove the measurement is read, clamped and written. The width is
 * per test: wide enough to clear the column's `minSize` when the measurement
 * itself is under test, narrow when the clamp is.
 */
function stubScrollWidth(pxPerChar: number) {
  Object.defineProperty(window.Element.prototype, "scrollWidth", {
    configurable: true,
    get(this: Element) {
      return (this.textContent ?? "").length * pxPerChar;
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
  it("writes the measured width of the widest mounted content", () => {
    // 16px/char puts "Stockholm" well past the column's 120px minSize, so
    // the measurement itself has to carry the result - a broken measurement
    // could not hide behind the clamp.
    stubScrollWidth(16);
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
    const measured = measureColumnContentWidth({
      container: scroller as HTMLElement,
      columnId: "city",
    });
    expect(measured).toBeGreaterThan(120);
    expect(result.current.table.store.state.columnSizing["city"]).toBe(
      Math.round(measured),
    );
  });

  it("floors at the column's minSize when the content measures narrower", () => {
    // At 8px/char every city value and the header land under 120px.
    stubScrollWidth(8);
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    ) as HTMLElement;

    autosizeColumn({
      table: result.current.table,
      columnId: "city",
      container: scroller,
    });

    expect(result.current.table.store.state.columnSizing["city"]).toBe(120);
  });

  it("caps at the column's maxSize when the content measures wider", () => {
    stubScrollWidth(16);
    const { result } = renderGrid({
      columns: [
        { accessorKey: "city", header: "City", minSize: 80, maxSize: 100 },
      ],
    } as never);
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    ) as HTMLElement;

    autosizeColumn({
      table: result.current.table,
      columnId: "city",
      container: scroller,
    });

    expect(result.current.table.store.state.columnSizing["city"]).toBe(100);
  });

  it("is a no-op for a column that cannot be resized", () => {
    stubScrollWidth(8);
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

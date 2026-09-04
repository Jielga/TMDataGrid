import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MantineWrapper,
  renderGrid,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";

/**
 * jsdom lays nothing out, so every header measures 0 there. The tests hand the
 * header cells a width of their own - the width an `fr` track would have
 * resolved to in a browser, which is deliberately not the declared `size` the
 * columns fall back to (150).
 */
function stubHeaderWidths(widths: Record<string, number>) {
  vi.spyOn(
    window.Element.prototype,
    "getBoundingClientRect",
  ).mockImplementation(function (this: Element) {
    const columnId = this.getAttribute("data-column-id");
    const width =
      this.getAttribute("role") === "columnheader" && columnId
        ? (widths[columnId] ?? 0)
        : 0;
    return { ...new DOMRect(0, 0, width, 0), width } as DOMRect;
  });
}

function renderTable(grid: ReturnType<typeof renderGrid>["result"]) {
  return render(
    <TMDataGrid {...grid.current}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>,
    { wrapper: MantineWrapper },
  );
}

/** The resize divider, which carries no part of its own. */
function separator(container: HTMLElement, columnId: string) {
  const element = container.querySelector<HTMLElement>(
    `[role="columnheader"][data-column-id="${columnId}"] [class*="columnSeparator"]`,
  );
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/** The one element the whole layout hangs off. */
function gridElement(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>(
    '[role="table"], [role="grid"]',
  );
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("column resizing", () => {
  it("starts the drag from the width the column is rendered with", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const { table } = result.current;

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    // The rendered width, not the declared 150: a column that jumps on
    // mousedown drops the divider out from under the pointer.
    expect(table.store.state.columnSizing.name).toBe(260);

    fireEvent.mouseUp(document, { clientX: 260 });
    expect(table.store.state.columnResizing.isResizingColumn).toBe(false);
  });

  it("paints the drag on the grid's own tracks, and commits it on release", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const { table } = result.current;
    const grid = gridElement(container);

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    fireEvent.mouseMove(document, { clientX: 280 });

    // The pointer's width is on the element, and nowhere in state yet: state
    // published per pointer move is what makes the drag choppy.
    expect(grid.style.gridTemplateColumns).toContain("280px");
    expect(table.store.state.columnSizing.name).toBe(260);

    fireEvent.mouseUp(document, { clientX: 280 });
    expect(table.store.state.columnSizing.name).toBe(280);
  });

  it("leaves the untouched columns fluid", () => {
    stubHeaderWidths({ name: 260, city: 200 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const { table } = result.current;

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    fireEvent.mouseUp(document, { clientX: 260 });

    expect(Object.keys(table.store.state.columnSizing)).toEqual(["name"]);
  });

  it("stops every header from starting a move while a column resizes", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const headers = () =>
      Array.from(container.querySelectorAll('[role="columnheader"]'));

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    // Not only the resized one: the divider moves across its neighbours, and
    // a native drag started there swallows the mouseup the resize ends on.
    expect(
      headers().filter((header) => header.getAttribute("draggable") === "true"),
    ).toHaveLength(0);

    fireEvent.mouseUp(document, { clientX: 260 });
    expect(
      headers().filter((header) => header.getAttribute("draggable") === "true"),
    ).not.toHaveLength(0);
  });
});

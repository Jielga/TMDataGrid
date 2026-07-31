import type { RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridTable } from "../useTMDataGrid";

/**
 * Room the header keeps for its hover-revealed actions (sort arrow, menu) and
 * the resize divider, which measure zero while idle. Without it a column sized
 * exactly to its header text puts the actions on top of the title.
 */
const HEADER_ACTIONS_ALLOWANCE = 30;

/** Breathing room so the widest value does not touch the next divider. */
const CONTENT_ALLOWANCE = 2;

/**
 * What the content inside one cell actually spans, in px.
 *
 * A Range over the children rather than the span's `scrollWidth`, because the
 * two disagree in opposite directions: a left-aligned cell stretches its
 * content span to fill the cell (`flex: 1 1 auto`), so `scrollWidth` reports
 * the stretched box and autosize could never *shrink* a column — while for
 * clipped content both see past the `overflow: hidden`. The Range measures
 * the laid-out text and elements themselves, whatever box they sit in.
 *
 * `scrollWidth` stays as the fallback for environments whose Ranges do not
 * measure (jsdom reports 0 there).
 */
function contentSpanWidth(content: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(content);
  // jsdom's Range has no getBoundingClientRect at all, hence the guard
  // rather than a zero-check alone.
  const width =
    typeof range.getBoundingClientRect === "function"
      ? range.getBoundingClientRect().width
      : 0;
  return width > 0 ? width : content.scrollWidth;
}

/**
 * Widest rendered content of one column, in px, measured from the DOM.
 *
 * Mounted cells only: under virtualization the unmounted rows do not exist to
 * be measured, so this reads the visible window plus overscan — the same
 * trade AG Grid's autosize makes by default.
 */
export function measureColumnContentWidth({
  container,
  columnId,
}: {
  /** The grid's scroll container — anything enclosing the column's cells. */
  container: HTMLElement;
  columnId: string;
}): number {
  let widest = 0;

  const cells = container.querySelectorAll<HTMLElement>(
    `[role="cell"][data-column-id="${CSS.escape(columnId)}"],` +
      `[role="gridcell"][data-column-id="${CSS.escape(columnId)}"]`,
  );
  for (const cell of cells) {
    const content = cell.firstElementChild;
    if (!(content instanceof HTMLElement)) continue;
    const styles = getComputedStyle(cell);
    const padding =
      (Number.parseFloat(styles.paddingLeft) || 0) +
      (Number.parseFloat(styles.paddingRight) || 0);
    widest = Math.max(
      widest,
      contentSpanWidth(content) + padding + CONTENT_ALLOWANCE,
    );
  }

  const title = container.querySelector<HTMLElement>(
    `[data-testid="dg-header-${CSS.escape(columnId)}"] [data-dg-header-title]`,
  );
  if (title) {
    const header = title.closest<HTMLElement>('[role="columnheader"]');
    const styles = header ? getComputedStyle(header) : null;
    const padding = styles
      ? (Number.parseFloat(styles.paddingLeft) || 0) +
        (Number.parseFloat(styles.paddingRight) || 0)
      : 0;
    widest = Math.max(
      widest,
      contentSpanWidth(title) + padding + HEADER_ACTIONS_ALLOWANCE,
    );
  }

  return widest;
}

/**
 * Sizes a column to its widest mounted content — what double-clicking the
 * resize divider does, exported so a menu item or consumer code can trigger
 * the same thing.
 *
 * The width lands in `columnSizing`, so it persists with the other widths and
 * a later resize drag takes over from it. Clamped to the column's
 * `minSize`/`maxSize`; a no-op (returning `false`) for a column that cannot
 * be resized or has nothing mounted to measure.
 */
export function autosizeColumn<TData extends RowData>({
  table,
  columnId,
  container,
}: {
  table: TMDataGridTable<TData>;
  columnId: string;
  container: HTMLElement;
}): boolean {
  const erased = table as unknown as TMDataGridTable<TMDataGridRowData>;
  const column = erased.getColumn(columnId);
  if (!column || !column.getCanResize()) return false;

  const measured = measureColumnContentWidth({ container, columnId });
  if (measured <= 0) return false;

  const minSize = column.columnDef.minSize ?? 80;
  const maxSize = column.columnDef.maxSize ?? Number.POSITIVE_INFINITY;
  const width = Math.round(Math.min(Math.max(measured, minSize), maxSize));

  erased.setColumnSizing((previous) => ({ ...previous, [columnId]: width }));
  return true;
}

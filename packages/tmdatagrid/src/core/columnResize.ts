import type { ColumnSizingState, Header } from "@tanstack/react-table";
import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures } from "../useTMDataGrid";

/**
 * The column resize drag - the grid's own copy of `header.getResizeHandler()`.
 *
 * TanStack's handler listens for the pointer's moves and its release on a
 * document, and takes that document as an argument. In `@tanstack/table-core`
 * 9.0.0-beta.21 an operator precedence slip,
 * `a || b ? document : null`, discards the argument and always listens on
 * the global `document`. A grid rendered through a portal into a window
 * opened with `window.open` then never hears the drag: the global document
 * is the opener's, and the pointer is moving in the other window.
 *
 * Upstream fixed it in 9.0.0-beta.55, behind the `start` / `end` column
 * pinning rename of beta.38 that the grid has not taken yet. Until it does,
 * this is that handler with the document it is given honoured. Delete this
 * module and call `header.getResizeHandler(contextDocument)` once the grid
 * is on 9.0.0-beta.55 or later.
 *
 * @param contextDocument The document the separator lives in - its
 * `ownerDocument`, never the global one.
 */
export function getColumnResizeHandler(
  header: Header<TMDataGridFeatures, TMDataGridRowData, unknown>,
  contextDocument: Document,
) {
  const { column, table } = header;
  const canResize = column.getCanResize();

  return (event: ReactMouseEvent | ReactTouchEvent) => {
    if (!canResize) return;

    const isTouch = "touches" in event;
    // Two or three fingers are a gesture, not a resize.
    if (isTouch && event.touches.length > 1) return;

    const startSize = header.getSize();
    const columnSizingStart: Array<[string, number]> = header
      .getLeafHeaders()
      .map((leaf) => [leaf.column.id, leaf.column.getSize()]);
    const startOffset = isTouch
      ? Math.round(event.touches[0]!.clientX)
      : event.clientX;

    const newColumnSizing: ColumnSizingState = {};

    const updateOffset = (phase: "move" | "end", clientX?: number) => {
      if (typeof clientX !== "number") return;

      table.setColumnResizing((old) => {
        const direction =
          table.options.columnResizeDirection === "rtl" ? -1 : 1;
        const deltaOffset = (clientX - (old.startOffset ?? 0)) * direction;
        const startSize = old.startSize ?? 0;
        const deltaPercentage = Math.max(
          startSize > 0 ? deltaOffset / startSize : 0,
          -0.999999,
        );

        old.columnSizingStart.forEach(([columnId, headerSize]) => {
          newColumnSizing[columnId] =
            Math.round(
              Math.max(
                headerSize > 0
                  ? headerSize + headerSize * deltaPercentage
                  : deltaOffset / old.columnSizingStart.length,
                0,
              ) * 100,
            ) / 100;
        });

        return { ...old, deltaOffset, deltaPercentage };
      });

      if (table.options.columnResizeMode === "onChange" || phase === "end") {
        table.setColumnSizing((old) => ({ ...old, ...newColumnSizing }));
      }
    };

    const onEnd = (clientX?: number) => {
      updateOffset("end", clientX);
      table.setColumnResizing((old) => ({
        ...old,
        isResizingColumn: false,
        startOffset: null,
        startSize: null,
        deltaOffset: null,
        deltaPercentage: null,
        columnSizingStart: [],
      }));
    };

    if (isTouch) {
      const onTouchMove = (touchEvent: TouchEvent) => {
        if (touchEvent.cancelable) {
          touchEvent.preventDefault();
          touchEvent.stopPropagation();
        }
        updateOffset("move", touchEvent.touches[0]?.clientX);
      };
      const onTouchEnd = (touchEvent: TouchEvent) => {
        contextDocument.removeEventListener("touchmove", onTouchMove);
        contextDocument.removeEventListener("touchend", onTouchEnd);
        if (touchEvent.cancelable) {
          touchEvent.preventDefault();
          touchEvent.stopPropagation();
        }
        onEnd(touchEvent.touches[0]?.clientX);
      };
      // Not passive: the move handler cancels the scroll the touch would
      // otherwise start.
      contextDocument.addEventListener("touchmove", onTouchMove, {
        passive: false,
      });
      contextDocument.addEventListener("touchend", onTouchEnd, {
        passive: false,
      });
    } else {
      const onMouseMove = (mouseEvent: MouseEvent) =>
        updateOffset("move", mouseEvent.clientX);
      const onMouseUp = (mouseEvent: MouseEvent) => {
        contextDocument.removeEventListener("mousemove", onMouseMove);
        contextDocument.removeEventListener("mouseup", onMouseUp);
        onEnd(mouseEvent.clientX);
      };
      contextDocument.addEventListener("mousemove", onMouseMove);
      contextDocument.addEventListener("mouseup", onMouseUp);
    }

    table.setColumnResizing((old) => ({
      ...old,
      startOffset,
      startSize,
      deltaOffset: 0,
      deltaPercentage: 0,
      columnSizingStart,
      isResizingColumn: column.id,
    }));
  };
}

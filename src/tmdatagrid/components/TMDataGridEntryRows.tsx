import {
  flexRender,
  useTable,
  type Column,
  type Row,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useLayoutEffect, useMemo, useRef } from "react";
import classes from "./TMDataGridTable.module.css";
import sticky from "./sticky.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import {
  getColumnAlign,
  isColumnEditableForRow,
  isControlColumn,
} from "../core/columnUtils";
import type { TMDataGridEditApi } from "../core/editEngine";
import { focusEditorContent } from "../core/editorFocus";
import {
  tmDataGridFeatures,
  type TMDataGridFeatures,
} from "../useTMDataGrid";
import { TMDataGridCellEditor } from "./TMDataGridCellEditor";
import { EDIT_COLUMN_ID } from "./TMDataGridEditColumn";
import type { TMDataGridColumnLayout } from "./TMDataGridTable";

type ErasedColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;

/**
 * Whether an entry cell edits. `edit.canEditCell` asks the main table for
 * the row, and an entry row is precisely not there yet - so the structural
 * half of the same rule is applied to the entry table's own row.
 */
function isEntryCellEditable(
  row: Row<TMDataGridFeatures, TMDataGridRowData>,
  column: ErasedColumn,
  edit: TMDataGridEditApi,
): boolean {
  if (!edit.isColumnEditable(column)) return false;
  return isColumnEditableForRow(column, row);
}

/**
 * The sticky entry block - one row of open editors per `edit.addRow()`,
 * pinned under the header. The one place stickiness is genuinely required:
 * an existing row that scrolls away has a place to scroll back to, a row
 * being typed into does not exist anywhere else.
 *
 * A second, tiny table instance over the new rows' seed values - same
 * columns, its own `useTable`, no sorting or filtering ever exercised - so
 * these are real `Cell`s and the editor host, the typed editors and the
 * validators all apply unchanged. The forms live in the same engine map as
 * every other draft, keyed by their temporary ids.
 *
 * Enter commits the entry - `onRowAdd`, or a park under `editing.draft`,
 * where `saveDrafts` reports it in `created`; Escape discards it. The edit
 * lane, when present, offers the same pair as buttons.
 */
export function TMDataGridEntryRows({
  orderedColumns,
  layoutFor,
  rowHeight,
}: {
  orderedColumns: ReadonlyArray<ErasedColumn>;
  layoutFor: (columnId: string) => TMDataGridColumnLayout;
  rowHeight: number;
}) {
  const { table, edit, features } = useTMDataGridContext();
  const newRows = useSelector(edit.store, (state) => state.newRows);
  // The reopen gesture: `begin` on a committed entry row flips it back to
  // editors and names the cell double-clicked - where the caret goes.
  const activeEntry = useSelector(edit.store, (state) =>
    state.active !== null &&
    state.newRows.some(
      (newRow) => newRow.tempId === state.active?.rowId && !newRow.committed,
    )
      ? state.active
      : null,
  );
  const blockRef = useRef<HTMLDivElement>(null);
  /** The entry row the caret has already been placed in. */
  const focusedTempIdRef = useRef<string | null>(null);
  /** The reopen target (`rowId:columnId`) the caret has already landed in. */
  const focusedActiveRef = useRef<string | null>(null);

  /**
   * The caret goes into a row the moment `edit.addRow()` opens it, landing in
   * its first editable cell - the same placement the main table makes for a
   * row opened by a gesture, and made here for the same reason: an editor is
   * free not to focus itself, and then a new row appeared with the caret
   * still outside it.
   */
  useLayoutEffect(() => {
    const newest = newRows.at(-1)?.tempId;
    if (newest === undefined) {
      focusedTempIdRef.current = null;
      return;
    }
    if (focusedTempIdRef.current === newest) return;
    const block = blockRef.current;
    if (block === null) return;
    const editor = block.querySelector<HTMLElement>(
      `[data-dg-part="editor"][data-row-id="${CSS.escape(newest)}"]`,
    );
    // Not mounted yet; the next render tries again, as the table's does.
    if (editor === null) return;
    focusedTempIdRef.current = newest;
    focusEditorContent(editor);
  });

  /**
   * The caret for a reopen: `begin` on a committed row re-arms its editors
   * and the double-clicked cell's editor should hold the caret, not the
   * row's first. Keyed separately from the add effect above - the row was
   * already focused once when it was added.
   */
  useLayoutEffect(() => {
    if (activeEntry === null) {
      focusedActiveRef.current = null;
      return;
    }
    const key = `${activeEntry.rowId}:${activeEntry.columnId ?? ""}`;
    if (focusedActiveRef.current === key) return;
    const block = blockRef.current;
    if (block === null) return;
    const editor = block.querySelector<HTMLElement>(
      activeEntry.columnId !== null
        ? `[data-dg-part="editor"][data-row-id="${CSS.escape(activeEntry.rowId)}"][data-column-id="${CSS.escape(activeEntry.columnId)}"]`
        : `[data-dg-part="editor"][data-row-id="${CSS.escape(activeEntry.rowId)}"]`,
    );
    // Not mounted yet; the next render tries again, as the add effect does.
    if (editor === null) return;
    focusedActiveRef.current = key;
    focusEditorContent(editor);
  });

  // Open (uncommitted) rows keep the seed values frozen at addRow - the live values
  // belong to the forms, which the editors read directly, and this table only
  // provides row and cell identity. A committed row's cells render values, so
  // there the draft itself is the row; the memo recomputes on every
  // commit/reopen because either flips `newRows`' identity.
  const data = useMemo(
    () =>
      newRows.map(
        ({ tempId, committed }) =>
          ((committed
            ? edit.getForm(tempId)?.state.values
            : edit.getForm(tempId)?.options.defaultValues) ??
            {}) as TMDataGridRowData,
      ),
    [newRows, edit],
  );

  const entryTable = useTable({
    features: tmDataGridFeatures,
    columns: table.options.columns,
    data,
    getRowId: (_row, index) => newRows[index]?.tempId ?? String(index),
  });

  if (newRows.length === 0) return null;

  const entryRows = entryTable.getCoreRowModel().rows;
  const committedById = new Map(
    newRows.map((newRow) => [newRow.tempId, newRow.committed]),
  );
  // A row being *typed* into is always sticky - it exists nowhere else to
  // scroll back to. A committed row joins the scrolling flow unless
  // `newRowsSticky` keeps it pinned, so entering many rows cannot fill the
  // viewport with sticky chrome.
  const stickyRows = entryRows.filter(
    (entryRow) =>
      features.editNewRowsSticky || committedById.get(entryRow.id) !== true,
  );
  const flowRows = features.editNewRowsSticky
    ? []
    : entryRows.filter((entryRow) => committedById.get(entryRow.id) === true);

  const renderEntryRow = (
    entryRow: (typeof entryRows)[number],
    pinnedZ: string,
  ) => {
    const cellsById = new Map(
      entryRow.getAllCells().map((cell) => [cell.column.id, cell]),
    );
    const committed = committedById.get(entryRow.id) === true;
    return (
      <div
        key={entryRow.id}
        role="row"
        data-dg-part="entry-row"
        data-row-id={entryRow.id}
        data-new
        data-committed={committed}
        // The same marker body rows carry once committed, so one selector
        // reaches everything parked in the draft store.
        data-draft={committed}
        className={classes.entryRow}
      >
        {orderedColumns.map((column) => {
          const cell = cellsById.get(column.id);
          const layout = layoutFor(column.id);
          const editable =
            cell !== undefined && isEntryCellEditable(entryRow, column, edit);
          return (
            <div
              key={column.id}
              role="cell"
              data-column-id={column.id}
              data-align={getColumnAlign(column)}
              data-control-column={isControlColumn(column.id)}
              // A committed row re-opens where it is double-clicked, the
              // same gesture a body cell answers.
              onDoubleClick={
                committed && !isControlColumn(column.id)
                  ? () =>
                      edit.begin({
                        rowId: entryRow.id,
                        columnId: editable ? column.id : null,
                      })
                  : undefined
              }
              className={[
                classes.entryCell,
                layout.isBoundary && layout.pinnedAt === "left"
                  ? sticky.stickyLeft
                  : "",
                layout.isBoundary && layout.pinnedAt === "right"
                  ? sticky.stickyRight
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                minHeight: rowHeight,
                left: layout.pinnedAt === "left" ? layout.offset : undefined,
                right: layout.pinnedAt === "right" ? layout.offset : undefined,
                position: layout.pinnedAt ? "sticky" : undefined,
                zIndex: layout.pinnedAt ? pinnedZ : undefined,
              }}
            >
              {cell !== undefined && column.id === EDIT_COLUMN_ID ? (
                // The lane's cell - the entry row's controls.
                flexRender(cell.column.columnDef.cell, cell.getContext())
              ) : committed && cell !== undefined ? (
                // Entered, awaiting Save all: a value row through the
                // columns' own renderers, over the draft the memo above
                // fed this table.
                <span className={classes.cellContent}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </span>
              ) : editable && cell !== undefined ? (
                <TMDataGridCellEditor
                  cell={cell}
                  row={entryRow}
                  takeSeedText={() => undefined}
                  onClose={() => {}}
                  inEntryBlock
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {stickyRows.length > 0 && (
        <div
          ref={blockRef}
          role="rowgroup"
          data-dg-entry-block
          className={classes.entryBlock}
        >
          {stickyRows.map((entryRow) =>
            renderEntryRow(entryRow, "var(--dg-z-pinned-row-pinned-cell, 5)"),
          )}
        </div>
      )}
      {flowRows.length > 0 && (
        <div
          role="rowgroup"
          data-dg-entry-flow-block
          className={classes.entryFlowBlock}
        >
          {/* In flow, so a pinned cell stacks like a body row's, under the
              sticky blocks it scrolls past. */}
          {flowRows.map((entryRow) =>
            renderEntryRow(entryRow, "var(--dg-z-pinned-cell, 2)"),
          )}
        </div>
      )}
    </>
  );
}

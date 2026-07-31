import {
  flexRender,
  useTable,
  type Column,
  type Row,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useMemo } from "react";
import classes from "./TMDataGridTable.module.css";
import sticky from "./sticky.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import { getColumnAlign, isControlColumn } from "../core/columnUtils";
import { getEditFieldName } from "../core/editEngine";
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
 * the row, and an entry row is precisely not there yet — so the structural
 * half of the same rule is applied to the entry table's own row.
 */
function isEntryCellEditable(
  row: Row<TMDataGridFeatures, TMDataGridRowData>,
  column: ErasedColumn,
): boolean {
  if (isControlColumn(column.id)) return false;
  if (getEditFieldName(column) === null) return false;
  const editable = column.columnDef.meta?.editable;
  if (editable === false) return false;
  if (typeof editable === "function" && !editable(row)) return false;
  return true;
}

/**
 * The sticky entry block — one row of open editors per `edit.addRow()`,
 * pinned under the header. The one place stickiness is genuinely required:
 * an existing row that scrolls away has a place to scroll back to, a row
 * being typed into does not exist anywhere else.
 *
 * A second, tiny table instance over the new rows' seed values — same
 * columns, its own `useTable`, no sorting or filtering ever exercised — so
 * these are real `Cell`s and the editor host, the typed editors and the
 * validators all apply unchanged. The forms live in the same engine map as
 * every other draft, keyed by their temporary ids.
 *
 * Enter commits the entry (`onRowAdd`) under the immediate modes and parks
 * it under batch, where `submitAll` reports it in `added`; Escape discards
 * it. The edit lane, when present, offers the same pair as buttons.
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
  const { table, edit } = useTMDataGridContext();
  const newRows = useSelector(edit.store, (state) => state.newRows);

  // The seed values, frozen at addRow: the live values belong to the forms,
  // which the editors read directly — this table only provides row and cell
  // identity.
  const data = useMemo(
    () =>
      newRows.map(
        ({ tempId }) =>
          (edit.getForm(tempId)?.options.defaultValues ??
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

  return (
    <div role="rowgroup" className={classes.entryBlock}>
      {entryRows.map((entryRow) => {
        const cellsById = new Map(
          entryRow.getAllCells().map((cell) => [cell.column.id, cell]),
        );
        const firstEditableColumnId = orderedColumns.find((column) =>
          isEntryCellEditable(entryRow, column),
        )?.id;
        return (
          <div
            key={entryRow.id}
            role="row"
            data-testid={`dg-entry-${entryRow.id}`}
            className={classes.entryRow}
          >
            {orderedColumns.map((column) => {
              const cell = cellsById.get(column.id);
              const layout = layoutFor(column.id);
              const editable =
                cell !== undefined && isEntryCellEditable(entryRow, column);
              return (
                <div
                  key={column.id}
                  role="cell"
                  data-column-id={column.id}
                  data-align={getColumnAlign(column)}
                  data-control-column={isControlColumn(column.id)}
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
                    right:
                      layout.pinnedAt === "right" ? layout.offset : undefined,
                    position: layout.pinnedAt ? "sticky" : undefined,
                    zIndex: layout.pinnedAt
                      ? "var(--dg-z-pinned-row-pinned-cell, 5)"
                      : undefined,
                  }}
                >
                  {editable && cell !== undefined ? (
                    <TMDataGridCellEditor
                      cell={cell}
                      row={entryRow}
                      takeSeedText={() => undefined}
                      autoFocus={column.id === firstEditableColumnId}
                      onClose={() => {}}
                    />
                  ) : cell !== undefined && column.id === EDIT_COLUMN_ID ? (
                    // The lane's cell — the entry row's ✓/✕ pair.
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

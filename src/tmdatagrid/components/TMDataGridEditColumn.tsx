import { ActionIcon, Group, Loader, Tooltip } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import type { ReactElement } from "react";
import {
  useCellControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { firstErrorText } from "./editors/editorShared";
import {
  CheckIcon,
  CloseIcon,
  PencilIcon,
  RestoreIcon,
  TrashIcon,
} from "./icons";

export const EDIT_COLUMN_ID = "__edit__";

/**
 * The row error's tooltip. A pathless `.refine()` has no cell to mark, so the
 * message rides the lane's own button - and it opens itself rather than
 * waiting for a hover, because the two ways a commit is asked for both leave
 * the pointer somewhere else: a click on Save leaves it resting on a button
 * that only mounted its tooltip once the commit failed, so no fresh
 * mouseenter is ever fired, and Ctrl+Enter leaves it nowhere near the lane.
 * Hover still opens the field-error message, which the marked cells already
 * carry; only the row-level one insists.
 */
function RowErrorTooltip({
  message,
  insist,
  children,
}: {
  message: string | null;
  insist: boolean;
  children: ReactElement;
}) {
  if (message === null) return children;
  return (
    <Tooltip
      label={message}
      color="red"
      multiline
      maw={240}
      withArrow
      // `undefined` is uncontrolled - the hover behaviour, untouched.
      opened={insist ? true : undefined}
    >
      {children}
    </Tooltip>
  );
}

/**
 * One row's slot in the edit lane. Three states, driven off the edit store:
 * a pencil while idle, Save/Cancel while the row's form is open, a loader
 * while its commit is in flight. A row error turns the button red and puts
 * the message in `RowErrorTooltip`.
 */
function EditLaneCell<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const { edit, features, labels } = useTMDataGridContext();
  const tabIndex = useCellControlTabIndex();
  const rowId = row.id;
  const isOpen = useSelector(edit.store, (state) =>
    state.openRowIds.includes(rowId),
  );
  const projection = useSelector(edit.store, (state) => state.rows[rowId]);
  const isNew = useSelector(edit.store, (state) =>
    state.newRows.some((newRow) => newRow.tempId === rowId),
  );
  const isMarkedDeleted = useSelector(edit.store, (state) =>
    state.deletedRowIds.includes(rowId),
  );

  if (row.getIsGrouped()) return null;

  // The lane is where a blocked commit reports, on the entry row as much as
  // on an open one - so the message is read before either branch renders.
  const hasErrors =
    projection !== undefined &&
    (projection.hasRowError || projection.errorFields.length > 0);
  const rowError = hasErrors
    ? (firstErrorText(edit.getForm(rowId)?.state.errors ?? []) ??
      labels.editRowErrors)
    : null;
  // Only the pathless issue insists: a field issue is already on its cell.
  const insist = projection?.hasRowError === true;

  // An entry row: ✓ adds it (not under batch, where submitAll does), ✕
  // discards the entry.
  if (isNew) {
    return (
      <RowErrorTooltip message={rowError} insist={insist}>
        <Group gap={0} wrap="nowrap">
          {features.editMode !== "batch" && (
            <ActionIcon
              variant="subtle"
              color={hasErrors ? "red" : "green"}
              size="sm"
              tabIndex={tabIndex}
              aria-label={labels.confirmNewRow}
              data-dg-part="confirm-new-row"
              data-row-id={rowId}
              onClick={() => void edit.commit(rowId)}
            >
              <CheckIcon size={16} stroke={2} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            tabIndex={tabIndex}
            aria-label={labels.discardNewRow}
            data-dg-part="discard-new-row"
            data-row-id={rowId}
            onClick={() => edit.cancel(rowId)}
          >
            <CloseIcon size={16} stroke={1.6} />
          </ActionIcon>
        </Group>
      </RowErrorTooltip>
    );
  }

  // A batch deletion mark is a draft like any other - restorable in place.
  if (isMarkedDeleted) {
    return (
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        tabIndex={tabIndex}
        aria-label={labels.restoreRow}
        data-dg-part="restore-row"
        data-row-id={rowId}
        onClick={(event) => {
          event.stopPropagation();
          edit.deleteRow(rowId);
        }}
      >
        <RestoreIcon size={16} stroke={1.6} />
      </ActionIcon>
    );
  }

  // The pencil means "this row edits"; a row that does not gets nothing.
  if (!edit.canEditRow(row as never)) return null;

  if (!isOpen) {
    return (
      <Group gap={0} wrap="nowrap">
        {features.editMode === "row" && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            tabIndex={tabIndex}
            aria-label={labels.editRow}
            data-dg-part="edit-row"
            data-row-id={rowId}
            onClick={(event) => {
              event.stopPropagation();
              edit.begin({ rowId, columnId: null });
            }}
          >
            <PencilIcon size={16} stroke={1.6} />
          </ActionIcon>
        )}
        {edit.canDeleteRows() && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            tabIndex={tabIndex}
            aria-label={labels.deleteRow}
            data-dg-part="delete-row"
            data-row-id={rowId}
            onClick={(event) => {
              event.stopPropagation();
              edit.deleteRow(rowId);
            }}
          >
            <TrashIcon size={16} stroke={1.6} />
          </ActionIcon>
        )}
      </Group>
    );
  }

  if (projection?.isSubmitting) {
    return <Loader size="xs" aria-label={labels.loading} />;
  }

  const save = (
    <ActionIcon
      variant="subtle"
      color={hasErrors ? "red" : "green"}
      size="sm"
      tabIndex={tabIndex}
      aria-label={labels.saveRow}
      data-dg-part="save-row"
      data-row-id={rowId}
      onClick={(event) => {
        event.stopPropagation();
        void edit.commit(rowId);
      }}
    >
      <CheckIcon size={16} stroke={2} />
    </ActionIcon>
  );

  return (
    <Group gap={0} wrap="nowrap">
      <RowErrorTooltip message={rowError} insist={insist}>
        {save}
      </RowErrorTooltip>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        tabIndex={tabIndex}
        aria-label={labels.cancelRowEdit}
        data-dg-part="cancel-row"
        data-row-id={rowId}
        onClick={(event) => {
          event.stopPropagation();
          edit.cancel(rowId);
        }}
      >
        <CloseIcon size={16} stroke={1.6} />
      </ActionIcon>
    </Group>
  );
}

/**
 * The generated edit lane, appended and pinned right under
 * `editMode: "row"` - the row's Save at the end of the row, mirroring the
 * checkbox lane's build on the left.
 */
export function createEditColumn<TData extends RowData>(
  label = "Edit",
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  return {
    id: EDIT_COLUMN_ID,
    meta: {
      label,
      align: "center",
      enableOrdering: false,
    },
    // Wide enough for the Save/Cancel pair it holds while editing.
    size: 64,
    minSize: 64,
    maxSize: 64,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Structurally pinned to the right; not movable.
    enablePinning: false,
    header: () => null,
    cell: ({ row }) => <EditLaneCell row={row} />,
    // Group rows: same reasoning as the checkbox lane - without this the
    // cell renders blank on aggregated rows, but here blank is also correct,
    // so the aggregated cell renders the same (null for groups).
    aggregatedCell: ({ row }) => <EditLaneCell row={row} />,
  };
}

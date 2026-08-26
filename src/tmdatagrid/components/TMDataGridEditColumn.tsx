import { ActionIcon, Group, Loader, Tooltip } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import classes from "./TMDataGridTable.module.css";
import {
  useCellControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { firstErrorText } from "../core/editEngine";
import {
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  RestoreIcon,
  TrashIcon,
} from "./icons";

export const EDIT_COLUMN_ID = "__edit__";

/**
 * The draft store's change marker in the lane - what kind of change the row
 * is holding for the save. Non-interactive; the buttons beside it act.
 * `data-state` is the styling hook, `data-error` flips it red and puts the
 * message in the tooltip in place of the state's name.
 */
function RowStateIndicator({
  state,
  rowId,
  label,
  error,
}: {
  state: "new" | "edited" | "deleted";
  rowId: string;
  label: string;
  error: string | null;
}) {
  const Icon =
    state === "new" ? PlusIcon : state === "edited" ? PencilIcon : TrashIcon;
  return (
    <Tooltip label={error ?? label} withArrow>
      <span
        role="img"
        aria-label={label}
        data-dg-part="row-state"
        data-state={state}
        data-row-id={rowId}
        data-error={error !== null || undefined}
        className={classes.rowStateIndicator}
      >
        <Icon size={16} stroke={1.6} />
      </span>
    </Tooltip>
  );
}

/**
 * One row's slot in the edit lane, driven off the edit store. Two things
 * decide what it holds, and they are the two axes of `editing`:
 *
 * | Row is | Lane holds | From |
 * | ------ | ---------- | ---- |
 * | parked in the draft store | the change marker and the way back out - revert, discard or restore | `editing.draft` |
 * | open | the mode's own controls: Save and Cancel | `editing.mode` |
 * | neither | the pencil (row mode) and the trash | `editing.mode` |
 *
 * A row error turns the Save red with the message in its tooltip - a
 * pathless `.refine()` has nowhere else to land, and a field error outlives
 * the editor that found it. A parked row never offers a save: it has had its
 * submit, and `TMDataGrid.DraftActions` is what sends it.
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
  const isConfirmedNew = useSelector(
    edit.store,
    (state) =>
      state.newRows.find((newRow) => newRow.tempId === rowId)?.committed ===
      true,
  );
  // Parked: the row passed its submit and is waiting for the save. A subset
  // of the open rows, so it is asked about first - the two overlap.
  const isCommitted = useSelector(edit.store, (state) =>
    state.committedRowIds.includes(rowId),
  );
  const isMarkedDeleted = useSelector(edit.store, (state) =>
    state.deletedRowIds.includes(rowId),
  );

  if (row.getIsGrouped()) return null;

  const hasErrors =
    projection !== undefined &&
    (projection.hasRowError || projection.errorFields.length > 0);
  // The row's own message first - a pathless issue is about the row - then
  // the first field's, which is what a failed commit left behind.
  const rowError = hasErrors
    ? (firstErrorText(edit.getForm(rowId)?.state.errors ?? []) ??
      projection.errorMessages[0]?.message ??
      labels.editRowErrors)
    : null;

  const trash = edit.canDeleteRows() ? (
    <Tooltip label={labels.deleteRow} withArrow>
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
    </Tooltip>
  ) : null;

  // An entry row: ✓ enters it - an add, or a park under `editing.draft` -
  // and ✕ discards the entry. A parked entry waits for the save as a value
  // row: marked new, re-openable, still discardable.
  if (isNew) {
    if (isConfirmedNew) {
      return (
        <Group gap={0} wrap="nowrap">
          <RowStateIndicator
            state="new"
            rowId={rowId}
            label={labels.rowStateNew}
            error={rowError}
          />
          <Tooltip label={labels.editRow} withArrow>
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
          </Tooltip>
          <Tooltip label={labels.discardNewRow} withArrow>
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
          </Tooltip>
        </Group>
      );
    }
    return (
      <Group gap={0} wrap="nowrap">
        <Tooltip label={labels.confirmNewRow} withArrow>
          <ActionIcon
            variant="subtle"
            color="green"
            size="sm"
            tabIndex={tabIndex}
            aria-label={labels.confirmNewRow}
            data-dg-part="confirm-new-row"
            data-row-id={rowId}
            onClick={() => void edit.commit(rowId)}
          >
            <CheckIcon size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={labels.discardNewRow} withArrow>
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
        </Tooltip>
      </Group>
    );
  }

  // A deletion mark is a draft like any other - restorable in place.
  if (isMarkedDeleted) {
    return (
      <Group gap={0} wrap="nowrap">
        <RowStateIndicator
          state="deleted"
          rowId={rowId}
          label={labels.rowStateDeleted}
          error={null}
        />
        <Tooltip label={labels.restoreRow} withArrow>
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
        </Tooltip>
      </Group>
    );
  }

  // The pencil means "this row edits"; a row that does not gets nothing.
  if (!edit.canEditRow(row as never)) return null;

  if (projection?.isSubmitting) {
    return <Loader size="xs" aria-label={labels.loading} />;
  }

  // Parked in the draft store: the mark, and the way back out. No trash
  // beside the revert - the two undo-shaped icons were too easy to mistake
  // for one another, so a drafted row reverts first, then deletes.
  if (isCommitted) {
    return (
      <Group gap={0} wrap="nowrap">
        <RowStateIndicator
          state="edited"
          rowId={rowId}
          label={labels.rowStateEdited}
          error={rowError}
        />
        <Tooltip label={labels.revertRow} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            tabIndex={tabIndex}
            aria-label={labels.revertRow}
            data-dg-part="revert-row"
            data-row-id={rowId}
            onClick={(event) => {
              event.stopPropagation();
              edit.cancel(rowId);
            }}
          >
            <RestoreIcon size={16} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  }

  if (!isOpen) {
    return (
      <Group gap={0} wrap="nowrap">
        {features.editMode === "row" && (
          <Tooltip label={labels.editRow} withArrow>
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
          </Tooltip>
        )}
        {trash}
      </Group>
    );
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
      {rowError === null ? (
        <Tooltip label={labels.saveRow} withArrow>
          {save}
        </Tooltip>
      ) : (
        <Tooltip label={rowError} withArrow>
          {save}
        </Tooltip>
      )}
      <Tooltip label={labels.cancelRowEdit} withArrow>
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
      </Tooltip>
    </Group>
  );
}

/**
 * The generated edit lane, appended and pinned right - the row's Save at the
 * end of the row under `mode: "row"`, the state marker and revert under
 * `editing.draft`, mirroring the checkbox lane's build on the left.
 */
export function createEditColumn<TData extends RowData>(
  label = "Edit",
  /** A draft lane holds three controls where the rest hold two. */
  wide = false,
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  const width = wide ? 88 : 64;
  return {
    id: EDIT_COLUMN_ID,
    meta: {
      label,
      align: "center",
      enableOrdering: false,
    },
    // Wide enough for the pair (or draft's trio) it holds while editing.
    size: width,
    minSize: width,
    maxSize: width,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // The row's Save, Cancel and Delete live here, so hiding the lane would
    // strand an open row with no way to commit or discard it. Same rule as the
    // checkbox lane: chrome the grid generates is not a user setting.
    enableHiding: false,
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

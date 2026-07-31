import { ActionIcon, Group, Loader, Tooltip } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import {
  useCellControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { firstErrorText } from "./editors/editorShared";
import { CheckIcon, CloseIcon, PencilIcon } from "./icons";

export const EDIT_COLUMN_ID = "__edit__";

/**
 * One row's slot in the edit lane. Three states, driven off the edit store:
 * a pencil while idle, Save/Cancel while the row's form is open, a loader
 * while its commit is in flight. A row error turns the Save red and puts the
 * message in its tooltip — the pathless `.refine()` has nowhere else to land.
 */
function EditLaneCell<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const { edit, labels } = useTMDataGridContext();
  const tabIndex = useCellControlTabIndex();
  const rowId = row.id;
  const isOpen = useSelector(edit.store, (state) =>
    state.openRowIds.includes(rowId),
  );
  const projection = useSelector(edit.store, (state) => state.rows[rowId]);

  if (row.getIsGrouped()) return null;

  // The pencil means "this row edits"; a row that does not gets nothing.
  if (!edit.canEditRow(row as never)) return null;

  if (!isOpen) {
    return (
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        tabIndex={tabIndex}
        aria-label={labels.editRow}
        onClick={(event) => {
          event.stopPropagation();
          edit.begin({ rowId, columnId: null });
        }}
      >
        <PencilIcon size={16} stroke={1.6} />
      </ActionIcon>
    );
  }

  if (projection?.isSubmitting) {
    return <Loader size="xs" aria-label={labels.loading} />;
  }

  const hasErrors =
    projection !== undefined &&
    (projection.hasRowError || projection.errorFields.length > 0);
  const rowError = hasErrors
    ? (firstErrorText(edit.getForm(rowId)?.state.errors ?? []) ??
      labels.editRowErrors)
    : null;

  const save = (
    <ActionIcon
      variant="subtle"
      color={hasErrors ? "red" : "green"}
      size="sm"
      tabIndex={tabIndex}
      aria-label={labels.saveRow}
      data-dg-save-row
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
        save
      ) : (
        <Tooltip label={rowError} withArrow>
          {save}
        </Tooltip>
      )}
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        tabIndex={tabIndex}
        aria-label={labels.cancelRowEdit}
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
 * `editMode: "row"` — the row's Save at the end of the row, mirroring the
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
    // Group rows: same reasoning as the checkbox lane — without this the
    // cell renders blank on aggregated rows, but here blank is also correct,
    // so the aggregated cell renders the same (null for groups).
    aggregatedCell: ({ row }) => <EditLaneCell row={row} />,
  };
}

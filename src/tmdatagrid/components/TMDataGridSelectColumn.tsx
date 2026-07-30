import { Checkbox } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { useTMDataGridContext } from "../TMDataGridContext";
import {
  getDisplayedRows,
  getSelectableRowIds,
  resolveRowSelectionClick,
} from "../core/rowSelection";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

export const SELECT_COLUMN_ID = "__select__";

/**
 * Both checkboxes subscribe to the table store themselves rather than reading
 * the selection off the render they were handed.
 *
 * A cell is rendered by `flexRender`, which mounts the cell function as its own
 * component — but the body cell above it keeps the same props across a
 * selection change (row, column and layout identities all survive it), so the
 * React Compiler reuses the memoized element and the subtree never re-renders.
 * The row highlight would update, from state `TMDataGridTable` subscribes to,
 * while the box below it stayed unchecked.
 *
 * Selection is derived inside the selector, not from a method call in the
 * component body, for the same reason: `table` and `row` identities survive the
 * change, so a call in the body would be cached along with them.
 */
function SelectAllCheckbox<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const allSelected = useSelector(table.store, () =>
    table.getIsAllRowsSelected(),
  );
  const someSelected = useSelector(table.store, () =>
    table.getIsSomeRowsSelected(),
  );

  return (
    <Checkbox
      size="xs"
      aria-label="Select all rows"
      checked={allSelected}
      indeterminate={someSelected && !allSelected}
      onChange={table.getToggleAllRowsSelectedHandler()}
    />
  );
}

/**
 * Drops the select-all box when only one row may be selected. Read from the
 * feature flags rather than `table.options.enableMultiRowSelection` directly:
 * the flags are re-derived from a fresh object every render, so the switch
 * cannot be cached along with a `table` identity that survives an options
 * change — the same reason the rest of the chrome reads them. See
 * readFeatureFlags.
 */
function SelectAllHeader<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const { features } = useTMDataGridContext();
  if (!features.multiRowSelection) return null;
  return <SelectAllCheckbox table={table} />;
}

function SelectRowCheckbox<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  // Cells render inside the grid's provider, so the checkbox can reach the
  // chrome store — it needs the shift-click pivot, and the feature flags to know
  // which row model a range is measured over.
  const { ui, features } = useTMDataGridContext();
  const isGroupRow = row.subRows.length > 0;

  // A group row is never selected by id: `rowSelection` only ever holds the
  // leaves, and TanStack's `getIsSelected()` is a plain lookup in that map. So
  // a group asks about its descendants instead, which is also the honest
  // reading — the box means "all of these", and it goes indeterminate as soon
  // as that stops being true.
  const selected = useSelector(row.table.store, () =>
    isGroupRow ? row.getIsAllSubRowsSelected() : row.getIsSelected(),
  );
  const someSelected = useSelector(row.table.store, () =>
    row.getIsSomeSelected(),
  );

  // The resolver expands a tick back out to the descendant ids; all the group
  // case needs here is to know whether any of them may be selected at all.
  const selectableIds = getSelectableRowIds(row);

  // Single-select has no way to express "this group": one box for several rows
  // would either overrun the limit or lie about what it did.
  if (isGroupRow && !row.getCanMultiSelect()) return null;

  return (
    <Checkbox
      size="xs"
      aria-label={isGroupRow ? "Select group" : "Select row"}
      checked={selected}
      disabled={selectableIds.length === 0}
      indeterminate={someSelected && !selected}
      // Every tick goes through the resolver, shift held or not — plain becomes
      // a toggle that moves the pivot, so a later shift-click extends from the
      // box the user last touched.
      //
      // All of it in `onChange`, not split with an `onClick`: React derives a
      // checkbox's change event from the click, so the modifier keys ride along
      // on the native event, and a `preventDefault()` in a click handler cannot
      // stop the change from firing anyway. Trying to do the range in `onClick`
      // silently loses the clicked row, which `onChange` then toggles back off.
      onChange={(event) => {
        const native = event.nativeEvent;
        const isMouse = native instanceof MouseEvent;
        const resolved = resolveRowSelectionClick({
          rows: getDisplayedRows(row.table, features),
          rowId: row.id,
          anchorRowId: ui.state.selectionAnchorRowId,
          modifiers: {
            toggle: isMouse && (native.ctrlKey || native.metaKey),
            extend: isMouse && native.shiftKey,
          },
          selection: row.table.store.state.rowSelection,
          // A checkbox is only ever additive — ticking one has never cleared
          // the others, so `canReplaceSelection` stays false whatever is held.
          canReplaceSelection: false,
        });
        row.table.setRowSelection(resolved.selection);
        ui.actions.setSelectionAnchor(resolved.anchorRowId);
      }}
      // A row can select on click too; the checkbox must not toggle twice.
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/**
 * The generated checkbox column, prepended under
 * `selectionMode: "checkbox"` (the default) or `"checkboxAndHighlight"`.
 */
export function createSelectColumn<TData extends RowData>(): ColumnDef<
  TMDataGridFeatures,
  TData,
  unknown
> {
  return {
    id: SELECT_COLUMN_ID,
    meta: {
      label: "Checkbox selection",
      align: "center",
      // Structurally the first column; it also anchors the left pinned lane, so
      // no other column can be moved in front of it.
      enableOrdering: false,
    },
    size: 48,
    minSize: 48,
    maxSize: 48,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Structurally pinned to the left; users shouldn't be able to move it.
    enablePinning: false,
    header: ({ table }) => <SelectAllHeader table={table} />,
    cell: ({ row }) => <SelectRowCheckbox row={row} />,
    // Every cell on a group row that is not the grouped column counts as
    // aggregated, this lane included, and an aggregated cell with nothing
    // declared renders blank. Without this the checkbox would disappear from
    // exactly the rows that select a whole group. See renderCellContent.
    aggregatedCell: ({ row }) => <SelectRowCheckbox row={row} />,
  };
}

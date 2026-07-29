import { Checkbox } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures, TMDataGridTable } from "./useTMDataGrid";

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

function SelectRowCheckbox<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const selected = useSelector(row.table.store, () => row.getIsSelected());
  const someSelected = useSelector(row.table.store, () =>
    row.getIsSomeSelected(),
  );

  return (
    <Checkbox
      size="xs"
      aria-label="Select row"
      checked={selected}
      disabled={!row.getCanSelect()}
      indeterminate={someSelected && !selected}
      onChange={row.getToggleSelectedHandler()}
      // A row can select on click too; the checkbox must not toggle twice.
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/**
 * The generated checkbox column, prepended under
 * `rowSelectionMode: "checkbox"` — the default whenever row selection is on.
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
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => <SelectRowCheckbox row={row} />,
  };
}

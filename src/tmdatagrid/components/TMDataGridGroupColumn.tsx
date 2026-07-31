import { UnstyledButton } from "@mantine/core";
import {
  useCellControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import classes from "./TMDataGridGroupColumn.module.css";
import { ChevronRightIcon } from "./icons";
import { getColumnLabel } from "../core/columnUtils";
import { getGroupDataRows } from "../core/grouping";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

export const GROUP_COLUMN_ID = "__group__";

/** Indent added per level of nesting, in px. */
const INDENT_STEP = 16;

/** Shown for a group whose value is empty — `String(null)` would read as "null". */
const BLANK_GROUP_LABEL = "(Blank)";

/**
 * How a grouping value is written into the tree cell.
 *
 * Deliberately not the grouped column's own `cell` renderer: that renderer is
 * written for a data row and is free to reach into `row.original`, which on a
 * group row is the first leaf's record rather than anything about the group.
 */
export function formatGroupValue(
  value: unknown,
  blankLabel = BLANK_GROUP_LABEL,
): string {
  if (value === null || value === undefined || value === "") {
    return blankLabel;
  }
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

/**
 * The tree cell: chevron, group value and leaf count, indented by depth.
 *
 * Expansion is read through a subscription rather than from `row.getIsExpanded()`
 * in the component body for the same reason the select checkbox does it — the
 * `row` identity survives an expand, so the React Compiler would cache the call
 * along with it and the chevron would never turn. See TMDataGridSelectColumn.
 */
function GroupCell<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const { labels } = useTMDataGridContext();
  const expanded = useSelector(row.table.store, () => row.getIsExpanded());
  // See useCellControlTabIndex: reached by stepping into the cell, not by Tab.
  const tabIndex = useCellControlTabIndex();

  // Leaf rows keep the lane empty: their values are in the data columns, and
  // the indent alone is what places them under their group.
  if (!row.getIsGrouped()) return null;

  const label = formatGroupValue(row.groupingValue, labels.blankGroupValue);

  return (
    <UnstyledButton
      className={classes.groupToggle}
      // Padding rather than margin, so the whole indented width stays clickable.
      style={{ paddingInlineStart: row.depth * INDENT_STEP }}
      tabIndex={tabIndex}
      aria-expanded={expanded}
      aria-label={
        expanded ? labels.collapseGroup(label) : labels.expandGroup(label)
      }
      // The row underneath may select or highlight on click; expanding is its
      // own gesture and must not also trigger those.
      onClick={(event) => {
        event.stopPropagation();
        row.toggleExpanded();
      }}
    >
      <span className={classes.chevron} data-expanded={expanded}>
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
      <span className={classes.groupLabel}>{label}</span>
      {/* Data rows, not direct children and not `getLeafRows()`: a nested group
          counts the records under it, never the sub-groups in between. */}
      <span className={classes.groupCount}>
        ({getGroupDataRows(row).length})
      </span>
    </UnstyledButton>
  );
}

/**
 * Names the columns currently grouped on, so the lane says what it is showing
 * rather than a static "Group".
 */
function GroupHeader<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const { labels } = useTMDataGridContext();
  const grouping = useSelector(table.store, (state) => state.grouping, {
    compare: shallow,
  });

  if (grouping.length === 0) return labels.groupColumnLabel;
  return grouping
    .map((columnId) => {
      const column = table.getColumn(columnId);
      return column ? getColumnLabel(column) : columnId;
    })
    .join(" / ");
}

/**
 * The generated tree column, prepended whenever grouping is enabled and hidden
 * again while `grouping` is empty — see the visibility effect in
 * `useTMDataGrid`.
 *
 * It exists because TanStack ships no auto group column: `groupedColumnMode:
 * "remove"` takes the grouped column out of the grid, so something has to hold
 * the tree. Modelled on the checkbox column, which is generated the same way.
 *
 * Not groupable itself, and nothing had to be written to make that true —
 * `column.getCanGroup()` requires an `accessorFn`, which a display column has
 * no reason to have.
 */
export function createGroupColumn<TData extends RowData>(
  label = "Group",
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  return {
    id: GROUP_COLUMN_ID,
    meta: {
      label,
      // Structurally the first column after the checkbox lane.
      enableOrdering: false,
    },
    size: 260,
    minSize: 180,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Keeps it out of the columns panel and out of the header menu: its
    // visibility is not the user's to set, it follows the grouping state.
    enableHiding: false,
    // Structurally pinned to the left; users shouldn't be able to move it.
    enablePinning: false,
    cell: ({ row }) => <GroupCell row={row} />,
    // A group row has subRows, so every cell on it that is not the grouped
    // column reports `getIsAggregated()` — this lane included. Without an
    // `aggregatedCell` the body would take that as "nothing to summarise" and
    // render the tree lane blank on exactly the rows it exists for.
    aggregatedCell: ({ row }) => <GroupCell row={row} />,
    header: ({ table }) => <GroupHeader table={table} />,
  };
}

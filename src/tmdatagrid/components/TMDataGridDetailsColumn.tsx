import { UnstyledButton } from "@mantine/core";
import { useCellControlTabIndex } from "../TMDataGridContext";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import classes from "./TMDataGridDetailsColumn.module.css";
import { ChevronRightIcon } from "./icons";
import { areAllRowsExpanded, resolveExpandAll } from "../core/expanding";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

export const DETAILS_COLUMN_ID = "__details__";

/**
 * The chevron that opens a row's detail panel.
 *
 * Expansion is read through a subscription rather than from
 * `row.getIsExpanded()` in the component body: the `row` identity survives an
 * expand, so the React Compiler would cache the call along with it and the
 * chevron would never turn. Same reason the select checkbox subscribes.
 */
function DetailsCell<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const expanded = useSelector(row.table.store, () => row.getIsExpanded());
  // See useCellControlTabIndex: a body control is reached by stepping into its
  // cell, not by Tab, or the grid would have one tab stop per mounted row.
  const tabIndex = useCellControlTabIndex();

  // Group rows open into their children, not into a panel — see the body's
  // `showsDetails`. Their cells are aggregated, so this lane is already blank
  // on them; the guard is what makes that a decision rather than a side effect.
  if (row.getIsGrouped()) return null;

  return (
    <UnstyledButton
      className={classes.detailsToggle}
      tabIndex={tabIndex}
      aria-expanded={expanded}
      aria-label={expanded ? "Hide details" : "Show details"}
      // The row underneath may select or highlight on click; opening a panel is
      // its own gesture and must not also trigger those.
      onClick={(event) => {
        event.stopPropagation();
        row.toggleExpanded();
      }}
    >
      <span className={classes.chevron} data-expanded={expanded}>
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
    </UnstyledButton>
  );
}

/**
 * Expand-all / collapse-all for the lane, the way the checkbox column's header
 * selects and clears every row.
 *
 * Deliberately not `table.toggleAllRowsExpanded()`: that writes the `expanded`
 * state's whole-table form, and one state holds both the tree and the panels —
 * so it would unfold every group as well. Only the data rows are touched here;
 * whatever the tree was showing, it goes on showing. See resolveExpandAll.
 */
function DetailsHeader<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  // Pre-paginated: expand-all means every row the filters left, not the page
  // that happens to be on screen. Same model `getCanSomeRowsExpand` reads.
  const detailRows = () => table.getPrePaginatedRowModel().flatRows;

  const allExpanded = useSelector(table.store, (state) =>
    areAllRowsExpanded({
      rows: detailRows(),
      expanded: state.expanded,
      target: "details",
    }),
  );

  return (
    <UnstyledButton
      className={classes.detailsToggle}
      aria-expanded={allExpanded}
      aria-label={allExpanded ? "Collapse all details" : "Expand all details"}
      // Partly expanded opens the rest rather than closing what is already
      // open — the same reading as an indeterminate select-all box.
      onClick={() =>
        table.setExpanded(
          resolveExpandAll({
            rows: detailRows(),
            expanded: table.store.state.expanded,
            target: "details",
            expand: !allExpanded,
          }),
        )
      }
    >
      <span className={classes.chevron} data-expanded={allExpanded}>
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
    </UnstyledButton>
  );
}

/**
 * The generated details lane, prepended whenever `renderDetails` is set.
 *
 * Structural, like the checkbox and tree columns: fixed width, pinned to the
 * left after both of them, not hideable, not movable and not resizable. A
 * toggle that wandered off to the right of the grid — or hid itself — would
 * leave rows with panels no one can open.
 *
 * Last of the three because it acts on one record: the checkbox picks rows out
 * and the tree says which group they are in, and only then is there a row to
 * open.
 *
 * Nothing stops a second toggle elsewhere: `row.toggleExpanded()` is the whole
 * interface, and this lane is only the one the grid ships.
 */
export function createDetailsColumn<TData extends RowData>(): ColumnDef<
  TMDataGridFeatures,
  TData,
  unknown
> {
  return {
    id: DETAILS_COLUMN_ID,
    meta: {
      label: "Details",
      align: "center",
      // Structurally the last of the generated lanes.
      enableOrdering: false,
    },
    // A system lane: as wide as the control it holds and no wider. Fixed at
    // every scale — the control does not grow with the font size, so neither
    // should its track.
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Its visibility is not the user's to set: hiding it would strand every
    // panel behind a control that is no longer there.
    enableHiding: false,
    // Structurally pinned to the left; users shouldn't be able to move it.
    enablePinning: false,
    header: ({ table }) => <DetailsHeader table={table} />,
    cell: ({ row }) => <DetailsCell row={row} />,
    // Deliberately no `aggregatedCell`: on a group row every cell outside the
    // grouped column counts as aggregated, and blank is the right answer here —
    // groups expand into their rows, not into a panel.
  };
}

import { ActionIcon, Group, Select, Text, Tooltip } from "@mantine/core";
import type { RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import classes from "./TMDataGridFooter.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getGridCapabilities } from "../core/capabilities";
import { isPagingActive } from "../core/rowSelection";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import type { TMDataGridTable } from "../useTMDataGrid";

/** Distilled pagination state and actions for building a custom pager. */
export type TMDataGridPaginationApi = {
  pageIndex: number;
  pageSize: number;
  /** `-1` when a manual grid declares `pageCount: -1` (unknown total). */
  pageCount: number;
  rowCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  previousPage: () => void;
  nextPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
};

/**
 * Reads {@link TMDataGridPaginationApi} off a table. The Footer feeds it to the
 * `pagination` render prop; a pager living outside the Footer can call it with
 * the table from `useTMDataGrid` directly.
 */
export function getTMDataGridPaginationApi<TData extends RowData>(
  table: TMDataGridTable<TData>,
): TMDataGridPaginationApi {
  const { pageIndex, pageSize } = table.store.state.pagination;
  return {
    pageIndex,
    pageSize,
    pageCount: table.getPageCount(),
    rowCount: table.getRowCount(),
    canPreviousPage: table.getCanPreviousPage(),
    canNextPage: table.getCanNextPage(),
    setPageIndex: (index) => table.setPageIndex(index),
    setPageSize: (size) => table.setPageSize(size),
    previousPage: () => table.previousPage(),
    nextPage: () => table.nextPage(),
    firstPage: () => table.firstPage(),
    lastPage: () => table.lastPage(),
  };
}

export type TMDataGridFooterProps = {
  pageSizeOptions?: ReadonlyArray<number>;
  /** Replaces the built-in pager. Receives the distilled pagination API. */
  pagination?: (api: TMDataGridPaginationApi) => ReactNode;
};

/**
 * MUI-style pager: "Rows per page · from–to of total · ‹ ›".
 *
 * Renders nothing unless pagination is enabled (`enablePagination` or
 * `manualPagination`) - the footer is a pager; extra footer content belongs in
 * your own layout.
 *
 * Row totals come from `table.getRowCount()`, which prefers `options.rowCount`
 * - so a server-paged grid shows the server's total without changes here.
 */
export function TMDataGridFooter({
  pageSizeOptions = [10, 25, 50, 100],
  pagination,
}: TMDataGridFooterProps) {
  const { table, features, labels, controlSize } = useTMDataGridContext();
  useSelector(table.store);

  if (!getGridCapabilities(table, features).canPaginate) return null;

  if (pagination) {
    return (
      <div data-dg-part="footer" className={classes.footer}>
        {pagination(getTMDataGridPaginationApi(table))}
      </div>
    );
  }

  // Grouping suspends paging - see isPagingActive. The pager is greyed out
  // rather than dropped, so that a footer going quiet reads as a state the grid
  // is in rather than as something that broke.
  const paging = isPagingActive(table, features);
  const { pageIndex, pageSize } = table.store.state.pagination;
  const total = table.getRowCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  // A page size restored from storage, or set through `initialState`, need not
  // be one of the offered sizes. Without it in the list the Select renders
  // blank, so the current size is folded in rather than shown as nothing.
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <Tooltip
      label={labels.pagingSuspendedHint}
      disabled={paging}
      withArrow
      multiline
      w={260}
      position="top"
    >
      <div
        data-dg-part="footer"
        className={classes.footer}
        data-paging-suspended={!paging}
      >
        <Group gap="xs" wrap="nowrap">
          {/* `span`, here and in every other label the grid renders: Mantine's
              Text is a `<p>` by default, and a grid dropped into prose - a
              docs page, a CMS body, Mantine's own Typography - picks up that
              context's `p` margins. A bottom margin on a flex item shifts its
              border box up off centre, which is how the pager came to sit a
              half-line below its own label. Chrome labels are not prose. */}
          <Text span size={controlSize} c="dimmed">
            {labels.rowsPerPage}
          </Text>
          <Select
            size={controlSize}
            w={78}
            allowDeselect={false}
            variant="unstyled"
            disabled={!paging}
            data-dg-part="page-size"
            data={sizeOptions.map(String)}
            value={String(pageSize)}
            onChange={(value) => {
              table.setPageSize(Number(value) || pageSizeOptions[0]);
              table.setPageIndex(0);
            }}
          />
        </Group>

        <Text span size={controlSize} c="dimmed" data-dg-part="page-range">
          {paging
            ? labels.pageRange({ from, to, total })
            : // Not a range: nothing is being sliced, so a range would be a lie.
              // Counted before grouping too - `getRowCount()` would be counting
              // the tree, so a collapsed grid would claim to hold eight rows.
              labels.groupedAllRows(table.getFilteredRowModel().rows.length)}
        </Text>

        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={labels.previousPage}
            data-dg-part="page-prev"
            disabled={!paging || !table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeftIcon size={18} stroke={1.6} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={labels.nextPage}
            data-dg-part="page-next"
            disabled={!paging || !table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRightIcon size={18} stroke={1.6} />
          </ActionIcon>
        </Group>
      </div>
    </Tooltip>
  );
}

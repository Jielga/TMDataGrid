import { ActionIcon, Group, Select, Text } from "@mantine/core";
import type { RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import classes from "./TMDataGridFooter.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getGridCapabilities } from "../core/capabilities";
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
 * `manualPagination`) — the footer is a pager; extra footer content belongs in
 * your own layout.
 *
 * Row totals come from `table.getRowCount()`, which prefers `options.rowCount`
 * — so a server-paged grid shows the server's total without changes here.
 */
export function TMDataGridFooter({
  pageSizeOptions = [10, 25, 50, 100],
  pagination,
}: TMDataGridFooterProps) {
  const { table, features, controlSize } = useTMDataGridContext();
  useSelector(table.store);

  if (!getGridCapabilities(table, features).canPaginate) return null;

  if (pagination) {
    return (
      <div className={classes.footer}>
        {pagination(getTMDataGridPaginationApi(table))}
      </div>
    );
  }

  const { pageIndex, pageSize } = table.store.state.pagination;
  const total = table.getRowCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className={classes.footer}>
      <Group gap="xs" wrap="nowrap">
        <Text size={controlSize} c="dimmed">
          Rows per page:
        </Text>
        <Select
          size={controlSize}
          w={78}
          allowDeselect={false}
          variant="unstyled"
          data={pageSizeOptions.map(String)}
          value={String(pageSize)}
          onChange={(value) => {
            table.setPageSize(Number(value) || pageSizeOptions[0]);
            table.setPageIndex(0);
          }}
        />
      </Group>

      <Text size={controlSize} c="dimmed">
        {from}–{to} of {total}
      </Text>

      <Group gap={4} wrap="nowrap">
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Previous page"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          <ChevronLeftIcon size={18} stroke={1.6} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Next page"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          <ChevronRightIcon size={18} stroke={1.6} />
        </ActionIcon>
      </Group>
    </div>
  );
}

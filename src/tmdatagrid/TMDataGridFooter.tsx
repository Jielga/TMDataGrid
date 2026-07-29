import { ActionIcon, Group, Select, Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import classes from "./TMDataGrid.module.css";
import { useTMDataGridContext } from "./TMDataGridContext.js";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.js";

export type TMDataGridFooterProps = {
  pageSizeOptions?: ReadonlyArray<number>;
};

/**
 * MUI-style pager: "Rows per page · from–to of total · ‹ ›".
 *
 * Row totals come from `table.getRowCount()`, which prefers `options.rowCount`
 * — so a server-paged grid shows the server's total without changes here.
 */
export function TMDataGridFooter({
  pageSizeOptions = [10, 25, 50, 100],
}: TMDataGridFooterProps) {
  const { table, controlSize } = useTMDataGridContext();
  useSelector(table.store);

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

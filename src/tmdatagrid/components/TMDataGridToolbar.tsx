import { ActionIcon, Popover, Text, Tooltip } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import classes from "./TMDataGridToolbar.module.css";
import { TMDataGridColumnsPanel } from "./TMDataGridColumnsPanel";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getGridCapabilities } from "../core/capabilities";
import { isFilterActive } from "../core/filterOperators";
import { BurgerIcon, FilterIcon } from "./icons";
import { openColumnFilter } from "../useTMDataGrid";

/** Row above the grid. Compose it from the pieces below, or anything else. */
export function TMDataGridToolbar({ children }: { children?: ReactNode }) {
  return <div className={classes.toolbar}>{children}</div>;
}

/** Pushes the following toolbar items to the right. */
export function TMDataGridToolbarSpacer() {
  return <div className={classes.toolbarSpacer} />;
}

/**
 * Visible rows over total rows. On a server-driven grid, set
 * `meta.totalRowCount` for the denominator — the client never sees every row.
 */
export function TMDataGridSummaryCount({ children }: { children?: ReactNode }) {
  const { table, controlSize } = useTMDataGridContext();
  useSelector(table.store);

  if (children !== undefined) {
    return (
      <Text size={controlSize} c="dimmed">
        {children}
      </Text>
    );
  }

  const shown = table.getRowCount();
  const total =
    table.options.meta?.totalRowCount ??
    table.getPreFilteredRowModel().rows.length;

  return (
    <Text size={controlSize} c="dimmed">
      {shown} / {total}
    </Text>
  );
}

/**
 * Burger menu in the grid's top-right corner — opens "Manage columns".
 * Renders nothing when no column can be hidden (`enableHiding: false`).
 */
export function TMDataGridColumnsButton() {
  const { table, ui, features, controlSize } = useTMDataGridContext();
  const opened = useSelector(ui, (state) => state.columnsPanelOpen);

  if (!getGridCapabilities(table, features).canHideAny) return null;

  return (
    <Popover
      opened={opened}
      onChange={ui.actions.setColumnsPanelOpen}
      position="bottom-end"
      shadow="md"
      radius="md"
      withinPortal
      trapFocus
    >
      <Popover.Target>
        <Tooltip label="Manage columns" openDelay={400}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={controlSize}
            aria-label="Manage columns"
            onClick={ui.actions.toggleColumnsPanel}
          >
            <BurgerIcon size={18} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <TMDataGridColumnsPanel />
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * Toggles the filter panel, seeding a filter row on the first filterable column.
 * Renders nothing when no column can be filtered (`enableColumnFilters: false`).
 */
export function TMDataGridFilterButton() {
  const api = useTMDataGridContext();
  const { table, ui, features, controlSize } = api;
  const opened = useSelector(ui, (state) => state.filterPanelOpen);
  const columnFilters = useSelector(
    table.store,
    (state) => state.columnFilters,
  );
  const activeCount = columnFilters.filter((filter) =>
    isFilterActive(filter.value),
  ).length;

  if (!getGridCapabilities(table, features).canFilterAny) return null;

  return (
    <Tooltip label="Filters" openDelay={400}>
      <ActionIcon
        variant={opened || activeCount > 0 ? "light" : "subtle"}
        color={activeCount > 0 ? undefined : "gray"}
        size={controlSize}
        aria-label="Filters"
        // Marks this as the panel's own toggle, so the panel's click-away
        // handler leaves it alone and the button stays a toggle.
        data-dg-filter-toggle
        onClick={() => {
          if (opened) {
            ui.actions.closeFilterPanel();
            return;
          }
          const firstFilterable = table
            .getAllLeafColumns()
            .find((column) => column.getCanFilter());
          if (firstFilterable) openColumnFilter(api, firstFilterable.id);
          else ui.actions.openFilterPanel();
        }}
      >
        <FilterIcon size={16} stroke={1.6} />
      </ActionIcon>
    </Tooltip>
  );
}

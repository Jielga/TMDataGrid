import { ActionIcon, Loader, Popover, Text, Tooltip } from "@mantine/core";
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
  return (
    <div data-dg-part="toolbar" className={classes.toolbar}>
      {children}
    </div>
  );
}

/** Pushes the following toolbar items to the right. */
export function TMDataGridToolbarSpacer() {
  return <div className={classes.toolbarSpacer} />;
}

/**
 * A small spinner shown while `meta.loading` is true, and nothing otherwise.
 *
 * The body only shows its loading state while the grid is *empty* — a
 * server-driven grid refetching with rows on screen keeps showing them, which
 * is right, but leaves nothing saying a fetch is running. This is that signal,
 * and the consumer decides where it sits by placing it in the toolbar:
 *
 * ```tsx
 * <TMDataGrid.Toolbar>
 *   <TMDataGrid.SummaryCount />
 *   <TMDataGrid.Spacer />
 *   <TMDataGrid.LoadingIndicator />
 *   <TMDataGrid.FilterButton />
 * </TMDataGrid.Toolbar>
 * ```
 */
export function TMDataGridLoadingIndicator() {
  const { table, labels } = useTMDataGridContext();
  if (table.options.meta?.loading !== true) return null;
  return <Loader size="xs" data-dg-part="loading" aria-label={labels.loading} />;
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
      <Text size={controlSize} c="dimmed" data-dg-part="summary-count">
        {children}
      </Text>
    );
  }

  const shown = table.getRowCount();
  const total =
    table.options.meta?.totalRowCount ??
    table.getPreFilteredRowModel().rows.length;

  return (
    <Text size={controlSize} c="dimmed" data-dg-part="summary-count">
      {shown} / {total}
    </Text>
  );
}

/**
 * Burger menu in the grid's top-right corner — opens "Manage columns".
 * Renders nothing when no column can be hidden (`enableHiding: false`).
 */
export function TMDataGridColumnsButton() {
  const { table, ui, features, labels, controlSize } = useTMDataGridContext();
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
        <Tooltip label={labels.manageColumns} openDelay={400}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={controlSize}
            aria-label={labels.manageColumns}
            data-dg-part="columns-button"
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
  const { table, ui, features, labels, controlSize } = api;
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
    <Tooltip label={labels.filters} openDelay={400}>
      <ActionIcon
        variant={opened || activeCount > 0 ? "light" : "subtle"}
        color={activeCount > 0 ? undefined : "gray"}
        size={controlSize}
        aria-label={labels.filters}
        // Also what the panel's click-away handler tests for, so that a click
        // here reads as a toggle rather than as a click outside.
        data-dg-part="filter-button"
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

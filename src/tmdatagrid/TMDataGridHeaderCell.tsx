import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { flexRender, type Header } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import { type ReactNode, useRef, useState } from "react";
import classes from "./TMDataGrid.module.css";
import {
  type TMDataGridRowData,
  useTMDataGridContext,
} from "./TMDataGridContext.js";
import type { TMDataGridColumnLayout } from "./TMDataGridTable.js";
import { getColumnCapabilities, getGridCapabilities } from "./capabilities.js";
import { getColumnAlign, getColumnLabel } from "./columnUtils.js";
import { isFilterActive } from "./filterOperators.js";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ColumnsIcon,
  DotsVerticalIcon,
  EyeOffIcon,
  FilterIcon,
  PinLeftIcon,
  PinOffIcon,
  PinRightIcon,
} from "./icons.js";
import {
  type TMDataGridFeatures,
  openColumnFilter,
  SELECT_COLUMN_ID,
} from "./useTMDataGrid.js";

export type TMDataGridHeader = Header<
  TMDataGridFeatures,
  TMDataGridRowData,
  unknown
>;

export function TMDataGridHeaderCell({
  header,
  layout,
}: {
  header: TMDataGridHeader;
  layout: TMDataGridColumnLayout;
}) {
  const api = useTMDataGridContext();
  const { table, features } = api;
  const column = header.column;
  const [menuOpened, setMenuOpened] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  // A resize drag ends with a click that bubbles to the header — without this
  // every resize would also toggle the column's sort order.
  const suppressSortRef = useRef(false);

  // Subscribing to the slices this cell renders from keeps it live even when the
  // surrounding tree is memoized (React Compiler) or the table lives elsewhere.
  const { sorting, columnFilters, resizingColumnId } = useSelector(
    table.store,
    (state) => ({
      sorting: state.sorting,
      columnFilters: state.columnFilters,
      resizingColumnId: state.columnResizing.isResizingColumn,
    }),
    { compare: shallow },
  );

  const isLeaf = header.subHeaders.length === 0;
  const label = getColumnLabel(column);
  const align = getColumnAlign(column);
  const sortDirection = sorting.find((sort) => sort.id === column.id)?.desc;
  const isSorted = sortDirection !== undefined;
  const isFiltered = columnFilters.some(
    (filter) => filter.id === column.id && isFilterActive(filter.value),
  );
  const isResizing = resizingColumnId === column.id;
  const pinnedAt = layout.pinnedAt;

  // Every affordance below mirrors a TanStack capability check, so switching a
  // feature off through the table options removes the markup with it.
  const capabilities = getColumnCapabilities(column, features);
  const canSort = isLeaf && capabilities.canSort;
  const canFilter = isLeaf && capabilities.canFilter;
  const canHide = isLeaf && capabilities.canHide;
  const canPin = isLeaf && capabilities.canPin;
  const canResize = capabilities.canResize;
  const canManageColumns =
    isLeaf && getGridCapabilities(table, features).canHideAny;

  /**
   * Pinned columns are positioned with `getStart()` / `getAfter()`, which sum
   * `column.getSize()`. Fluid (`fr`) columns don't report their rendered width
   * there, so freeze the measured width into `columnSizing` as we pin — that
   * keeps the column looking the same and keeps the offsets exact.
   */
  function setPinned(position: "left" | "right" | false) {
    if (position && !(column.id in table.store.state.columnSizing)) {
      const width = cellRef.current?.getBoundingClientRect().width;
      if (width) {
        table.setColumnSizing((prev) => ({
          ...prev,
          [column.id]: Math.round(width),
        }));
      }
    }
    column.pin(position);
  }

  const menuItems: ReactNode[] = [];
  if (canSort) {
    menuItems.push(
      <Menu.Item
        key="sort-asc"
        leftSection={<ArrowUpIcon size={16} stroke={1.6} />}
        onClick={() => column.toggleSorting(false)}
      >
        Sort by ASC
      </Menu.Item>,
      <Menu.Item
        key="sort-desc"
        leftSection={<ArrowDownIcon size={16} stroke={1.6} />}
        onClick={() => column.toggleSorting(true)}
      >
        Sort by DESC
      </Menu.Item>,
      <Menu.Divider key="sort-divider" />,
    );
  }
  if (canFilter) {
    menuItems.push(
      <Menu.Item
        key="filter"
        leftSection={<FilterIcon size={16} stroke={1.6} />}
        onClick={() => openColumnFilter(api, column.id)}
      >
        Filter
      </Menu.Item>,
      <Menu.Divider key="filter-divider" />,
    );
  }
  if (canPin) {
    menuItems.push(
      <Menu.Item
        key="pin-left"
        className={pinnedAt === "left" ? classes.menuItemActive : undefined}
        leftSection={<PinLeftIcon size={16} stroke={1.6} />}
        onClick={() => setPinned(pinnedAt === "left" ? false : "left")}
      >
        Pin to left
      </Menu.Item>,
      <Menu.Item
        key="pin-right"
        className={pinnedAt === "right" ? classes.menuItemActive : undefined}
        leftSection={<PinRightIcon size={16} stroke={1.6} />}
        onClick={() => setPinned(pinnedAt === "right" ? false : "right")}
      >
        Pin to right
      </Menu.Item>,
    );
    if (pinnedAt) {
      menuItems.push(
        <Menu.Item
          key="unpin"
          leftSection={<PinOffIcon size={16} stroke={1.6} />}
          onClick={() => setPinned(false)}
        >
          Unpin
        </Menu.Item>,
      );
    }
    menuItems.push(<Menu.Divider key="pin-divider" />);
  }
  if (canHide) {
    menuItems.push(
      <Menu.Item
        key="hide"
        leftSection={<EyeOffIcon size={16} stroke={1.6} />}
        onClick={() => column.toggleVisibility(false)}
      >
        Hide column
      </Menu.Item>,
    );
  }
  if (canManageColumns) {
    menuItems.push(
      <Menu.Item
        key="manage"
        leftSection={<ColumnsIcon size={16} stroke={1.6} />}
        onClick={() => api.ui.actions.setColumnsPanelOpen(true)}
      >
        Manage columns
      </Menu.Item>,
    );
  }
  // A trailing divider reads as a dropped item — drop the divider instead.
  while (menuItems.length > 0 && isDivider(menuItems.at(-1))) {
    menuItems.pop();
  }

  const cellClass = [
    classes.headerCell,
    canSort ? classes.headerCellSortable : "",
    layout.isBoundary && pinnedAt === "left" ? classes.stickyLeft : "",
    layout.isBoundary && pinnedAt === "right" ? classes.stickyRight : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={cellRef}
      role="columnheader"
      data-testid={`dg-header-${column.id}`}
      data-active={isSorted || isFiltered}
      data-align={align}
      className={cellClass}
      style={{
        left: pinnedAt === "left" ? layout.offset : undefined,
        right: pinnedAt === "right" ? layout.offset : undefined,
        position: pinnedAt ? "sticky" : undefined,
        zIndex: pinnedAt ? 4 : undefined,
      }}
      onClick={
        canSort
          ? (event) => {
              if (suppressSortRef.current) {
                suppressSortRef.current = false;
                return;
              }
              column.getToggleSortingHandler()?.(event);
            }
          : undefined
      }
    >
      {header.isPlaceholder ? null : (
        <Tooltip label={label} openDelay={600} withinPortal disabled={!isLeaf}>
          <span className={classes.headerTitle}>
            {flexRender(column.columnDef.header, header.getContext())}
          </span>
        </Tooltip>
      )}

      {isLeaf && (
        <div className={classes.headerActions}>
          {isFiltered && (
            <ActionIcon
              className={classes.headerAction}
              data-pinned-visible="true"
              variant="subtle"
              color="gray"
              size="xs"
              aria-label={`Filter on ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                openColumnFilter(api, column.id);
              }}
            >
              <FilterIcon size={14} stroke={1.6} />
            </ActionIcon>
          )}

          {canSort && (
            <ActionIcon
              className={classes.headerAction}
              data-pinned-visible={isSorted}
              variant="subtle"
              color="gray"
              size="xs"
              aria-label={`Sort ${label}`}
              onClick={column.getToggleSortingHandler()}
            >
              {sortDirection ? (
                <ArrowDownIcon size={14} stroke={1.6} />
              ) : (
                <ArrowUpIcon size={14} stroke={1.6} />
              )}
            </ActionIcon>
          )}

          {menuItems.length > 0 && column.id !== SELECT_COLUMN_ID && (
            <Menu
              opened={menuOpened}
              onChange={setMenuOpened}
              position="bottom-start"
              shadow="md"
              width={220}
              withinPortal
            >
              <Menu.Target>
                <ActionIcon
                  className={classes.headerAction}
                  data-pinned-visible={menuOpened}
                  variant="subtle"
                  color="gray"
                  size="xs"
                  aria-label={`${label} column menu`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuOpened((opened) => !opened);
                  }}
                >
                  <DotsVerticalIcon size={14} stroke={1.6} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                {menuItems}
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
      )}

      <div
        className={[
          classes.columnSeparator,
          canResize ? classes.columnSeparatorResizable : "",
          isResizing ? classes.columnSeparatorActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseDown={
          canResize
            ? (event) => {
                suppressSortRef.current = true;
                header.getResizeHandler()(event);
              }
            : undefined
        }
        onTouchStart={canResize ? header.getResizeHandler() : undefined}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

function isDivider(node: ReactNode): boolean {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    node.type === Menu.Divider
  );
}

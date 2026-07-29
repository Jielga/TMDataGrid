import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { flexRender, type Header } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import classes from "./TMDataGrid.module.css";
import {
  type TMDataGridRowData,
  useTMDataGridContext,
} from "./TMDataGridContext";
import type { TMDataGridColumnLayout } from "./TMDataGridTable";
import { getColumnCapabilities, getGridCapabilities } from "./capabilities";
import {
  getColumnRegion,
  getStepTargetColumn,
  moveColumn,
  moveColumnByStep,
  type TMDataGridDropSide,
} from "./columnOrdering";
import { getColumnAlign, getColumnLabel } from "./columnUtils";
import { isFilterActive } from "./filterOperators";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ColumnsIcon,
  DotsVerticalIcon,
  EyeOffIcon,
  FilterIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PinLeftIcon,
  PinOffIcon,
  PinRightIcon,
} from "./icons";
import {
  type TMDataGridFeatures,
  openColumnFilter,
  SELECT_COLUMN_ID,
} from "./useTMDataGrid";

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
  const [dropSide, setDropSide] = useState<TMDataGridDropSide | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  // A resize drag ends with a click that bubbles to the header — without this
  // every resize would also toggle the column's sort order.
  const suppressSortRef = useRef(false);

  // Subscribing to the slices this cell renders from keeps it live even when the
  // surrounding tree is memoized (React Compiler) or the table lives elsewhere.
  // `columnOrder` is in the list because the move menu items are derived from
  // the column's neighbours, which is exactly what an order change invalidates.
  const { sorting, columnFilters, resizingColumnId, columnPinning } =
    useSelector(
      table.store,
      (state) => ({
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        resizingColumnId: state.columnResizing.isResizingColumn,
        columnPinning: state.columnPinning,
        columnOrder: state.columnOrder,
      }),
      { compare: shallow },
    );
  const draggedColumnId = useSelector(api.ui, (state) => state.draggedColumnId);

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
  const canReorder = isLeaf && capabilities.canReorder;
  const canManageColumns =
    isLeaf && getGridCapabilities(table, features).canHideAny;

  // A column only moves inside its own pinned lane, so a header in another one
  // never lights up as a target. See TMDataGridColumnRegion.
  const isDragged = draggedColumnId === column.id;
  const isDropTarget =
    canReorder &&
    draggedColumnId !== null &&
    !isDragged &&
    getColumnRegion(columnPinning, draggedColumnId) ===
      getColumnRegion(columnPinning, column.id);

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = "move";
    // Some browsers refuse to start a drag with an empty payload.
    event.dataTransfer.setData("text/plain", column.id);
    api.ui.actions.startColumnDrag(column.id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isDropTarget) return;
    // Only a prevented dragover marks an element as a drop target.
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = cellRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setDropSide(
      event.clientX < bounds.left + bounds.width / 2 ? "before" : "after",
    );
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // dragleave also fires when the pointer crosses into a child element.
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDropSide(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropSide(null);
    api.ui.actions.endColumnDrag();
    if (!isDropTarget || !dropSide || !draggedColumnId) return;
    moveColumn({
      table,
      columnId: draggedColumnId,
      targetId: column.id,
      side: dropSide,
    });
  }

  function handleDragEnd() {
    setDropSide(null);
    api.ui.actions.endColumnDrag();
  }

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
  if (canReorder) {
    // The keyboard path to reordering, and the discoverable one — a header you
    // can drag looks no different from one you cannot.
    const previous = getStepTargetColumn({
      table,
      columnId: column.id,
      direction: -1,
    });
    const next = getStepTargetColumn({
      table,
      columnId: column.id,
      direction: 1,
    });
    if (previous || next) {
      menuItems.push(
        <Menu.Item
          key="move-left"
          disabled={!previous}
          leftSection={<MoveLeftIcon size={16} stroke={1.6} />}
          onClick={() =>
            moveColumnByStep({ table, columnId: column.id, direction: -1 })
          }
        >
          Move left
        </Menu.Item>,
        <Menu.Item
          key="move-right"
          disabled={!next}
          leftSection={<MoveRightIcon size={16} stroke={1.6} />}
          onClick={() =>
            moveColumnByStep({ table, columnId: column.id, direction: 1 })
          }
        >
          Move right
        </Menu.Item>,
        <Menu.Divider key="move-divider" />,
      );
    }
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
    isDragged ? classes.headerCellDragging : "",
    dropSide === "before" ? classes.headerCellDropBefore : "",
    dropSide === "after" ? classes.headerCellDropAfter : "",
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
      // Dropped while a resize is running, so that dragging the separator
      // resizes the column instead of starting to move it. The resize handler
      // records the column on mousedown, before the first pointer move.
      draggable={canReorder && !isResizing}
      onDragStart={canReorder ? handleDragStart : undefined}
      onDragEnd={canReorder ? handleDragEnd : undefined}
      onDragOver={isDropTarget ? handleDragOver : undefined}
      onDragLeave={isDropTarget ? handleDragLeave : undefined}
      onDrop={isDropTarget ? handleDrop : undefined}
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
        // Keeps a drag that starts on the separator from being picked up by the
        // draggable header around it.
        draggable={false}
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

import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { flexRender, type Header } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import classes from "./TMDataGridHeaderCell.module.css";
import sticky from "./sticky.module.css";
import {
  type TMDataGridRowData,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { TMDataGridColumnLayout } from "./TMDataGridTable";
import { getColumnCapabilities, getGridCapabilities } from "../core/capabilities";
import {
  getColumnRegion,
  getStepTargetColumn,
  moveColumn,
  moveColumnByStep,
  type TMDataGridDropSide,
} from "../core/columnOrdering";
import {
  getColumnAlign,
  getColumnLabel,
  isControlColumn,
} from "../core/columnUtils";
import { resolveExpandAll } from "../core/expanding";
import { isFilterActive } from "../core/filterOperators";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CollapseAllIcon,
  ColumnsIcon,
  DotsVerticalIcon,
  ExpandAllIcon,
  EyeOffIcon,
  FilterIcon,
  GroupIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PinLeftIcon,
  PinOffIcon,
  PinRightIcon,
  UngroupIcon,
} from "./icons";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import { type TMDataGridFeatures, openColumnFilter } from "../useTMDataGrid";

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
  const { table, features, labels } = api;
  const column = header.column;
  const [menuOpened, setMenuOpened] = useState(false);
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [dropSide, setDropSide] = useState<TMDataGridDropSide | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  // A resize drag ends with a click that bubbles to the header — without this
  // every resize would also toggle the column's sort order.
  const suppressSortRef = useRef(false);

  // Subscribing to the slices this cell renders from keeps it live even when the
  // surrounding tree is memoized (React Compiler) or the table lives elsewhere.
  // `columnOrder` is in the list because the move menu items are derived from
  // the column's neighbours, which is exactly what an order change invalidates.
  const { sorting, columnFilters, resizingColumnId, columnPinning, grouping } =
    useSelector(
      table.store,
      (state) => ({
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        resizingColumnId: state.columnResizing.isResizingColumn,
        columnPinning: state.columnPinning,
        columnOrder: state.columnOrder,
        grouping: state.grouping,
      }),
      { compare: shallow },
    );
  const draggedColumnId = useSelector(api.ui, (state) => state.draggedColumnId);

  const isLeaf = header.subHeaders.length === 0;
  const label = getColumnLabel(column);
  const align = getColumnAlign(column);
  const sortDirection = sorting.find((sort) => sort.id === column.id)?.desc;
  const isSorted = sortDirection !== undefined;
  // 1-based position in a multi-sort, shown only while more than one column
  // sorts — under a single sort the arrow already says everything.
  const sortIndex =
    isSorted && sorting.length > 1
      ? sorting.findIndex((sort) => sort.id === column.id) + 1
      : null;
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
  const canGroup = isLeaf && capabilities.canGroup;
  const canManageColumns =
    isLeaf && getGridCapabilities(table, features).canHideAny;

  // Read off the subscribed slice, not from `column.getIsGrouped()`: that is a
  // call on a `column` whose identity survives a grouping change, so the React
  // Compiler would cache the answer and the menu would keep offering to group
  // a column that already is. Same reason the sort and filter flags above are
  // derived from state rather than from `getIsSorted()`.
  const isGrouped = grouping.includes(column.id);
  const isGroupingActive = grouping.length > 0;

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
        {labels.sortAsc}
      </Menu.Item>,
      <Menu.Item
        key="sort-desc"
        leftSection={<ArrowDownIcon size={16} stroke={1.6} />}
        onClick={() => column.toggleSorting(true)}
      >
        {labels.sortDesc}
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
        {labels.filterMenuItem}
      </Menu.Item>,
      <Menu.Divider key="filter-divider" />,
    );
  }
  if (canGroup) {
    menuItems.push(
      <Menu.Item
        key="group"
        className={isGrouped ? classes.menuItemActive : undefined}
        leftSection={
          isGrouped ? (
            <UngroupIcon size={16} stroke={1.6} />
          ) : (
            <GroupIcon size={16} stroke={1.6} />
          )
        }
        onClick={column.getToggleGroupingHandler()}
      >
        {isGrouped ? labels.ungroup(label) : labels.groupBy(label)}
      </Menu.Item>,
    );
  }
  if (isGroupingActive) {
    // Under the default `groupedColumnMode: "remove"` a grouped column is taken
    // out of the grid, so its own header — and the Ungroup item on it — is no
    // longer reachable. The tree column that replaced it carries them instead,
    // which is also where someone would look for them.
    if (column.id === GROUP_COLUMN_ID) {
      for (const groupedId of grouping) {
        const groupedColumn = table.getColumn(groupedId);
        if (!groupedColumn) continue;
        menuItems.push(
          <Menu.Item
            key={`ungroup-${groupedId}`}
            leftSection={<UngroupIcon size={16} stroke={1.6} />}
            onClick={() => groupedColumn.toggleGrouping()}
          >
            {labels.ungroup(getColumnLabel(groupedColumn))}
          </Menu.Item>,
        );
      }
    }
    // Groups only, though `expanded` also holds which rows have their detail
    // panel open — `toggleAllRowsExpanded` would open every one of them from an
    // item that says "groups". See resolveExpandAll.
    const expandAllGroups = (expand: boolean) =>
      table.setExpanded(
        resolveExpandAll({
          rows: table.getPrePaginatedRowModel().flatRows,
          expanded: table.store.state.expanded,
          target: "groups",
          expand,
        }),
      );

    menuItems.push(
      <Menu.Item
        key="expand-all"
        leftSection={<ExpandAllIcon size={16} stroke={1.6} />}
        onClick={() => expandAllGroups(true)}
      >
        {labels.expandAllGroups}
      </Menu.Item>,
      <Menu.Item
        key="collapse-all"
        leftSection={<CollapseAllIcon size={16} stroke={1.6} />}
        onClick={() => expandAllGroups(false)}
      >
        {labels.collapseAllGroups}
      </Menu.Item>,
    );
  }
  if (canGroup || isGroupingActive) {
    menuItems.push(<Menu.Divider key="group-divider" />);
  }
  if (canPin) {
    menuItems.push(
      <Menu.Item
        key="pin-left"
        className={pinnedAt === "left" ? classes.menuItemActive : undefined}
        leftSection={<PinLeftIcon size={16} stroke={1.6} />}
        onClick={() => setPinned(pinnedAt === "left" ? false : "left")}
      >
        {labels.pinLeft}
      </Menu.Item>,
      <Menu.Item
        key="pin-right"
        className={pinnedAt === "right" ? classes.menuItemActive : undefined}
        leftSection={<PinRightIcon size={16} stroke={1.6} />}
        onClick={() => setPinned(pinnedAt === "right" ? false : "right")}
      >
        {labels.pinRight}
      </Menu.Item>,
    );
    if (pinnedAt) {
      menuItems.push(
        <Menu.Item
          key="unpin"
          leftSection={<PinOffIcon size={16} stroke={1.6} />}
          onClick={() => setPinned(false)}
        >
          {labels.unpin}
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
          {labels.moveLeft}
        </Menu.Item>,
        <Menu.Item
          key="move-right"
          disabled={!next}
          leftSection={<MoveRightIcon size={16} stroke={1.6} />}
          onClick={() =>
            moveColumnByStep({ table, columnId: column.id, direction: 1 })
          }
        >
          {labels.moveRight}
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
        {labels.hideColumn}
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
        {labels.manageColumns}
      </Menu.Item>,
    );
  }
  // A trailing divider reads as a dropped item — drop the divider instead.
  while (menuItems.length > 0 && isDivider(menuItems.at(-1))) {
    menuItems.pop();
  }

  // One gate for both ways into the menu — the button and the right-click —
  // so the two can never disagree about which headers have one. A control
  // lane's header is itself a control (select-all, expand-all), so it carries
  // no column menu, and a right-click there falls through to the browser's.
  const hasMenu = isLeaf && menuItems.length > 0 && !isControlColumn(column.id);

  const cellClass = [
    classes.headerCell,
    canSort ? classes.headerCellSortable : "",
    isDragged ? classes.headerCellDragging : "",
    dropSide === "before" ? classes.headerCellDropBefore : "",
    dropSide === "after" ? classes.headerCellDropAfter : "",
    layout.isBoundary && pinnedAt === "left" ? sticky.stickyLeft : "",
    layout.isBoundary && pinnedAt === "right" ? sticky.stickyRight : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cell = (
    <div
      ref={cellRef}
      role="columnheader"
      data-testid={`dg-header-${column.id}`}
      data-active={isSorted || isFiltered}
      data-align={align}
      // A control lane is a fixed track, so it cannot take the cell padding the
      // scale grows for text. See isControlColumn.
      data-control-column={isControlColumn(column.id)}
      // Only meaningful on a sortable column: "none" advertises that this
      // header sorts, which is a lie on one that doesn't.
      aria-sort={
        canSort
          ? isSorted
            ? sortDirection
              ? "descending"
              : "ascending"
            : "none"
          : undefined
      }
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
      // Shift+click is "add to sort", and the browser would smear a text
      // selection across the headers it passes. Stopped at the one gesture,
      // same as the body rows do for shift-select.
      onMouseDown={
        canSort
          ? (event) => {
              if (event.shiftKey) event.preventDefault();
            }
          : undefined
      }
      onClick={
        canSort
          ? (event) => {
              if (suppressSortRef.current) {
                suppressSortRef.current = false;
                return;
              }
              // TanStack's handler reads the modifier itself: a plain click
              // replaces the sort, Shift+click appends (`isMultiSortEvent`).
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
              aria-label={labels.filterOn(label)}
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
              aria-label={labels.sortColumn(label)}
              onClick={column.getToggleSortingHandler()}
            >
              {sortDirection ? (
                <ArrowDownIcon size={14} stroke={1.6} />
              ) : (
                <ArrowUpIcon size={14} stroke={1.6} />
              )}
            </ActionIcon>
          )}

          {/* Shift+click adds a column to the sort (TanStack's own
              `isMultiSortEvent`); the number is its priority. Outside the
              hover-revealed action so an active multi-sort stays readable. */}
          {sortIndex !== null && (
            <span className={classes.sortIndex} data-testid="dg-sort-index">
              {sortIndex}
            </span>
          )}

          {hasMenu && (
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
                  // Held visible for the right-click menu too: that one opens at
                  // the pointer and is portaled, so the hover that revealed the
                  // actions is lost the moment the pointer enters the dropdown.
                  data-pinned-visible={menuOpened || contextMenuOpened}
                  variant="subtle"
                  color="gray"
                  size="xs"
                  aria-label={labels.columnMenu(label)}
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

      {/* A system lane has no separator at all: it cannot be resized, and the
          hover line reads as a handle that does nothing — the one place the
          separator stops being a divider and starts being a lie. */}
      {!isControlColumn(column.id) && (
        <div
          className={[
            classes.columnSeparator,
            canResize ? classes.columnSeparatorResizable : "",
            isResizing ? classes.columnSeparatorActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          // Keeps a drag that starts on the separator from being picked up by
          // the draggable header around it.
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
      )}
    </div>
  );

  if (!hasMenu) return cell;

  // A second Menu for the same items, rather than one Menu serving both ways
  // in: the button's dropdown hangs off the button, while a context menu
  // belongs at the pointer, and a Mantine Menu has one target. `menuItems` is
  // built once and rendered by whichever dropdown is open — never both — so
  // the two can't drift apart.
  //
  // The per-header Popover this adds is not the cost the body pays for one per
  // row (see TMDataGridBodyRowGroup): there are as many headers as columns, and
  // they don't re-render on every scroll frame.
  return (
    <Menu
      opened={contextMenuOpened}
      onChange={(opened) => {
        setContextMenuOpened(opened);
        // Right-clicking a header whose button menu is still open would
        // otherwise leave two dropdowns of the same items on screen.
        if (opened) setMenuOpened(false);
      }}
      position="bottom-start"
      shadow="md"
      width={220}
      withinPortal
    >
      <Menu.ContextMenu>{cell}</Menu.ContextMenu>
      <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
        {menuItems}
      </Menu.Dropdown>
    </Menu>
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

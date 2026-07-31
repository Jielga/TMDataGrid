import { Loader, Menu, type MenuProps, Text } from "@mantine/core";
import {
  type Cell,
  flexRender,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import classes from "./TMDataGridTable.module.css";
import sticky from "./sticky.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import { TMDataGridFilterPanel } from "./TMDataGridFilterPanel";
import { TMDataGridHeaderCell } from "./TMDataGridHeaderCell";
import { getColumnAlign, isControlColumn } from "../core/columnUtils";
import {
  getDisplayedRows,
  resolveRowSelectionClick,
} from "../core/rowSelection";
import { SearchIcon } from "./icons";
import type { TMDataGridFeatures } from "../useTMDataGrid";

/** Where a column sits relative to the pinned regions, resolved once per render. */
export type TMDataGridColumnLayout = {
  pinnedAt: "left" | "right" | false;
  /** Distance in px from the grid's left or right edge. */
  offset: number;
  /** Last left-pinned / first right-pinned column — the one that casts the edge. */
  isBoundary: boolean;
};

const UNPINNED_LAYOUT: TMDataGridColumnLayout = {
  pinnedAt: false,
  offset: 0,
  isBoundary: false,
};

/**
 * What a cell shows once grouping is in play.
 *
 * A group row carries a cell for every column, but only some of them have
 * anything to say:
 *
 * | Cell | Renders |
 * | ---- | ------- |
 * | On a data row | the column's `cell`, as always |
 * | Placeholder — a grouped column other than this row's own | nothing |
 * | Aggregated, column declares `aggregatedCell` | that |
 * | Aggregated, column declares an `aggregationFn` | the column's `cell`, over the aggregate |
 * | Aggregated, column declares neither | nothing |
 *
 * That last row is the one worth spelling out. Without an aggregation function
 * `getValue()` is `undefined` on a group row, so the column's own renderer
 * would be handed nothing — and a renderer that formats what it gets
 * (`value.toFixed(2)`) would throw. Blank is both the safe answer and the right
 * one: a plain "group by" is a tree, not a summary, and a column only joins in
 * once it has been told how.
 */
function renderCellContent(
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>,
) {
  if (cell.getIsPlaceholder()) return null;
  if (!cell.getIsAggregated()) {
    return flexRender(cell.column.columnDef.cell, cell.getContext());
  }
  const { aggregatedCell, aggregationFn } = cell.column.columnDef;
  if (aggregatedCell !== undefined) {
    return flexRender(aggregatedCell, cell.getContext());
  }
  if (aggregationFn === undefined) return null;
  return flexRender(cell.column.columnDef.cell, cell.getContext());
}

function TMDataGridBodyCell({
  cell,
  rowHeight,
  layout,
  onContextMenu,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  rowHeight: number;
  layout: TMDataGridColumnLayout;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="cell"
      data-align={getColumnAlign(cell.column)}
      // A control lane is a fixed track, so it cannot take the cell padding the
      // scale grows for text. See isControlColumn.
      data-control-column={isControlColumn(cell.column.id)}
      onContextMenu={onContextMenu}
      className={[
        classes.bodyCell,
        layout.isBoundary && layout.pinnedAt === "left" ? sticky.stickyLeft : "",
        layout.isBoundary && layout.pinnedAt === "right"
          ? sticky.stickyRight
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight: rowHeight,
        left: layout.pinnedAt === "left" ? layout.offset : undefined,
        right: layout.pinnedAt === "right" ? layout.offset : undefined,
        position: layout.pinnedAt ? "sticky" : undefined,
        zIndex: layout.pinnedAt ? 2 : undefined,
      }}
    >
      <span className={classes.cellContent}>{renderCellContent(cell)}</span>
    </div>
  );
}

/**
 * The virtualized body rows, wrapped in the single Menu that serves all of them
 * when `rowContextMenu` is set.
 *
 * One instance for the whole body rather than one per row. A Mantine `Menu` is
 * a `Popover`, and a closed Popover still runs its hooks on every render — and
 * the body re-renders on every scroll frame, because that is how virtualization
 * works. Wrapping each of ~20 mounted rows measured a fifth onto a body render;
 * wrapping the group is the same behaviour for one instance.
 *
 * `display: contents` keeps the group out of the grid's layout while still
 * taking the right-click, carrying `Menu.ContextMenu`'s handlers, and passing
 * its inherited `user-select: none` down to the rows.
 */
function TMDataGridBodyRowGroup({
  enabled,
  menuContent,
  menuProps,
  onContextMenu,
  onClose,
  children,
}: {
  enabled: boolean;
  menuContent: ReactNode;
  menuProps?: Omit<MenuProps, "opened" | "onChange" | "children">;
  onContextMenu: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const rowGroup = (
    <div
      role="rowgroup"
      style={{ display: "contents" }}
      // Runs before Mantine's own handler, which `Menu.ContextMenu` composes on
      // top of this one — so the row and cell are known by the time the
      // dropdown is built and opened at the pointer.
      onContextMenu={enabled ? onContextMenu : undefined}
    >
      {children}
    </div>
  );

  if (!enabled) return rowGroup;

  return (
    <Menu
      // Open only once the render prop has returned something: a row it answers
      // `null` for never opens an empty dropdown.
      opened={menuContent !== null}
      onChange={(opened) => {
        if (!opened) onClose();
      }}
      position="bottom-start"
      shadow="md"
      width={220}
      {...menuProps}
    >
      <Menu.ContextMenu>{rowGroup}</Menu.ContextMenu>
      <Menu.Dropdown>{menuContent}</Menu.Dropdown>
    </Menu>
  );
}

/** What a `rowContextMenu` render prop is handed for the right-clicked row. */
export type TMDataGridRowContextMenuArgs<TData extends RowData> = {
  table: Table<TMDataGridFeatures, TData>;
  row: Row<TMDataGridFeatures, TData>;
  /**
   * The cell under the pointer. `null` only when the right-click landed on the
   * row but on no cell — which a custom cell renderer that stops propagation
   * can cause.
   */
  cell: Cell<TMDataGridFeatures, TData, unknown> | null;
  /**
   * Closes the menu. `Menu.Item` already closes on click (Mantine's
   * `closeOnItemClick`), so this is for content that isn't a menu item.
   */
  close: () => void;
};

/**
 * Builds the contents of a row's context menu — `Menu.Item`, `Menu.Label`,
 * `Menu.Divider`, `Menu.Sub`, or any other node. The grid owns the `Menu` and
 * its `Menu.Dropdown`; this fills the dropdown.
 */
export type TMDataGridRowContextMenu<TData extends RowData> = (
  args: TMDataGridRowContextMenuArgs<TData>,
) => ReactNode;

export type TMDataGridTableProps<TData extends RowData> = {
  /**
   * Called when a body row is clicked. Runs in addition to row selection under
   * `selectionMode: "row"`, not instead of it.
   */
  onRowClick?: (row: Row<TMDataGridFeatures, TData>) => void;
  /**
   * Contents of the menu a right-click on a row opens, at the pointer. Return
   * `null` to leave a row without one — the browser's own menu stays suppressed
   * either way.
   *
   * ```tsx
   * <TMDataGrid.Table<Employee>
   *   rowContextMenu={({ row, close }) => (
   *     <>
   *       <Menu.Label>{row.original.firstName}</Menu.Label>
   *       <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
   *       <Menu.Divider />
   *       <Menu.Item color="red" onClick={() => remove(row.original.id)}>
   *         Delete
   *       </Menu.Item>
   *     </>
   *   )}
   * />
   * ```
   *
   * Called during render, and only for the row whose menu is open — so it stays
   * a pure function of the row, and cost per row does not matter.
   */
  rowContextMenu?: TMDataGridRowContextMenu<TData>;
  /**
   * Passed to the Mantine `Menu` the grid wraps the row in — `width`, `shadow`,
   * `position`, `transitionProps` and the rest. Its open state is the grid's.
   */
  rowContextMenuProps?: Omit<MenuProps, "opened" | "onChange" | "children">;
};

/**
 * The scrollable grid surface. Always virtualized: only the rows inside the
 * viewport (plus overscan) are mounted — which is what makes the default
 * no-pagination mode viable at any row count. Pagination is opt-in via
 * `enablePagination` (or implied by `manualPagination`).
 */
export function TMDataGridTable<TData extends RowData = TMDataGridRowData>({
  onRowClick,
  rowContextMenu,
  rowContextMenuProps,
}: TMDataGridTableProps<TData>) {
  const {
    table,
    ui,
    features,
    rowHeight,
    controlSize,
    renderDetails,
    renderDetailsEstHeight,
    overscan,
  } = useTMDataGridContext();

  // The body depends on every state slice (sorting, filters, paging, sizing,
  // visibility, selection), so it subscribes to the whole table store.
  useSelector(table.store);
  // The active row lives in the chrome store, so it needs its own subscription.
  const highlightedRowId = useSelector(ui, (state) => state.highlightedRowId);

  const { loading, noResultsLabel = "No rows match your filters" } =
    table.options.meta ?? {};

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Pagination off (the default): every filtered+sorted row, virtualized.
  // Pagination on: the current page; under `manualPagination` TanStack returns
  // the rows as delivered, so the same branch serves server paging.
  const rows = getDisplayedRows(table, features);

  /**
   * Whether this row opens a detail panel underneath it.
   *
   * Group rows are out: expanding one opens its children, and they share the
   * `expanded` state with details — so a grouped grid with `renderDetails` set
   * would otherwise render a panel about the group's first record.
   */
  const showsDetails = (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
    renderDetails !== undefined && !row.getIsGrouped() && row.getIsExpanded();

  // A persisted pageIndex can outlive the data that produced it; TanStack only
  // auto-resets on live filter/sort/data changes, not on restored state. The
  // guard makes the dependency-free effect idempotent.
  useEffect(() => {
    if (!features.pagination) return;
    const pageCount = table.getPageCount();
    if (pageCount > 0 && table.store.state.pagination.pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1);
    }
  });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    /**
     * Exact for a plain row, which is fixed at `rowHeight`, and a guess for a
     * row showing a detail panel — the panel is as tall as whatever the
     * consumer renders. Rows are measured whenever details are on (see
     * `measureElement` below), so this only has to hold until the row has been
     * on screen once.
     *
     * Not a `useCallback`, unlike `getItemKey` below it: the virtualizer's
     * measurement cache lists `getItemKey` among its dependencies and not this,
     * so a stable identity here would buy nothing — and the closure has to see
     * the current expansion to answer at all.
     */
    estimateSize: (index: number) => {
      const row = rows[index];
      if (row === undefined) return rowHeight;
      return rowHeight + (showsDetails(row) ? renderDetailsEstHeight : 0);
    },
    /**
     * Zero is never a row: every one carries `minHeight: rowHeight`. An element
     * reports it before layout has run — and always under jsdom, which has no
     * layout at all — and a row cached at zero height stays that way until
     * something resizes it. The estimate stands in until there is a real
     * measurement.
     */
    measureElement: (element, _entry, instance) =>
      element.getBoundingClientRect().height ||
      instance.options.estimateSize(instance.indexFromElement(element)),
    getItemKey: useCallback((index: number) => rows[index]?.id ?? index, [rows]),
    overscan,
    initialRect: { height: 600, width: 1200 },
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);

  // The *Visible* variants throughout: `getLeftLeafColumns()` and friends
  // include hidden columns, while the cells below come from
  // `row.getLeftVisibleCells()`, which does not. Mixing the two would lay down
  // a grid track for a column that renders no cell, shifting every column after
  // it out of its header. The tree column is hidden exactly this way while
  // nothing is grouped.
  const leftLeafColumns = table.getLeftVisibleLeafColumns();
  const rightLeafColumns = table.getRightVisibleLeafColumns();
  const centerLeafColumns = table.getCenterVisibleLeafColumns();

  const orderedColumns = [
    ...leftLeafColumns,
    ...centerLeafColumns,
    ...rightLeafColumns,
  ];

  // Headers and cells must follow the same left → center → right order as the
  // column tracks, otherwise pinning a column would shuffle it out of its lane.
  const centerHeaderGroups = table.getCenterHeaderGroups();
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();
  const headerGroups = centerHeaderGroups.map((group, index) => ({
    id: group.id,
    headers: [
      ...(leftHeaderGroups[index]?.headers ?? []),
      ...group.headers,
      ...(rightHeaderGroups[index]?.headers ?? []),
    ],
  }));
  // Unresized columns stay fluid (`minmax(min, flex fr)`) so the grid fills the
  // viewport; dragging a resize handle pins that column to an exact pixel width.
  // minWidth is the sum of those floors — anything wider and the grid would
  // force a horizontal scrollbar it doesn't need.
  //
  // Pinned columns are always exact: their sticky offsets come from
  // `getStart()` / `getAfter()`, which sum `getSize()` and cannot see an `fr`.
  const columnSizing = table.store.state.columnSizing;
  const columnTracks = orderedColumns.map((column) => {
    const isFixed = column.columnDef.minSize === column.columnDef.maxSize;
    const isResized = column.id in columnSizing;
    const isPinned = column.getIsPinned() !== false;
    const minWidth = column.columnDef.minSize ?? 80;
    if (isFixed || isResized || isPinned) {
      return { track: `${column.getSize()}px`, minWidth: column.getSize() };
    }
    return {
      track: `minmax(${minWidth}px, ${column.columnDef.meta?.flex ?? 1}fr)`,
      minWidth,
    };
  });
  const gridTemplateColumns = columnTracks.map((c) => c.track).join(" ");
  const gridMinWidth = columnTracks.reduce((sum, c) => sum + c.minWidth, 0);

  /**
   * Sticky offsets are derived here, from state this component subscribes to,
   * and handed down as props.
   *
   * Deriving them inside the cell via `column.getIsPinned()` /
   * `column.getStart()` looks equivalent but isn't: those are plain calls on a
   * `column` object whose identity survives a pin, so the React Compiler caches
   * the result and the cell keeps rendering with stale pinning. Building the
   * offsets from the same widths as the grid tracks also guarantees the two
   * agree to the pixel.
   */
  const columnLayout = new Map<string, TMDataGridColumnLayout>();
  const widthOf = (columnId: string) =>
    columnTracks[orderedColumns.findIndex((c) => c.id === columnId)]?.minWidth ??
    0;

  let leftOffset = 0;
  for (const column of leftLeafColumns) {
    columnLayout.set(column.id, {
      pinnedAt: "left",
      offset: leftOffset,
      isBoundary: column.id === leftLeafColumns.at(-1)?.id,
    });
    leftOffset += widthOf(column.id);
  }
  let rightOffset = 0;
  for (const column of [...rightLeafColumns].reverse()) {
    columnLayout.set(column.id, {
      pinnedAt: "right",
      offset: rightOffset,
      isBoundary: column.id === rightLeafColumns[0]?.id,
    });
    rightOffset += widthOf(column.id);
  }
  for (const column of centerLeafColumns) {
    columnLayout.set(column.id, {
      pinnedAt: false,
      offset: 0,
      isBoundary: false,
    });
  }
  const layoutFor = (columnId: string) =>
    columnLayout.get(columnId) ?? UNPINNED_LAYOUT;

  const isEmpty = rows.length === 0;

  // "row" mode: the row itself is the selection control, with the modifier
  // conventions of any desktop list — see resolveRowSelectionClick.
  const selectsOnRowClick = features.rowClickSelects;
  const rowIsInteractive =
    selectsOnRowClick || features.highlightRow || onRowClick !== undefined;

  /**
   * Group rows sit out every row-level gesture.
   *
   * Not squeamishness: TanStack builds a group row on top of its first leaf's
   * record (`constructRow(table, id, leafRows[0].original, …)`), so an
   * `onRowClick` firing here would hand a consumer a real-looking row that is
   * the wrong one — a detail panel would open on an arbitrary child. The same
   * goes for the highlight, which is what a detail panel follows.
   *
   * Selecting a group is still possible, through its checkbox, which resolves
   * to the descendants rather than to the group itself. See
   * getSelectableRowIds.
   */
  const rowGesturesFor = (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
    row.getIsGrouped() ? false : rowIsInteractive;

  const handleRowActivate = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    modifiers: { toggle: boolean; extend: boolean },
  ) => {
    if (selectsOnRowClick && row.getCanSelect()) {
      const resolved = resolveRowSelectionClick({
        rows,
        rowId: row.id,
        anchorRowId: ui.state.selectionAnchorRowId,
        modifiers,
        selection: table.store.state.rowSelection,
        canReplaceSelection: true,
      });
      table.setRowSelection(resolved.selection);
      ui.actions.setSelectionAnchor(resolved.anchorRowId);
    }
    // Set, never toggle: a second click on the highlighted row must not close
    // the detail panel showing it. Clearing is
    // `ui.actions.setHighlightedRow(null)`.
    if (features.highlightRow) ui.actions.setHighlightedRow(row.id);
    onRowClick?.(row as unknown as Row<TMDataGridFeatures, TData>);
  };

  // Which row's context menu is open, and which cell it was opened from.
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    rowId: string;
    columnId: string | null;
  } | null>(null);
  const closeContextMenu = () => setContextMenuTarget(null);

  // Row and cell each record themselves on the way up, so that by the time the
  // rowgroup's handler opens the menu it knows what was hit. Refs rather than
  // state: written and read inside the same event, before the render it causes.
  const contextMenuRowRef = useRef<string | null>(null);
  const contextMenuColumnRef = useRef<string | null>(null);

  const handleContextMenu = () => {
    const rowId = contextMenuRowRef.current;
    const columnId = contextMenuColumnRef.current;
    contextMenuRowRef.current = null;
    contextMenuColumnRef.current = null;
    setContextMenuTarget(rowId === null ? null : { rowId, columnId });
  };

  const contextMenuRow =
    contextMenuTarget === null
      ? undefined
      : rows.find((row) => row.id === contextMenuTarget.rowId);

  /**
   * Built for the open row only, so a consumer's render prop is called once per
   * opened menu rather than once per mounted row. `null` back from it means
   * this row has no menu, which is also how the menu stays shut.
   *
   * The casts put back the concrete row type the context boundary erased — the
   * same crossing `onRowClick` makes.
   */
  const contextMenuContent =
    rowContextMenu && contextMenuTarget && contextMenuRow
      ? rowContextMenu({
          table: table as unknown as Table<TMDataGridFeatures, TData>,
          row: contextMenuRow as unknown as Row<TMDataGridFeatures, TData>,
          cell: (contextMenuRow
            .getAllCells()
            .find((cell) => cell.column.id === contextMenuTarget.columnId) ??
            null) as unknown as Cell<TMDataGridFeatures, TData, unknown> | null,
          close: closeContextMenu,
        }) ?? null
      : null;

  /**
   * The dropdown is anchored to a fixed viewport point, so it does not travel
   * with the row when the body scrolls — and under virtualization the row it
   * belongs to may unmount entirely. Closing is the honest answer, and matches
   * what every desktop context menu does.
   */
  const handleScroll = contextMenuTarget ? closeContextMenu : undefined;

  return (
    <div className={classes.tableWrapper}>
      <div
        ref={scrollContainerRef}
        className={classes.scrollContainer}
        onScroll={handleScroll}
      >
        <div
          role="table"
          className={classes.grid}
          // Virtualization means most rows are not in the DOM, so the counts
          // have to be stated rather than inferred from what is rendered. Every
          // row carries its aria-rowindex for the same reason.
          aria-rowcount={rows.length + headerGroups.length}
          aria-colcount={orderedColumns.length}
          style={{ gridTemplateColumns, minWidth: gridMinWidth }}
        >
          <div role="rowgroup" style={{ display: "contents" }}>
            {headerGroups.map((headerGroup, groupIndex) => (
              <div
                key={headerGroup.id}
                role="row"
                aria-rowindex={groupIndex + 1}
                className={classes.headerRow}
              >
                {headerGroup.headers.map((header) => (
                  <TMDataGridHeaderCell
                    key={header.id}
                    header={header}
                    layout={layoutFor(header.column.id)}
                  />
                ))}
              </div>
            ))}
          </div>

          {paddingTop > 0 && (
            <div aria-hidden style={{ gridColumn: "1/-1", height: paddingTop }} />
          )}

          <TMDataGridBodyRowGroup
            enabled={rowContextMenu !== undefined}
            menuContent={contextMenuContent}
            menuProps={rowContextMenuProps}
            onContextMenu={handleContextMenu}
            onClose={closeContextMenu}
          >
            {virtualItems.map((virtualItem) => {
              const row = rows[virtualItem.index];
              if (!row) return null;
              const isGroupRow = row.getIsGrouped();
              const isInteractive = rowGesturesFor(row);
              const takesKeyboard =
                !isGroupRow && (selectsOnRowClick || features.highlightRow);
              return (
                <div
                  key={virtualItem.key}
                  role="row"
                  aria-rowindex={virtualItem.index + headerGroups.length + 1}
                  data-testid={`dg-row-${row.id}`}
                  // Only measured when details are on: without them every row
                  // is exactly `rowHeight`, and the estimate above is already
                  // the answer — so a plain grid keeps its ResizeObserver-free
                  // body. `measureElement` is a stable instance method and
                  // returns nothing, so it can be the ref itself.
                  //
                  // `data-index` is how the virtualizer maps the observed
                  // element back to its item. The panel is inside this element,
                  // so what gets measured is the row *and* its detail — which
                  // is the whole reason no second virtual item is needed.
                  data-index={renderDetails ? virtualItem.index : undefined}
                  ref={renderDetails ? virtualizer.measureElement : undefined}
                  // The tree's own rows. `data-grouped` rather than a class, to
                  // match how the rest of the row's state is published — and so
                  // a consumer can restyle them without reaching into modules.
                  data-grouped={isGroupRow}
                  data-depth={row.depth}
                  // Gated on the flag, not just on `getIsSelected()`: under
                  // `"highlight"` there is no selection, but `rowSelection` may
                  // still hold ids from before the mode changed — TanStack never
                  // prunes it — and a row must not report itself selected in a
                  // mode where selecting is not a thing.
                  data-selected={features.rowSelection && row.getIsSelected()}
                  // Being selected is state; painting it is a display choice, so
                  // the two are separate attributes.
                  data-selected-bg={
                    features.rowSelection &&
                    features.showSelectedBackground &&
                    row.getIsSelected()
                  }
                  // The highlighted row is its own concept, so its own attribute
                  // pair — `data-highlighted` / `aria-current` against
                  // `data-selected` / `aria-selected` for selection. Under
                  // `"checkboxAndHighlight"` a row can carry both.
                  //
                  // Not `data-active`: header cells already use that for
                  // sorted-or-filtered, and Mantine puts it on its own controls,
                  // so a consumer styling or querying rows by it would cast far
                  // wider than they meant to.
                  data-highlighted={
                    features.highlightRow && row.id === highlightedRowId
                  }
                  // The menu is anchored to the rowgroup, so Mantine's own
                  // `data-expanded` lands there rather than on a row. This is
                  // what says which row the open menu is about.
                  data-context-menu={
                    contextMenuContent !== null &&
                    contextMenuTarget?.rowId === row.id
                  }
                  data-selects-on-click={selectsOnRowClick && !isGroupRow}
                  aria-selected={
                    features.rowSelection ? row.getIsSelected() : undefined
                  }
                  aria-current={
                    features.highlightRow && row.id === highlightedRowId
                      ? true
                      : undefined
                  }
                  className={classes.bodyRow}
                  style={{
                    minHeight: rowHeight,
                    cursor: isInteractive ? "pointer" : undefined,
                  }}
                  // Keyboard parity with the checkbox the row replaces.
                  tabIndex={takesKeyboard ? 0 : undefined}
                  // Shift-click extends the browser's text selection across
                  // every row it passes. `user-select: none` would fix it too,
                  // but at the cost of ever copying a cell value, so the smear
                  // is stopped at the one gesture that causes it.
                  onMouseDown={
                    selectsOnRowClick && !isGroupRow
                      ? (event) => {
                          if (event.shiftKey) event.preventDefault();
                        }
                      : undefined
                  }
                  onClick={
                    isInteractive
                      ? (event) =>
                          handleRowActivate(row, {
                            toggle: event.ctrlKey || event.metaKey,
                            extend: event.shiftKey,
                          })
                      : undefined
                  }
                  onKeyDown={
                    takesKeyboard
                      ? (event) => {
                          if (event.key !== " " && event.key !== "Enter") return;
                          if (event.target !== event.currentTarget) return;
                          event.preventDefault();
                          // Space/Enter toggle rather than replace, so a
                          // keyboard-only user can still build a selection.
                          handleRowActivate(row, {
                            toggle: true,
                            extend: event.shiftKey,
                          });
                        }
                      : undefined
                  }
                  // Bubbles to the rowgroup, where the menu opens — so the row
                  // is recorded before the dropdown is built.
                  //
                  // Group rows record nothing, which leaves the ref null and the
                  // menu shut. Same reason they sit out `onRowClick`: TanStack
                  // builds a group row on its first child's record, so a render
                  // prop reaching for `row.original` would be handed a real
                  // employee that has nothing to do with the group. The browser
                  // menu stays suppressed over them either way.
                  onContextMenu={
                    rowContextMenu && !isGroupRow
                      ? () => {
                          contextMenuRowRef.current = row.id;
                        }
                      : undefined
                  }
                >
                  {[
                    ...row.getLeftVisibleCells(),
                    ...row.getCenterVisibleCells(),
                    ...row.getRightVisibleCells(),
                  ].map((cell) => (
                    <TMDataGridBodyCell
                      key={cell.id}
                      cell={cell}
                      rowHeight={rowHeight}
                      layout={layoutFor(cell.column.id)}
                      onContextMenu={
                        rowContextMenu
                          ? () => {
                              contextMenuColumnRef.current = cell.column.id;
                            }
                          : undefined
                      }
                    />
                  ))}

                  {/* A second grid row inside the row element, on the same
                      subgrid tracks — which is what lets one measurement cover
                      both. A cell spanning every column rather than a row of
                      its own, so the row keeps holding exactly one row's worth
                      of content and `aria-rowcount` still counts records. */}
                  {showsDetails(row) && (
                    <div
                      role="cell"
                      aria-colspan={orderedColumns.length}
                      data-testid={`dg-details-${row.id}`}
                      className={classes.detailsCell}
                      // The row underneath may select, highlight or open a
                      // context menu. A panel is content, not part of that
                      // gesture surface — and stopping the right-click here is
                      // what leaves the browser's own menu working for a link
                      // or an input inside it.
                      onClick={(event) => event.stopPropagation()}
                      onContextMenu={(event) => event.stopPropagation()}
                    >
                      {/* No cast back to `TData`: the context erased the row
                          type, and the renderer reaching this point was typed
                          against the consumer's own at the `useTMDataGrid`
                          call. */}
                      {renderDetails?.({ table, row })}
                    </div>
                  )}
                </div>
              );
            })}
          </TMDataGridBodyRowGroup>

          {isEmpty && loading === true && (
            <div role="row" className={classes.messageRow}>
              <Loader size="lg" />
            </div>
          )}

          {isEmpty && loading !== true && (
            <div role="row" className={classes.messageRow}>
              <SearchIcon size={40} stroke={1.4} opacity={0.4} />
              <Text size={controlSize} c="dimmed">
                {noResultsLabel}
              </Text>
            </div>
          )}

          {paddingBottom > 0 && (
            <div
              aria-hidden
              style={{ gridColumn: "1/-1", height: paddingBottom }}
            />
          )}
        </div>
      </div>

      <TMDataGridFilterPanel />
    </div>
  );
}

import { Checkbox, Loader, Menu, type MenuProps, Text } from "@mantine/core";
import {
  type Cell,
  type Column,
  flexRender,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type UIEvent,
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
import {
  TMDataGridCellEditor,
  type TMDataGridCellEditorClose,
} from "./TMDataGridCellEditor";
import { TMDataGridEntryRows } from "./TMDataGridEntryRows";
import { getColumnAlign, isControlColumn } from "../core/columnUtils";
import { getEditFieldName } from "../core/editEngine";
import {
  getNextEditableCell,
  resolveCellMove,
  type TMDataGridCellPosition,
} from "../core/cellNavigation";
import {
  boundsCellCount,
  boundsEdges,
  isWithinBounds,
  resolveRangeBounds,
} from "../core/cellRange";
import {
  buildCellMatrix,
  DEFAULT_CELL_EXPORT_OPTIONS,
  downloadTextFile,
  toClipboardText,
  toExcelCsv,
  writeClipboardText,
  type TMDataGridCellExportOptions,
} from "../core/cellExport";
import { autosizeColumn } from "../core/autosize";
import {
  getDisplayedRows,
  getSelectableRowIds,
  isPagingActive,
  resolveRowSelectionClick,
} from "../core/rowSelection";
import { readPinnedRows } from "../core/rowPinning";
import { ROW_NUMBER_COLUMN_ID } from "./TMDataGridRowNumberColumn";
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
 * What Enter and F2 step into. Deliberately the plain list rather than a full
 * tabbable audit: a cell holds a control or it doesn't, and anything exotic
 * enough to fool this is exotic enough to handle its own keys.
 */
const FOCUSABLE_IN_CELL = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * The mounted element for a cell position, or `null` when its row is scrolled
 * out — the normal case for a move that has to scroll before it can focus.
 */
function findCellElement(
  container: HTMLElement,
  cell: TMDataGridCellPosition,
): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[data-cell="true"][data-row-id="${CSS.escape(cell.rowId)}"]` +
      `[data-column-id="${CSS.escape(cell.columnId)}"]`,
  );
}

/**
 * Scrolls sideways far enough to clear the pinned lanes.
 *
 * `scrollIntoView` cannot do this: the pinned columns are `position: sticky`,
 * so as far as the browser is concerned a cell sliding underneath them is
 * still perfectly visible, and it stops scrolling the moment the cell's edge
 * reaches the container's. The visible edge is the inside of the pinned lane,
 * which only this component knows — it laid the lanes out.
 */
function keepColumnInView({
  container,
  cellElement,
  leftPinnedWidth,
  rightPinnedWidth,
}: {
  container: HTMLElement;
  cellElement: HTMLElement;
  leftPinnedWidth: number;
  rightPinnedWidth: number;
}): void {
  const cellRect = cellElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const leftBound = containerRect.left + leftPinnedWidth;
  const rightBound = containerRect.right - rightPinnedWidth;

  if (cellRect.left < leftBound) {
    container.scrollLeft -= leftBound - cellRect.left;
  } else if (cellRect.right > rightBound) {
    container.scrollLeft += cellRect.right - rightBound;
  }
}

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

/**
 * What a cell needs to take part in cell selection, or `undefined` while the
 * feature is off — which is what keeps a plain grid's cells exactly as they
 * were: no tab stop, no `gridcell` role, no coordinates in the DOM.
 *
 * The coordinates are there for the delegated key handler, which reads them off
 * `event.target` rather than closing over per-cell state, and for the effect
 * that puts DOM focus where {@link TMDataGridUiState.focusedCell} says.
 */
export type TMDataGridCellNav = {
  rowId: string;
  /** 1-based, for `aria-colindex`. */
  columnIndex: number;
  focused: boolean;
  /** The roving tab stop: `0` on exactly one mounted cell, `-1` on the rest. */
  tabIndex: 0 | -1;
  /** Inside the selected rectangle. Always `false` under `"single"`. */
  selected: boolean;
  /**
   * Which sides of the rectangle this cell is on, or `null` when it is not in
   * one. The outline is drawn per cell — see {@link boundsEdges}.
   */
  edges: { top: boolean; bottom: boolean; left: boolean; right: boolean } | null;
};

function TMDataGridBodyCell({
  cell,
  rowHeight,
  layout,
  nav,
  editor,
  contentOverride,
  onFocus,
  onClick,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onContextMenu,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  rowHeight: number;
  layout: TMDataGridColumnLayout;
  nav?: TMDataGridCellNav;
  /** The mounted editor, when this is the cell being edited. */
  editor?: ReactNode;
  /**
   * Replaces the column renderer's output — the row-number gutter, whose
   * value only the body knows. `undefined` means "render normally".
   */
  contentOverride?: ReactNode;
  onFocus?: () => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  onDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  // The edit markers subscribe here, per cell, all to the one projection
  // store — so typing in an editor repaints the edited row's cells and
  // nothing else. Constant `false` everywhere while editing is off.
  const { edit } = useTMDataGridContext();
  const fieldName = getEditFieldName(cell.column);
  const cellRowId = cell.row.id;
  const isDirty = useSelector(edit.store, (state) => {
    if (fieldName === null) return false;
    const projection = state.rows[cellRowId];
    return projection !== undefined && projection.dirtyFields.includes(fieldName);
  });
  const isInvalid = useSelector(edit.store, (state) => {
    if (fieldName === null) return false;
    const projection = state.rows[cellRowId];
    return projection !== undefined && projection.errorFields.includes(fieldName);
  });
  return (
    <div
      // `gridcell` rather than `cell` is the whole promise of cell selection:
      // it is what tells a screen reader the arrow keys move a cursor here, so
      // it is set together with the tab stop rather than always.
      role={nav ? "gridcell" : "cell"}
      aria-colindex={nav?.columnIndex}
      tabIndex={nav?.tabIndex}
      // The marker the delegated key handler tests: a key event whose target is
      // a cell is the grid's, one from inside a cell belongs to whatever holds
      // the focus in there.
      data-cell={nav ? true : undefined}
      data-row-id={nav?.rowId}
      // Always present, not only under cell selection: autosize finds a
      // column's mounted cells by it. The cell-navigation selectors also
      // require `data-cell`, so they are unaffected.
      data-column-id={cell.column.id}
      data-focused={nav?.focused}
      aria-selected={nav?.selected}
      data-selected={nav?.selected}
      // One attribute per side rather than a class per combination: the
      // stylesheet draws the outline edge by edge, and sixteen classes for the
      // sixteen corners of a rectangle is not a stylesheet anyone can read.
      data-edge-top={nav?.edges?.top}
      data-edge-bottom={nav?.edges?.bottom}
      data-edge-left={nav?.edges?.left}
      data-edge-right={nav?.edges?.right}
      // Bubbles, so focus landing on a control inside the cell counts as
      // landing on the cell — the ring follows the user into the checkbox
      // rather than being left behind on whichever cell they came from.
      onFocus={onFocus}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      data-editing={editor !== undefined || undefined}
      data-dirty={isDirty || undefined}
      data-invalid={isInvalid || undefined}
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
        // The focus ring is drawn inside the cell's own box, so the cell has to
        // be able to stack above its neighbours — a plain one to lift the ring
        // over the pinned lane it sits beside, a pinned one to keep the ring
        // whole while the rest of the row slides under it. Values from the
        // stacking ladder in TMDataGrid.module.css.
        position: layout.pinnedAt
          ? "sticky"
          : nav?.focused
            ? "relative"
            : undefined,
        zIndex: nav?.focused
          ? "var(--dg-z-focused-cell, 3)"
          : layout.pinnedAt
            ? "var(--dg-z-pinned-cell, 2)"
            : undefined,
      }}
    >
      {editor ?? (
        <span className={classes.cellContent}>
          {contentOverride ?? renderCellContent(cell)}
        </span>
      )}
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

/**
 * What the `onCellClick` family receives — the cell with its row and column,
 * in the consumer's own row type, plus the pointer event.
 */
export type TMDataGridCellEventArgs<TData extends RowData> = {
  cell: Cell<TMDataGridFeatures, TData, unknown>;
  row: Row<TMDataGridFeatures, TData>;
  column: Column<TMDataGridFeatures, TData, unknown>;
  event: MouseEvent<HTMLElement>;
};

export type TMDataGridTableProps<TData extends RowData> = {
  /**
   * Called when a body row is clicked. Runs in addition to row selection under
   * `selectionMode: "row"`, not instead of it.
   */
  onRowClick?: (row: Row<TMDataGridFeatures, TData>) => void;
  /**
   * Called when a body cell is clicked. Composes, never suppresses: whatever
   * the click already does — selecting, highlighting, moving the cell cursor
   * — still happens. Group rows sit out the cell handlers the way they sit
   * out `onRowClick`, and for the same reason.
   */
  onCellClick?: (args: TMDataGridCellEventArgs<TData>) => void;
  /** As {@link onCellClick}; a double-click that opens an editor still does. */
  onCellDoubleClick?: (args: TMDataGridCellEventArgs<TData>) => void;
  /**
   * As {@link onCellClick}; `rowContextMenu` and the cell-selection menu still
   * open. To suppress the browser's own menu on a grid with neither, call
   * `event.preventDefault()` here.
   */
  onCellContextMenu?: (args: TMDataGridCellEventArgs<TData>) => void;
  /**
   * Class for a body row — a string, or a function of the row (group rows
   * included; test `row.getIsGrouped()` to skip them). Added after the grid's
   * own row class.
   */
  rowClassName?:
    | string
    | ((row: Row<TMDataGridFeatures, TData>) => string | undefined);
  /**
   * Inline style for a body row. To colour a row, set `--row-bg` rather than
   * `background`: the row's own background, its sticky pinned cells and the
   * cell-range tint all read that variable, and hover/selection/highlight
   * keep working on top of it — a raw `background` bypasses all of them.
   *
   * ```tsx
   * rowStyle={(row) =>
   *   row.original.overdue ? { "--row-bg": "var(--mantine-color-red-0)" } : undefined
   * }
   * ```
   */
  rowStyle?:
    | CSSProperties
    | ((row: Row<TMDataGridFeatures, TData>) => CSSProperties | undefined);
  /**
   * Every second row takes `--dg-row-striped-bg`. Computed from the row's
   * position in the view — sorting and filtering restripe, and the stripes
   * stay put while the virtualizer mounts and unmounts rows.
   */
  striped?: boolean;
  /**
   * Called when the scroll *arrives* at an edge — once per arrival, not per
   * scroll event, and not on mount (the grid starts at the top-left edge).
   * For loading more rows as the end approaches, `onReachEnd` is the better
   * hook: it fires rows-early and latches per row count.
   */
  onScrollToTop?: () => void;
  /** As {@link onScrollToTop}, for the bottom edge. */
  onScrollToBottom?: () => void;
  /** As {@link onScrollToTop}, for the left edge. */
  onScrollToLeft?: () => void;
  /** As {@link onScrollToTop}, for the right edge. */
  onScrollToRight?: () => void;
  /**
   * Rendered centred in the body when the view is empty — the branded blank
   * slate. It takes over states 3 and 4 of the empty matrix (see the docs):
   * loading still shows the loader, and open entry rows still show only
   * themselves. `hasActiveFilters` says which emptiness this is — a filter
   * that matched nothing wants a "clear filters" invitation, a grid with no
   * data wants a "create the first one".
   */
  renderEmptyState?: (args: {
    hasActiveFilters: boolean;
    table: Table<TMDataGridFeatures, TData>;
  }) => ReactNode;
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
  /**
   * How Ctrl+C and the export item write values, under
   * `cellSelection: "range"`. Defaults to the Nordic Excel conventions — see
   * {@link TMDataGridCellExportOptions}.
   */
  cellExport?: TMDataGridCellExportOptions;
  /**
   * Called when the scroll approaches the last row — the infinite-scroll
   * hook-in. Append the next page to `data` and the virtualizer keeps its
   * position; fires once per row count, so a pending fetch is not asked
   * again until it lands.
   *
   * ```tsx
   * <TMDataGrid.Table onReachEnd={() => query.fetchNextPage()} />
   * ```
   *
   * Sorting and filtering must be server-side (`manual*`) on a grid that
   * loads this way — the client only ever holds a prefix of the data. Not
   * compatible with `enablePagination`, which slices the same scroll.
   */
  onReachEnd?: () => void;
  /**
   * How many rows before the end {@link onReachEnd} fires at. Defaults to 10.
   */
  reachEndThreshold?: number;
};

/**
 * The scrollable grid surface. Always virtualized: only the rows inside the
 * viewport (plus overscan) are mounted — which is what makes the default
 * no-pagination mode viable at any row count. Pagination is opt-in via
 * `enablePagination` (or implied by `manualPagination`).
 */
export function TMDataGridTable<TData extends RowData = TMDataGridRowData>({
  onRowClick,
  onCellClick,
  onCellDoubleClick,
  onCellContextMenu,
  rowClassName,
  rowStyle,
  striped = false,
  onScrollToTop,
  onScrollToBottom,
  onScrollToLeft,
  onScrollToRight,
  renderEmptyState,
  rowContextMenu,
  rowContextMenuProps,
  cellExport,
  onReachEnd,
  reachEndThreshold = 10,
}: TMDataGridTableProps<TData>) {
  const {
    table,
    ui,
    edit,
    features,
    labels,
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
  // As does the focused cell. Selected separately from the row above so a grid
  // with cell selection off never re-renders for it.
  const focusedCell = useSelector(ui, (state) => state.focusedCell);
  const cellRange = useSelector(ui, (state) => state.cellRange);
  // Which cell has an editor open. The projection (dirty/error markers) is
  // subscribed per cell instead — see TMDataGridBodyCell.
  const editActive = useSelector(edit.store, (state) => state.active);
  const newRowCount = useSelector(edit.store, (state) => state.newRows.length);
  const deletedRowIds = useSelector(edit.store, (state) => state.deletedRowIds);

  const { loading, noResultsLabel = labels.noResults } =
    table.options.meta ?? {};

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Pagination off (the default): every filtered+sorted row, virtualized.
  // Pagination on: the current page; under `manualPagination` TanStack returns
  // the rows as delivered, so the same branch serves server paging.
  const rows = getDisplayedRows(table, features);

  // The edge blocks. `getDisplayedRows` above has already taken these out of
  // the scrolling order; stale ids resolve to nothing — see readPinnedRows.
  const pinnedTopRows = features.rowPinning ? readPinnedRows(table, "top") : [];
  const pinnedBottomRows = features.rowPinning
    ? readPinnedRows(table, "bottom")
    : [];
  const pinnedRowCount = pinnedTopRows.length + pinnedBottomRows.length;

  // The row-number gutter's numbers: one pass over the view per render, only
  // while the lane exists. A cell cannot know its display position, so the
  // body hands each row its number — group rows get none (they are headings
  // over the rows being counted), and paging continues the count across
  // pages rather than restarting every page at 1.
  let rowNumberById: Map<string, number> | null = null;
  if (features.rowNumbers) {
    rowNumberById = new Map();
    let n = isPagingActive(table, features)
      ? table.store.state.pagination.pageIndex *
        table.store.state.pagination.pageSize
      : 0;
    for (const viewRow of rows) {
      if (!viewRow.getIsGrouped()) rowNumberById.set(viewRow.id, ++n);
    }
  }

  /**
   * Whether this row opens a detail panel underneath it.
   *
   * Group rows are out: expanding one opens its children, and they share the
   * `expanded` state with details — so a grouped grid with `renderDetails` set
   * would otherwise render a panel about the group's first record.
   */
  const showsDetails = (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
    renderDetails !== undefined && !row.getIsGrouped() && row.getIsExpanded();

  /**
   * `meta.autoSize` columns, sized once after the first rows are in the DOM.
   * A ref rather than an effect dependency: this must run exactly once per
   * mount, and only for columns no persisted or user width already covers —
   * autosizing again on data changes would fight a width the user has since
   * dragged.
   */
  const autoSizedRef = useRef(false);
  useEffect(() => {
    if (autoSizedRef.current) return;
    autoSizedRef.current = true;
    const container = scrollContainerRef.current;
    if (container === null) return;
    for (const column of orderedColumns) {
      if (column.columnDef.meta?.autoSize !== true) continue;
      if (column.id in table.store.state.columnSizing) continue;
      autosizeColumn({ table, columnId: column.id, container });
    }
  });

  /**
   * The header's height, published as `--dg-header-height` for the entry
   * block to stick under — never measured otherwise (`top: 0` needs no
   * number). A ResizeObserver, mounted only while the block is in use: the
   * same discipline `renderDetails` applies to `measureElement`.
   */
  const gridElementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (newRowCount === 0 && pinnedTopRows.length === 0) return;
    const grid = gridElementRef.current;
    if (grid === null) return;
    const headerRows = grid.querySelectorAll<HTMLElement>(
      "[data-dg-header-row]",
    );
    const measure = () => {
      let total = 0;
      for (const headerRow of headerRows) total += headerRow.offsetHeight;
      grid.style.setProperty("--dg-header-height", `${total}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const headerRow of headerRows) observer.observe(headerRow);
    return () => observer.disconnect();
  }, [newRowCount, pinnedTopRows.length]);

  /**
   * The entry block's height, published as `--dg-entry-height` so the pinned
   * top block can stack under it — measured only while both blocks exist,
   * which is the only time the offset is anything but 0.
   */
  useEffect(() => {
    if (newRowCount === 0 || pinnedTopRows.length === 0) return;
    const grid = gridElementRef.current;
    if (grid === null) return;
    const entryBlock = grid.querySelector<HTMLElement>("[data-dg-entry-block]");
    if (entryBlock === null) return;
    const measure = () =>
      grid.style.setProperty("--dg-entry-height", `${entryBlock.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(entryBlock);
    return () => {
      observer.disconnect();
      grid.style.removeProperty("--dg-entry-height");
    };
  }, [newRowCount, pinnedTopRows.length]);

  /**
   * The summary row's height, published as `--dg-summary-height` so the
   * pinned bottom block sticks above it rather than underneath it.
   */
  useEffect(() => {
    if (pinnedBottomRows.length === 0) return;
    const grid = gridElementRef.current;
    if (grid === null) return;
    const summaryRow = grid.querySelector<HTMLElement>(
      '[data-testid="dg-summary-row"]',
    );
    if (summaryRow === null) return;
    const measure = () =>
      grid.style.setProperty(
        "--dg-summary-height",
        `${summaryRow.offsetHeight}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(summaryRow);
    return () => {
      observer.disconnect();
      grid.style.removeProperty("--dg-summary-height");
    };
  }, [pinnedBottomRows.length]);

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

  /**
   * Infinite scroll. Latched on the row count rather than debounced: one call
   * per count means a pending fetch is never asked twice, and the append that
   * resolves it changes the count, which re-arms the latch. A failed fetch
   * stays quiet until something changes the rows — retrying is the
   * consumer's call, not a scroll side effect.
   *
   * Effect (not render): `onReachEnd` sets consumer state.
   */
  const reachEndFiredForCountRef = useRef<number | null>(null);
  const warnedReachEndPaginationRef = useRef(false);
  const lastMountedIndex = virtualItems.at(-1)?.index ?? -1;
  useEffect(() => {
    if (onReachEnd === undefined || rows.length === 0) return;
    if (features.pagination && !warnedReachEndPaginationRef.current) {
      warnedReachEndPaginationRef.current = true;
      console.warn(
        "TMDataGrid: onReachEnd and pagination slice the same scroll — the pager caps the rows, so the end it reaches is the page's. Use one or the other.",
      );
    }
    if (lastMountedIndex < rows.length - 1 - reachEndThreshold) return;
    if (reachEndFiredForCountRef.current === rows.length) return;
    reachEndFiredForCountRef.current = rows.length;
    onReachEnd();
  });

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

  // Pinned rows count as content: with every visible row pinned to an edge,
  // an empty-state message beside them would contradict what is on screen.
  const isEmpty = rows.length === 0 && pinnedRowCount === 0;
  // Which emptiness this is. The body already subscribes to the whole table
  // store, so these reads are reactive.
  const emptyGlobalFilter = table.store.state.globalFilter;
  const hasActiveFilters =
    table.store.state.columnFilters.length > 0 ||
    (typeof emptyGlobalFilter === "string"
      ? emptyGlobalFilter.trim() !== ""
      : emptyGlobalFilter != null);

  /**
   * The summary row exists by declaration, not by flag: it renders exactly
   * when at least one visible leaf column defines a `footer`. Its cells come
   * from the leaf header group, whose headers sit in the same left → centre →
   * right order as `orderedColumns` — so `layoutFor` and the grid tracks
   * apply unchanged.
   */
  const leafHeaders = headerGroups.at(-1)?.headers ?? [];
  const hasSummaryRow = orderedColumns.some(
    (column) => column.columnDef.footer !== undefined,
  );

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

  // The value-or-function pair resolved per row, across the same erasure
  // crossing `onRowClick` makes.
  const rowClassNameFor = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
  ): string | undefined =>
    typeof rowClassName === "function"
      ? rowClassName(row as unknown as Row<TMDataGridFeatures, TData>)
      : rowClassName;
  const rowStyleFor = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
  ): CSSProperties | undefined =>
    typeof rowStyle === "function"
      ? rowStyle(row as unknown as Row<TMDataGridFeatures, TData>)
      : rowStyle;

  // The same erasure crossing `onRowClick` makes, once for all three cell
  // handlers.
  const cellEventArgs = (
    cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>,
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    event: MouseEvent<HTMLElement>,
  ): TMDataGridCellEventArgs<TData> =>
    ({
      cell,
      row,
      column: cell.column,
      event,
    }) as unknown as TMDataGridCellEventArgs<TData>;

  // ---------------------------------------------------------------------------
  // Cell selection
  //
  // Three pieces: the tab stop (which cell the browser can reach), the key
  // handler (which cell the state points at), and the effect (which cell the
  // DOM actually focuses). They are separate because under virtualization the
  // three can disagree for a frame — a move to row 4000 names a cell that has
  // no element yet — and the state is the one that is always right.
  // ---------------------------------------------------------------------------
  const cellSelection = features.cellSelection;
  const cellRangeSelection = features.cellRangeSelection;

  /**
   * That a move came from inside the grid, and so should take the DOM focus
   * with it.
   *
   * A ref rather than "is the focus in the grid?" asked at the time, because by
   * the time the effect runs the cell the key was pressed on may have unmounted
   * — a PageDown scrolls it away — and the focus with it. The intent survives
   * where the evidence does not.
   */
  const wantsCellFocusRef = useRef(false);
  /** The last position the effect acted on, so it can tell a move from a re-render. */
  const appliedCellRef = useRef<TMDataGridCellPosition | null>(null);

  // O(n) per keystroke and per render while a cell is focused. Fine at any row
  // count a grid actually holds, and the alternative — an id→index map rebuilt
  // whenever sorting, filtering or grouping changes — costs more than it saves.
  const focusedRowIndex =
    cellSelection && focusedCell !== null
      ? rows.findIndex((row) => row.id === focusedCell.rowId)
      : -1;
  const focusedColumnIndex =
    cellSelection && focusedCell !== null
      ? orderedColumns.findIndex((column) => column.id === focusedCell.columnId)
      : -1;
  const focusedCellIsMounted =
    focusedRowIndex >= 0 &&
    virtualItems.some((item) => item.index === focusedRowIndex);

  /**
   * The one cell in the body that Tab can reach.
   *
   * The focused cell when it is on screen. When it is not — the grid has never
   * been entered, or the user scrolled the focus away with the wheel — the
   * first mounted cell stands in, so the body always has exactly one tab stop.
   * Without the fallback, scrolling the focused row out of the DOM would take
   * the grid out of the tab order entirely.
   */
  const firstMountedRow = rows[virtualItems[0]?.index ?? -1];
  const tabStopCell: TMDataGridCellPosition | null = !cellSelection
    ? null
    : focusedCellIsMounted && focusedCell !== null
      ? focusedCell
      : firstMountedRow && orderedColumns[0]
        ? { rowId: firstMountedRow.id, columnId: orderedColumns[0].id }
        : null;

  const isCellAt = (
    position: TMDataGridCellPosition | null,
    rowId: string,
    columnId: string,
  ) => position !== null && position.rowId === rowId && position.columnId === columnId;

  // The rectangle, resolved from ids to the indices the cells are rendered at.
  // `null` whenever a corner has been filtered or hidden away — the range keeps
  // its ids, so lifting the filter brings the selection back.
  const rangeBounds = resolveRangeBounds({
    range: cellRangeSelection ? cellRange : null,
    rowIndexOf: (rowId) => rows.findIndex((row) => row.id === rowId),
    columnIndexOf: (columnId) =>
      orderedColumns.findIndex((column) => column.id === columnId),
  });

  /**
   * Extends the rectangle to a cell, or lays a new one-cell rectangle down.
   *
   * The anchor is what tells the two apart: extending keeps it and moves the
   * far corner, starting drops it on the cell under the pointer. Every gesture
   * that selects cells is one of these two.
   */
  const setRangeTo = (
    cell: TMDataGridCellPosition,
    { extend }: { extend: boolean },
  ) => {
    if (!cellRangeSelection) return;
    const anchor = extend ? (cellRange?.anchor ?? cell) : cell;
    ui.actions.setCellRange({ anchor, focus: cell });
  };

  /**
   * What a copy or an export would take.
   *
   * The rectangle when there is one, and the focused cell on its own when there
   * is not — under `"single"` there never is one, and under `"range"` there is
   * none until the first gesture. Copying the one cell the user is on is what
   * every spreadsheet does, so the two cases collapse into the same block here
   * rather than into two paths through the export code.
   */
  const selectionBounds =
    rangeBounds ??
    (cellSelection && focusedRowIndex >= 0 && focusedColumnIndex >= 0
      ? {
          top: focusedRowIndex,
          bottom: focusedRowIndex,
          left: focusedColumnIndex,
          right: focusedColumnIndex,
        }
      : null);
  const selectedCellCount = boundsCellCount(selectionBounds);
  /**
   * How many of the selected columns have anything to export.
   *
   * The generated lanes are part of the selection — they take the tint and the
   * outline, so the block stays a rectangle and the keyboard still reaches the
   * checkbox — but they hold controls rather than values. A rectangle covering
   * only those has nothing to copy, and the items that would say otherwise are
   * disabled rather than quietly doing nothing.
   */
  const selectedDataColumnCount =
    selectionBounds === null
      ? 0
      : orderedColumns
          .slice(selectionBounds.left, selectionBounds.right + 1)
          .filter((column) => !isControlColumn(column.id)).length;

  const exportOptions = { ...DEFAULT_CELL_EXPORT_OPTIONS, ...cellExport };
  // Sticky across menus, the way a checkbox in a dialog is: a user who exports
  // with headers once almost always wants them the next time too.
  const [exportIncludesHeaders, setExportIncludesHeaders] = useState(
    exportOptions.includeHeaders,
  );
  const buildSelectionMatrix = (includeHeaders: boolean) =>
    selectionBounds === null
      ? []
      : buildCellMatrix({
          rows,
          columns: orderedColumns,
          bounds: selectionBounds,
          includeHeaders,
          decimalComma: exportOptions.decimalComma,
        });

  /**
   * Ctrl+C. Values only, no header row — Excel's own copy does not include one
   * either, and a header pasted into the middle of a sheet is a row of text
   * where numbers were expected. The export menu is where headers are offered,
   * because a file is a document and a clipboard is a fragment.
   */
  const copySelection = async () => {
    const matrix = buildSelectionMatrix(false);
    if (matrix.length === 0) return;
    await writeClipboardText(toClipboardText(matrix));
  };

  /**
   * Whether a drag is laying down a rectangle right now.
   *
   * State rather than a ref, because the cells only listen for `mouseenter`
   * while it is true — one re-render at each end of the gesture buys a body
   * that is not running a handler per cell the rest of the time.
   */
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  // The drag ends wherever the button comes up, which is routinely outside the
  // grid — over the scrollbar, or past the window edge. Only the window hears
  // that, so only the window can end it.
  useEffect(() => {
    if (!isDraggingRange) return;
    const stop = () => setIsDraggingRange(false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [isDraggingRange]);

  const startRangeDrag = (
    position: TMDataGridCellPosition,
    { extend }: { extend: boolean },
  ) => {
    ui.actions.setFocusedCell(position);
    setRangeTo(position, { extend });
    // A Shift+click is a single act, not the start of one — there is nothing
    // left to drag once the far corner has been named.
    if (!extend) setIsDraggingRange(true);
  };

  const exportSelectionCsv = (includeHeaders: boolean) => {
    const matrix = buildSelectionMatrix(includeHeaders);
    if (matrix.length === 0) return;
    downloadTextFile({
      fileName: `${exportOptions.fileName}.csv`,
      text: toExcelCsv(matrix, { separator: exportOptions.separator }),
    });
  };

  /**
   * Moves the focus, and takes the selection with it.
   *
   * `extend` is the Shift key: held, the rectangle grows from wherever it was
   * anchored; released, it collapses onto the cell just moved to. Collapsing
   * rather than clearing keeps the invariant the copy path relies on — the
   * selection is always the block Ctrl+C would take, even when that block is
   * one cell.
   */
  const moveFocusedCell = (
    coords: { rowIndex: number; columnIndex: number },
    { extend }: { extend: boolean } = { extend: false },
  ) => {
    const row = rows[coords.rowIndex];
    const column = orderedColumns[coords.columnIndex];
    if (!row || !column) return;
    const cell = { rowId: row.id, columnId: column.id };
    // The state moves; the effect below is what makes the DOM follow, because
    // the element for an off-screen row does not exist yet to be focused.
    wantsCellFocusRef.current = true;
    ui.actions.setFocusedCell(cell);
    setRangeTo(cell, { extend });
  };

  // ---------------------------------------------------------------------------
  // Cell editing — the gestures. The engine owns the forms; this component
  // owns where the editor opens from (keys, double-click) and where the
  // focus lands when it closes.
  // ---------------------------------------------------------------------------

  /** The pending type-to-edit seed, consumed by the editor host on mount. */
  const editSeedRef = useRef<string | undefined>(undefined);
  const takeEditSeed = () => {
    const seed = editSeedRef.current;
    editSeedRef.current = undefined;
    return seed;
  };

  /** DOM focus back onto a cell — after Escape, or a commit with nowhere to go. */
  const refocusCell = (position: TMDataGridCellPosition) => {
    const container = scrollContainerRef.current;
    if (container === null) return;
    wantsCellFocusRef.current = true;
    findCellElement(container, position)?.focus();
  };

  const openEditor = (position: TMDataGridCellPosition) => {
    if (cellSelection) ui.actions.setFocusedCell(position);
    // Row mode edits whole rows: any editable cell's open gesture opens the
    // row, exactly as the lane's pencil does.
    edit.begin({
      rowId: position.rowId,
      columnId: features.editMode === "row" ? null : position.columnId,
    });
  };

  const handleEditorClose = (
    position: TMDataGridCellPosition,
    close: TMDataGridCellEditorClose,
  ) => {
    // Where the keyboard goes: Enter moves down, Tab to the next editable
    // cell (the deferring batch variants move the same way, draft in tow) —
    // everything else, and a saved row, goes back to where the edit was.
    const move =
      close.via === "enter"
        ? "down"
        : close.via === "tab" || close.via === "defer-tab"
          ? 1
          : close.via === "shift-tab" || close.via === "defer-shift-tab"
            ? -1
            : null;
    if (move === null || features.editMode === "row") {
      refocusCell(position);
      return;
    }
    const rowIndex = rows.findIndex((row) => row.id === position.rowId);
    const columnIndex = orderedColumns.findIndex(
      (column) => column.id === position.columnId,
    );
    if (rowIndex < 0 || columnIndex < 0) {
      refocusCell(position);
      return;
    }
    if (move === "down") {
      if (rowIndex + 1 < rows.length) {
        moveFocusedCell({ rowIndex: rowIndex + 1, columnIndex });
      } else {
        refocusCell(position);
      }
      return;
    }
    const next = getNextEditableCell({
      from: { rowIndex, columnIndex },
      direction: move,
      rowCount: rows.length,
      columnCount: orderedColumns.length,
      isEditable: (coords) => {
        const row = rows[coords.rowIndex];
        const column = orderedColumns[coords.columnIndex];
        return (
          row !== undefined &&
          column !== undefined &&
          edit.canEditCell(row, column)
        );
      },
    });
    if (next !== null) moveFocusedCell(next);
    else refocusCell(position);
  };

  /**
   * Space, from a cell. Checkbox semantics rather than click semantics: it adds
   * to the selection instead of replacing it, so a keyboard user builds one the
   * way they would by ticking boxes — which is what the key has taken over from.
   *
   * Group rows work because the resolver expands a tick to the descendants they
   * stand for. A grid with no selection at all falls back to the highlight,
   * which is the only thing "pick this row" can mean there.
   */
  const selectRowFromCell = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    { extend }: { extend: boolean },
  ) => {
    if (features.rowSelection && getSelectableRowIds(row).length > 0) {
      const resolved = resolveRowSelectionClick({
        rows,
        rowId: row.id,
        anchorRowId: ui.state.selectionAnchorRowId,
        modifiers: { toggle: !extend, extend },
        selection: table.store.state.rowSelection,
        canReplaceSelection: false,
      });
      table.setRowSelection(resolved.selection);
      ui.actions.setSelectionAnchor(resolved.anchorRowId);
      return;
    }
    if (features.highlightRow && !row.getIsGrouped()) {
      ui.actions.setHighlightedRow(row.id);
    }
  };

  /**
   * One handler on the grid rather than one per cell: the body mounts a few
   * hundred cells and remounts them on every scroll frame, and this closes over
   * `rows` and `orderedColumns` — which every cell would otherwise have to be
   * handed just in case it is the one that gets a key.
   *
   * The cell it is about comes off `event.target`, which is where the
   * coordinate attributes are for.
   */
  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // Focus is on something inside a cell — a checkbox, a link, an editor. Its
    // keys are its own; the one the grid still answers is the way back out.
    if (target.dataset.cell !== "true") {
      if (event.key !== "Escape") return;
      const cellElement = target.closest<HTMLElement>('[data-cell="true"]');
      if (cellElement === null) return;
      event.preventDefault();
      cellElement.focus();
      return;
    }

    const { rowId, columnId } = target.dataset;
    if (rowId === undefined || columnId === undefined) return;
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    const columnIndex = orderedColumns.findIndex(
      (column) => column.id === columnId,
    );
    if (rowIndex < 0 || columnIndex < 0) return;

    // Ctrl+C over the selection. Claimed rather than left to the browser: the
    // native copy of a grid whose rows are mostly not in the DOM would take the
    // twenty that happen to be mounted, in whatever shape the CSS left them.
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "c" || event.key === "C")
    ) {
      if (selectionBounds === null) return;
      event.preventDefault();
      void copySelection();
      return;
    }

    // Editing keys, ahead of the step-into pair — an editable cell's Enter
    // opens its editor, and only a non-editable cell's falls through to the
    // control it holds.
    const keyRow = rows[rowIndex];
    const keyColumn = orderedColumns[columnIndex];
    if (
      features.editing &&
      keyRow !== undefined &&
      keyColumn !== undefined &&
      edit.canEditCell(keyRow, keyColumn)
    ) {
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        openEditor({ rowId, columnId });
        return;
      }
      // The quick single-cell gestures — Delete-to-clear and type-to-edit —
      // sit out row mode, whose whole point is that nothing commits until
      // the row's explicit save.
      if (features.editMode !== "row") {
        // Clear-and-commit, without opening anything — the spreadsheet Delete.
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          void edit
            .clearCell(rowId, columnId)
            .then(() => refocusCell({ rowId, columnId }));
          return;
        }
        // Type-to-edit: a printable character opens the editor seeded with
        // itself. Space stays the row-selection key, modifiers stay shortcuts.
        if (
          event.key.length === 1 &&
          event.key !== " " &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          editSeedRef.current = event.key;
          openEditor({ rowId, columnId });
          return;
        }
      }
    }

    // Step into the cell. The pair Excel and AG Grid both use, and the pair the
    // editor will take over: F2 has never meant anything else, and Enter is
    // what a keyboard user reaches for. Nothing to step into leaves the key
    // alone rather than swallowing it.
    if (event.key === "Enter" || event.key === "F2") {
      const interactive = target.querySelector<HTMLElement>(FOCUSABLE_IN_CELL);
      if (interactive === null) return;
      event.preventDefault();
      interactive.focus();
      return;
    }

    // Escape drops the rectangle back to the one cell, as it drops the marching
    // ants in a spreadsheet. The focus stays where it is — Escape is about the
    // selection, not about leaving the grid.
    if (event.key === "Escape") {
      if (cellRange === null) return;
      event.preventDefault();
      setRangeTo({ rowId, columnId }, { extend: false });
      return;
    }

    // Space selects the row, from any of its cells.
    //
    // Not routed through `handleRowActivate`, which is the *click* path and only
    // selects in `"row"` mode: with the cell cursor on, the checkbox is no
    // longer a tab stop (see useCellControlTabIndex), so this is the keyboard's
    // way to a selection under every mode that has one — checkbox included.
    if (event.key === " ") {
      event.preventDefault();
      const row = rows[rowIndex];
      if (row) selectRowFromCell(row, { extend: event.shiftKey });
      return;
    }

    const next = resolveCellMove({
      key: event.key,
      ctrlKey: event.ctrlKey || event.metaKey,
      from: { rowIndex, columnIndex },
      rowCount: rows.length,
      columnCount: orderedColumns.length,
      pageRows: Math.max(
        1,
        Math.floor((scrollContainerRef.current?.clientHeight ?? 0) / rowHeight) -
          1,
      ),
    });
    if (next === null) return;
    // Claimed even when the move was clamped at an edge: letting an arrow
    // through at the last row would scroll the body out from under a focus that
    // did not move.
    event.preventDefault();
    if (next.rowIndex === rowIndex && next.columnIndex === columnIndex) return;
    // Shift extends the rectangle instead of collapsing it — the same key that
    // extends a text selection, a file list and a spreadsheet range.
    moveFocusedCell(next, { extend: event.shiftKey && cellRangeSelection });
  };

  /**
   * Puts the DOM where the state says, once the state has moved.
   *
   * No dependency array, like the page-clamp effect above: the interesting
   * moment is not a state change but the render after the virtualizer mounted
   * the row that was scrolled to, and a scroll is not in any dependency list.
   * Every path out of here is a ref comparison, so the cost of running it on
   * each frame is nil.
   */
  useEffect(() => {
    if (!cellSelection) return;
    const container = scrollContainerRef.current;
    if (container === null) return;

    if (focusedCell !== appliedCellRef.current) {
      appliedCellRef.current = focusedCell;
      // Bring the row on screen first — this is what makes a cell that is not
      // mounted focusable at all, one frame later.
      if (focusedRowIndex >= 0) {
        virtualizer.scrollToIndex(focusedRowIndex, { align: "auto" });
      }
    }
    if (focusedCell === null) {
      wantsCellFocusRef.current = false;
      return;
    }

    // Never take the focus from elsewhere on the page. A consumer moving the
    // cell while the user is typing in a form somewhere means "move the ring",
    // not "move the caret" — the scroll above already did the visible part.
    if (
      !wantsCellFocusRef.current &&
      !container.contains(document.activeElement)
    ) {
      return;
    }

    const cellElement = findCellElement(container, focusedCell);
    // Still scrolling. The intent stays up, and the next render tries again.
    if (cellElement === null) return;
    wantsCellFocusRef.current = false;
    // Focus is already inside — on the control Enter stepped into. The cell is
    // where the ring belongs, so there is nothing to move.
    if (cellElement.contains(document.activeElement)) return;

    // The vertical half is the virtualizer's, and it has already been asked.
    cellElement.focus({ preventScroll: true });
    if (layoutFor(focusedCell.columnId).pinnedAt === false) {
      keepColumnInView({
        container,
        cellElement,
        leftPinnedWidth: leftOffset,
        rightPinnedWidth: rightOffset,
      });
    }
  });

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

    // A right-click inside the selection is about the selection and leaves it
    // alone; one outside moves it first, so the menu never offers to copy a
    // block somewhere else on the screen. Spreadsheets and file managers both
    // behave this way, and the alternative — exporting cells the user cannot
    // see the outline of — is the kind of surprise that ends in a support call.
    if (cellSelection && rowId !== null && columnId !== null) {
      const rowIndex = rows.findIndex((row) => row.id === rowId);
      const columnIndex = orderedColumns.findIndex(
        (column) => column.id === columnId,
      );
      if (!isWithinBounds(selectionBounds, rowIndex, columnIndex)) {
        ui.actions.setFocusedCell({ rowId, columnId });
        setRangeTo({ rowId, columnId }, { extend: false });
      }
    }

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
  const rowMenuContent =
    rowContextMenu &&
    contextMenuTarget &&
    contextMenuRow &&
    !contextMenuRow.getIsGrouped()
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
   * The built-in half of the menu: what to do with the cells that are selected.
   *
   * Offered under `"range"` only. Under `"single"` the selection is always the
   * one cell the user is standing on, and a menu whose every item acts on it
   * would be a menu about nothing much — Ctrl+C still copies it.
   */
  const cellMenuContent =
    cellRangeSelection && contextMenuTarget !== null && selectionBounds !== null ? (
      <>
        <Menu.Label>{labels.cellCount(selectedCellCount)}</Menu.Label>
        <Menu.Item
          disabled={selectedDataColumnCount === 0}
          onClick={() => void copySelection()}
        >
          {labels.copy}
        </Menu.Item>
        <Menu.Item
          disabled={selectedDataColumnCount === 0}
          onClick={() => exportSelectionCsv(exportIncludesHeaders)}
        >
          {labels.exportCsv}
        </Menu.Item>
        {/* Stays open on click: it is the setting the item above reads, and
            reopening the menu to change your mind about headers is a worse
            answer than one that lets you see the box tick. */}
        <Menu.Item
          closeMenuOnClick={false}
          onClick={() => setExportIncludesHeaders((previous) => !previous)}
        >
          <Checkbox
            size="xs"
            checked={exportIncludesHeaders}
            label={labels.includeHeaders}
            // The item owns the click; the box only shows what it did.
            readOnly
            styles={{ input: { cursor: "pointer" } }}
          />
        </Menu.Item>
      </>
    ) : null;

  /**
   * The two halves, in the order they are about: the cells first, since the
   * right-click landed on one, then whatever the consumer offers for the row.
   */
  const contextMenuContent =
    cellMenuContent === null && rowMenuContent === null ? null : (
      <>
        {cellMenuContent}
        {cellMenuContent !== null && rowMenuContent !== null && <Menu.Divider />}
        {rowMenuContent}
      </>
    );

  /**
   * Which edges the scroll position is currently at. Seeded "at top-left",
   * which is where a grid mounts — so the callbacks report *arrivals*, and
   * mounting fires nothing.
   */
  const scrollEdgesRef = useRef({
    top: true,
    bottom: false,
    left: true,
    right: false,
  });
  const hasEdgeCallbacks =
    onScrollToTop !== undefined ||
    onScrollToBottom !== undefined ||
    onScrollToLeft !== undefined ||
    onScrollToRight !== undefined;

  /**
   * The context menu's dropdown is anchored to a fixed viewport point, so it
   * does not travel with the row when the body scrolls — and under
   * virtualization the row it belongs to may unmount entirely. Closing is
   * the honest answer, and matches what every desktop context menu does.
   *
   * The edge callbacks share the handler. Reading scroll offsets here costs
   * no layout; the 1px tolerance absorbs fractional offsets under browser
   * zoom, where a "fully scrolled" position can land at 799.5 of 800.
   */
  const handleScroll =
    contextMenuTarget || hasEdgeCallbacks
      ? (event: UIEvent<HTMLDivElement>) => {
          if (contextMenuTarget) closeContextMenu();
          if (!hasEdgeCallbacks) return;
          const el = event.currentTarget;
          const next = {
            top: el.scrollTop <= 1,
            bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
            left: el.scrollLeft <= 1,
            right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
          };
          const previous = scrollEdgesRef.current;
          scrollEdgesRef.current = next;
          if (next.top && !previous.top) onScrollToTop?.();
          if (next.bottom && !previous.bottom) onScrollToBottom?.();
          if (next.left && !previous.left) onScrollToLeft?.();
          if (next.right && !previous.right) onScrollToRight?.();
        }
      : undefined;

  return (
    <div className={classes.tableWrapper}>
      <div
        ref={scrollContainerRef}
        className={classes.scrollContainer}
        // How autosize finds the measurable subtree from a header cell.
        data-dg-scroll-container
        onScroll={handleScroll}
      >
        <div
          ref={gridElementRef}
          // A `table` is content; a `grid` is a widget with a keyboard cursor
          // in it. Which one this is depends on whether cell selection is on,
          // and saying `grid` without one would promise arrow keys that do
          // nothing.
          role={cellSelection ? "grid" : "table"}
          aria-multiselectable={
            cellSelection && features.rowSelection && features.multiRowSelection
              ? true
              : undefined
          }
          onKeyDown={cellSelection ? handleGridKeyDown : undefined}
          // A drag across cells is a selection gesture, and the browser's own
          // text selection would follow the pointer through it. Only while the
          // drag runs, so copying a cell value with the mouse still works.
          data-range-dragging={isDraggingRange || undefined}
          className={classes.grid}
          // Virtualization means most rows are not in the DOM, so the counts
          // have to be stated rather than inferred from what is rendered. Every
          // row carries its aria-rowindex for the same reason.
          aria-rowcount={
            rows.length +
            pinnedRowCount +
            headerGroups.length +
            (hasSummaryRow ? 1 : 0)
          }
          aria-colcount={orderedColumns.length}
          style={{ gridTemplateColumns, minWidth: gridMinWidth }}
        >
          <div role="rowgroup" style={{ display: "contents" }}>
            {headerGroups.map((headerGroup, groupIndex) => (
              <div
                key={headerGroup.id}
                role="row"
                aria-rowindex={groupIndex + 1}
                data-dg-header-row
                // The scrolled-under shadow belongs to the boundary between
                // header and body — the last header row, not every stacked
                // group row above it. See the stylesheet.
                data-dg-header-last={
                  groupIndex === headerGroups.length - 1 || undefined
                }
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

          {/* The entry block — new rows being typed, stuck under the header.
              Present only while `edit.addRow()` has open entries. */}
          {features.editing && newRowCount > 0 && (
            <TMDataGridEntryRows
              orderedColumns={orderedColumns}
              layoutFor={layoutFor}
              rowHeight={rowHeight}
            />
          )}

          <TMDataGridBodyRowGroup
            // Under `"range"` the grid has a menu of its own to offer, so the
            // wrapper goes on even without a consumer's `rowContextMenu`.
            enabled={rowContextMenu !== undefined || cellRangeSelection}
            menuContent={contextMenuContent}
            menuProps={rowContextMenuProps}
            onContextMenu={handleContextMenu}
            onClose={closeContextMenu}
          >
            {(() => {
              /**
               * One renderer for every body row, wherever it sits: the
               * virtualized centre, or a pinned edge block. `viewIndex` is the
               * row's index in the scrolling view — `-1` for a pinned row,
               * which takes it out of striping, row measurement and the cell
               * range, all of which are statements about the scrolling order.
               * Scoped here rather than a component so the row keeps closing
               * over the body's handlers without threading them as props.
               */
              const renderBodyRow = (
                row: Row<TMDataGridFeatures, TMDataGridRowData>,
                viewIndex: number,
                ariaRowIndex: number,
                pinnedAt?: "top" | "bottom",
              ) => {
              const isGroupRow = row.getIsGrouped();
              const isInteractive = rowGesturesFor(row);
              const rowCells = [
                ...row.getLeftVisibleCells(),
                ...row.getCenterVisibleCells(),
                ...row.getRightVisibleCells(),
              ];
              // Row mode opens every editable cell of the row at once;
              // exactly one of them may take the focus.
              const rowEditing =
                editActive !== null &&
                editActive.rowId === row.id &&
                editActive.columnId === null;
              const firstEditableColumnId = rowEditing
                ? (rowCells.find((cell) =>
                    edit.canEditCell(row, cell.column),
                  )?.column.id ?? null)
                : null;
              // Cell selection takes the body's tab stop off the row and puts
              // it on a cell — two stops per row would make Tab a way of
              // walking the grid, which is what the arrow keys are for. Space
              // on a cell keeps the selection reachable; see handleGridKeyDown.
              const takesKeyboard =
                !isGroupRow &&
                !cellSelection &&
                (selectsOnRowClick || features.highlightRow);
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={ariaRowIndex}
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
                  data-index={
                    renderDetails && viewIndex >= 0 ? viewIndex : undefined
                  }
                  ref={
                    renderDetails && viewIndex >= 0
                      ? virtualizer.measureElement
                      : undefined
                  }
                  // The tree's own rows. `data-grouped` rather than a class, to
                  // match how the rest of the row's state is published — and so
                  // a consumer can restyle them without reaching into modules.
                  data-grouped={isGroupRow}
                  data-depth={row.depth}
                  // Which edge block the row sits in, for styling hooks.
                  data-pinned={pinnedAt}
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
                  // Marked deleted under batch: struck through and inert
                  // until submitAll reports it, or the mark is toggled back.
                  data-deleted={
                    deletedRowIds.length > 0 && deletedRowIds.includes(row.id)
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
                  // From the row's position in the whole view, so the stripes
                  // survive the virtualizer's moving window — see the prop.
                  data-striped={
                    striped && viewIndex >= 0 ? viewIndex % 2 === 1 : undefined
                  }
                  className={[classes.bodyRow, rowClassNameFor(row)]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    minHeight: rowHeight,
                    cursor: isInteractive ? "pointer" : undefined,
                    ...rowStyleFor(row),
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
                  // A group row records itself only for the cell menu, which is
                  // about the cells it covers. `rowContextMenu` is still never
                  // called for one: TanStack builds a group row on its first
                  // child's record, so a render prop reaching for `row.original`
                  // would be handed a real employee that has nothing to do with
                  // the group — see where the content is built. The browser menu
                  // stays suppressed over them either way.
                  onContextMenu={
                    (rowContextMenu && !isGroupRow) || cellRangeSelection
                      ? () => {
                          contextMenuRowRef.current = row.id;
                        }
                      : undefined
                  }
                >
                  {rowCells.map((cell, cellIndex) => {
                    const isEditingCell =
                      (editActive !== null &&
                        editActive.rowId === row.id &&
                        editActive.columnId === cell.column.id) ||
                      (rowEditing && edit.canEditCell(row, cell.column));
                    return (
                    <TMDataGridBodyCell
                      key={cell.id}
                      cell={cell}
                      rowHeight={rowHeight}
                      layout={layoutFor(cell.column.id)}
                      contentOverride={
                        rowNumberById !== null &&
                        cell.column.id === ROW_NUMBER_COLUMN_ID
                          ? rowNumberById.get(row.id)
                          : undefined
                      }
                      editor={
                        isEditingCell ? (
                          <TMDataGridCellEditor
                            cell={cell}
                            row={row}
                            takeSeedText={takeEditSeed}
                            autoFocus={
                              !rowEditing ||
                              cell.column.id === firstEditableColumnId
                            }
                            onClose={(close) =>
                              handleEditorClose(
                                { rowId: row.id, columnId: cell.column.id },
                                close,
                              )
                            }
                          />
                        ) : undefined
                      }
                      onClick={
                        onCellClick && !isGroupRow
                          ? (event) =>
                              onCellClick(cellEventArgs(cell, row, event))
                          : undefined
                      }
                      onDoubleClick={
                        (features.editing || onCellDoubleClick) && !isGroupRow
                          ? (event) => {
                              onCellDoubleClick?.(
                                cellEventArgs(cell, row, event),
                              );
                              if (!features.editing) return;
                              if (!edit.canEditCell(row, cell.column)) return;
                              openEditor({
                                rowId: row.id,
                                columnId: cell.column.id,
                              });
                            }
                          : undefined
                      }
                      // The cells come out in the same left → centre → right
                      // order as `orderedColumns`, which is what lets the index
                      // here stand for the column index everywhere else.
                      nav={
                        cellSelection
                          ? {
                              rowId: row.id,
                              columnIndex: cellIndex + 1,
                              focused: isCellAt(
                                focusedCell,
                                row.id,
                                cell.column.id,
                              ),
                              tabIndex: isCellAt(
                                tabStopCell,
                                row.id,
                                cell.column.id,
                              )
                                ? 0
                                : -1,
                              // "Selected" means "in the block Ctrl+C would
                              // take" — which under `"single"` is the one cell
                              // the user is standing on.
                              selected: cellRangeSelection
                                ? isWithinBounds(rangeBounds, viewIndex, cellIndex)
                                : isCellAt(focusedCell, row.id, cell.column.id),
                              edges: boundsEdges(rangeBounds, viewIndex, cellIndex),
                            }
                          : undefined
                      }
                      onFocus={
                        cellSelection
                          ? () =>
                              ui.actions.setFocusedCell({
                                rowId: row.id,
                                columnId: cell.column.id,
                              })
                          : undefined
                      }
                      onMouseDown={
                        cellRangeSelection
                          ? (event) => {
                              // Right-click is the menu's; the middle button is
                              // the browser's.
                              if (event.button !== 0) return;
                              // Shift+click would otherwise smear the browser's
                              // own text selection across everything between
                              // the two cells.
                              if (event.shiftKey) event.preventDefault();
                              wantsCellFocusRef.current = true;
                              startRangeDrag(
                                { rowId: row.id, columnId: cell.column.id },
                                { extend: event.shiftKey },
                              );
                            }
                          : undefined
                      }
                      // Only bound while a drag is running, so the other 99% of
                      // the time the body carries no pointer handlers per cell.
                      onMouseEnter={
                        cellRangeSelection && isDraggingRange
                          ? () =>
                              setRangeTo(
                                { rowId: row.id, columnId: cell.column.id },
                                { extend: true },
                              )
                          : undefined
                      }
                      onContextMenu={
                        rowContextMenu || cellRangeSelection || onCellContextMenu
                          ? (event) => {
                              contextMenuColumnRef.current = cell.column.id;
                              if (isGroupRow) return;
                              onCellContextMenu?.(
                                cellEventArgs(cell, row, event),
                              );
                            }
                          : undefined
                      }
                    />
                    );
                  })}

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
              };

              return (
                <>
                  {/* The pinned edge blocks. Same sticky mechanics as the
                      entry block — the *block* is the sticky element, its rows
                      flow normally inside it. `role="presentation"` keeps the
                      wrapper out of the accessibility tree, so the rows stay
                      direct children of the rowgroup. Inside the rowgroup so
                      a right-click on a pinned row still opens the menu. */}
                  {pinnedTopRows.length > 0 && (
                    <div
                      role="presentation"
                      data-testid="dg-pinned-top"
                      className={classes.pinnedTopBlock}
                    >
                      {pinnedTopRows.map((row, index) =>
                        renderBodyRow(
                          row,
                          -1,
                          headerGroups.length + index + 1,
                          "top",
                        ),
                      )}
                    </div>
                  )}

                  {paddingTop > 0 && (
                    <div
                      aria-hidden
                      style={{ gridColumn: "1/-1", height: paddingTop }}
                    />
                  )}

                  {virtualItems.map((virtualItem) => {
                    const row = rows[virtualItem.index];
                    if (!row) return null;
                    return renderBodyRow(
                      row,
                      virtualItem.index,
                      virtualItem.index +
                        headerGroups.length +
                        pinnedTopRows.length +
                        1,
                    );
                  })}

                  {paddingBottom > 0 && (
                    <div
                      aria-hidden
                      style={{ gridColumn: "1/-1", height: paddingBottom }}
                    />
                  )}

                  {pinnedBottomRows.length > 0 && (
                    <div
                      role="presentation"
                      data-testid="dg-pinned-bottom"
                      className={classes.pinnedBottomBlock}
                    >
                      {pinnedBottomRows.map((row, index) =>
                        renderBodyRow(
                          row,
                          -1,
                          headerGroups.length +
                            pinnedTopRows.length +
                            rows.length +
                            index +
                            1,
                          "bottom",
                        ),
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </TMDataGridBodyRowGroup>

          {/* The empty matrix, one state at a time: loading wins (data is on
              its way, "empty" would be a lie), open entry rows show only
              themselves (a "no rows" under the row being typed reads as a
              contradiction), then the consumer's blank slate, then the two
              defaults — filtered-empty with its search icon, truly-empty as
              plain text, because only one of them is the user's own doing. */}
          {isEmpty && loading === true && (
            <div role="row" className={classes.messageRow}>
              <Loader size="lg" aria-label={labels.loading} />
            </div>
          )}

          {isEmpty && loading !== true && newRowCount === 0 && (
            <div role="row" className={classes.messageRow}>
              {renderEmptyState !== undefined ? (
                renderEmptyState({
                  hasActiveFilters,
                  table: table as unknown as Table<TMDataGridFeatures, TData>,
                })
              ) : hasActiveFilters ? (
                <>
                  <SearchIcon size={40} stroke={1.4} opacity={0.4} />
                  <Text size={controlSize} c="dimmed">
                    {noResultsLabel}
                  </Text>
                </>
              ) : (
                <Text size={controlSize} c="dimmed">
                  {labels.noRows}
                </Text>
              )}
            </div>
          )}

          {/* Sticky along the bottom edge, the way the header is along the
              top. `flexRender` with the header context, which is what a
              TanStack `footer` renderer is written against. */}
          {hasSummaryRow && (
            <div
              role="row"
              aria-rowindex={
                rows.length + pinnedRowCount + headerGroups.length + 1
              }
              data-testid="dg-summary-row"
              className={classes.summaryRow}
            >
              {leafHeaders.map((header) => {
                const layout = layoutFor(header.column.id);
                return (
                  <div
                    key={header.id}
                    role="cell"
                    data-column-id={header.column.id}
                    data-align={getColumnAlign(header.column)}
                    data-control-column={isControlColumn(header.column.id)}
                    className={[
                      classes.summaryCell,
                      layout.isBoundary && layout.pinnedAt === "left"
                        ? sticky.stickyLeft
                        : "",
                      layout.isBoundary && layout.pinnedAt === "right"
                        ? sticky.stickyRight
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      minHeight: rowHeight,
                      left:
                        layout.pinnedAt === "left" ? layout.offset : undefined,
                      right:
                        layout.pinnedAt === "right" ? layout.offset : undefined,
                      position: layout.pinnedAt ? "sticky" : undefined,
                      zIndex: layout.pinnedAt
                        ? "var(--dg-z-summary-pinned-cell, 5)"
                        : undefined,
                    }}
                  >
                    <span className={classes.cellContent}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.footer,
                            header.getContext(),
                          )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TMDataGridFilterPanel />
    </div>
  );
}

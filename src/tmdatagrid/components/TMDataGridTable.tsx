import { Loader, Text } from "@mantine/core";
import {
  type Cell,
  flexRender,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import classes from "./TMDataGridTable.module.css";
import sticky from "./sticky.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import { TMDataGridFilterPanel } from "./TMDataGridFilterPanel";
import { TMDataGridHeaderCell } from "./TMDataGridHeaderCell";
import { getColumnAlign } from "../core/columnUtils";
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

function TMDataGridBodyCell({
  cell,
  rowHeight,
  layout,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  rowHeight: number;
  layout: TMDataGridColumnLayout;
}) {
  return (
    <div
      role="cell"
      data-align={getColumnAlign(cell.column)}
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
      <span className={classes.cellContent}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </span>
    </div>
  );
}

export type TMDataGridTableProps<TData extends RowData> = {
  /**
   * Called when a body row is clicked. Runs in addition to row selection under
   * `rowSelectionMode: "row"`, not instead of it.
   */
  onRowClick?: (row: Row<TMDataGridFeatures, TData>) => void;
};

/**
 * The scrollable grid surface. Always virtualized: only the rows inside the
 * viewport (plus overscan) are mounted — which is what makes the default
 * no-pagination mode viable at any row count. Pagination is opt-in via
 * `enablePagination` (or implied by `manualPagination`).
 */
export function TMDataGridTable<TData extends RowData = TMDataGridRowData>({
  onRowClick,
}: TMDataGridTableProps<TData>) {
  const { table, features, rowHeight, controlSize } = useTMDataGridContext();

  // The body depends on every state slice (sorting, filters, paging, sizing,
  // visibility, selection), so it subscribes to the whole table store.
  useSelector(table.store);

  const { loading, noResultsLabel = "No rows match your filters" } =
    table.options.meta ?? {};

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Pagination off (the default): every filtered+sorted row, virtualized.
  // Pagination on: the current page; under `manualPagination` TanStack returns
  // the rows as delivered, so the same branch serves server paging.
  const rows = features.pagination
    ? table.getPaginatedRowModel().rows
    : table.getPrePaginatedRowModel().rows;

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
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    getItemKey: useCallback((index: number) => rows[index]?.id ?? index, [rows]),
    overscan: 6,
    initialRect: { height: 600, width: 1200 },
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);

  const leftLeafColumns = table.getLeftLeafColumns();
  const rightLeafColumns = table.getRightLeafColumns();
  const centerLeafColumns = table.getCenterLeafColumns();

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

  // "row" mode: the row itself is the selection control — clicking it toggles
  // that row and leaves the rest of the selection alone.
  const selectsOnRowClick =
    features.rowSelection && features.rowSelectionMode === "row";
  const rowIsInteractive = selectsOnRowClick || onRowClick !== undefined;

  const handleRowActivate = (row: Row<TMDataGridFeatures, TMDataGridRowData>) => {
    if (selectsOnRowClick && row.getCanSelect()) row.toggleSelected();
    onRowClick?.(row as unknown as Row<TMDataGridFeatures, TData>);
  };

  return (
    <div className={classes.tableWrapper}>
      <div ref={scrollContainerRef} className={classes.scrollContainer}>
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

          <div role="rowgroup" style={{ display: "contents" }}>
            {virtualItems.map((virtualItem) => {
              const row = rows[virtualItem.index];
              if (!row) return null;
              return (
                <div
                  key={virtualItem.key}
                  role="row"
                  aria-rowindex={virtualItem.index + headerGroups.length + 1}
                  data-testid={`dg-row-${row.id}`}
                  data-selected={row.getIsSelected()}
                  // Selection is state; the highlight is a display choice, so
                  // the two are separate attributes.
                  data-highlighted={
                    features.highlightSelectedRows && row.getIsSelected()
                  }
                  data-selects-on-click={selectsOnRowClick}
                  aria-selected={
                    features.rowSelection ? row.getIsSelected() : undefined
                  }
                  className={classes.bodyRow}
                  style={{
                    minHeight: rowHeight,
                    cursor: rowIsInteractive ? "pointer" : undefined,
                  }}
                  // Keyboard parity with the checkbox the row replaces.
                  tabIndex={selectsOnRowClick ? 0 : undefined}
                  onClick={
                    rowIsInteractive ? () => handleRowActivate(row) : undefined
                  }
                  onKeyDown={
                    selectsOnRowClick
                      ? (event) => {
                          if (event.key !== " " && event.key !== "Enter") return;
                          if (event.target !== event.currentTarget) return;
                          event.preventDefault();
                          handleRowActivate(row);
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
                    />
                  ))}
                </div>
              );
            })}
          </div>

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

import { useCreateStore } from "@tanstack/react-store";
import {
  type ColumnDef,
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  metaHelper,
  type RowData,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  type Table,
  tableFeatures,
  type TableOptions,
  useTable,
} from "@tanstack/react-table";
import type { Store } from "@tanstack/store";
import { useEffect, useMemo, useState } from "react";
import {
  type TMDataGridColumnType,
  tmDataGridFilterFn,
  getDefaultOperator,
} from "./filterOperators";
import {
  hasPersistenceKeys,
  readPersistedState,
  type TMDataGridPersistence,
  writePersistedState,
} from "./persistence";
import {
  readFeatureFlags,
  type TMDataGridFeatureFlags,
  type TMDataGridRowSelectionMode,
} from "./capabilities";
import {
  createSelectColumn,
  SELECT_COLUMN_ID,
} from "./TMDataGridSelectColumn";

/** Per-column configuration the TMDataGrid chrome reads. */
export type TMDataGridColumnMeta = {
  /** Name shown in menus and the column manager. Falls back to a string header. */
  label?: string;
  /** Drives which filter operators are offered. Defaults to `"string"`. */
  type?: TMDataGridColumnType;
  /** Share of the leftover width this column claims. Defaults to `1`. */
  flex?: number;
  align?: "left" | "right" | "center";
  /**
   * `false` keeps the column where it is: no header dragging, no move items.
   * Column ordering is the one feature TanStack defines no column option for,
   * so its switch lives here rather than on the column definition.
   */
  enableOrdering?: boolean;
};

/** Grid-wide configuration passed through `options.meta`. */
export type TMDataGridTableMeta = {
  loading?: boolean;
  noResultsLabel?: string;
  /** Row height used by the virtualizer. Defaults to `52`. */
  rowHeight?: number;
  /**
   * Unfiltered row total. Only needed for server-driven grids, where the client
   * never holds the full data set — `TMDataGrid.SummaryCount` uses it as denominator.
   */
  totalRowCount?: number;
};

/**
 * Every feature the TMDataGrid chrome can drive. Defined at module scope so the
 * reference stays stable across renders (see the TanStack table-state skill).
 */
export const tmDataGridFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnFacetingFeature,

  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  facetedUniqueValues: createFacetedUniqueValues(),

  filterFns: { ...filterFns, tmDataGrid: tmDataGridFilterFn },
  sortFns,

  tableMeta: metaHelper<TMDataGridTableMeta>(),
  columnMeta: metaHelper<TMDataGridColumnMeta>(),
});

export type TMDataGridFeatures = typeof tmDataGridFeatures;

export type TMDataGridTable<TData extends RowData> = Table<
  TMDataGridFeatures,
  TData
>;

export function createTMDataGridColumnHelper<TData extends RowData>() {
  return createColumnHelper<TMDataGridFeatures, TData>();
}

/**
 * Chrome state that is *not* table state: which panels are open, and which
 * column opened the filter panel. Kept in a TanStack Store so consumers can
 * subscribe to it the same way they subscribe to `table.store`.
 */
export type TMDataGridUiState = {
  filterPanelOpen: boolean;
  columnsPanelOpen: boolean;
  /** Column whose filter row should be focused when the panel opens. */
  filterPanelColumnId: string | null;
  /**
   * Column being dragged by its header, if any. Held here rather than read from
   * `dataTransfer`, which browsers keep unreadable until the drop.
   */
  draggedColumnId: string | null;
};

export type TMDataGridUiActions = {
  openFilterPanel: (columnId?: string | null) => void;
  closeFilterPanel: () => void;
  setColumnsPanelOpen: (open: boolean) => void;
  toggleColumnsPanel: () => void;
  startColumnDrag: (columnId: string) => void;
  endColumnDrag: () => void;
};

export type TMDataGridUiStore = Store<TMDataGridUiState, TMDataGridUiActions>;

/** What `useTMDataGrid` returns — spread straight onto `<TMDataGrid />`. */
export type TMDataGridApi<TData extends RowData> = {
  table: TMDataGridTable<TData>;
  ui: TMDataGridUiStore;
  /** Table-level feature switches, re-read from options on every render. */
  features: TMDataGridFeatureFlags;
};

export type UseTMDataGridOptions<TData extends RowData> = Omit<
  TableOptions<TMDataGridFeatures, TData>,
  "features"
> & {
  /**
   * Restore and persist table state across mounts. Two keys, because the two
   * kinds of state have different lifetimes — see {@link TMDataGridPersistence}.
   *
   * Keep the object referentially stable (module scope or `useMemo`); it is a
   * dependency of the subscription that writes back.
   */
  persist?: TMDataGridPersistence;
  /**
   * Header drag-and-drop and the move items in the column menu. Defaults to
   * `true`.
   *
   * The one feature switch the grid defines itself: TanStack's
   * `columnOrderingFeature` ships state and APIs but no `enable` option, since
   * reordering is entirely a matter of interface.
   */
  enableColumnOrdering?: boolean;
  /**
   * Client-side pagination and the built-in `TMDataGrid.Footer` pager.
   * Defaults to `false`: the grid renders every filtered row and relies on
   * virtualization.
   *
   * The second grid-defined switch (TanStack defines no `enablePagination`
   * option). `manualPagination: true` implies it — a server-paged grid needs
   * no extra flag.
   */
  enablePagination?: boolean;
  /**
   * How rows are selected. Defaults to `"checkbox"`.
   *
   * - `"checkbox"` — the generated checkbox column selects; clicking a row
   *   elsewhere does not.
   * - `"row"` — no checkbox column; clicking a row toggles it. Other rows keep
   *   their state, so a click never clears the rest of the selection.
   *
   * Ignored when `enableRowSelection` is `false`. Both modes write to the same
   * `rowSelection` state.
   */
  rowSelectionMode?: TMDataGridRowSelectionMode;
  /**
   * Give selected rows the highlight background. Defaults to `true` under
   * `rowSelectionMode: "row"`, where the highlight is the only feedback a click
   * gives, and `false` under `"checkbox"`, where the box already shows it.
   *
   * The colour is the `--dg-row-selected-bg` CSS variable, so it can be changed
   * without turning the flag on or off:
   *
   * ```tsx
   * <TMDataGrid
   *   {...grid}
   *   style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
   * />
   * ```
   */
  highlightSelectedRows?: boolean;
};

type TMDataGridColumnDef<TData extends RowData> = ColumnDef<
  TMDataGridFeatures,
  TData,
  unknown
>;

/**
 * Point every column at the operator-dispatching filter function unless the
 * column opted into its own.
 */
function withTMDataGridDefaults<TData extends RowData>(
  columns: ReadonlyArray<TMDataGridColumnDef<TData>>,
): Array<TMDataGridColumnDef<TData>> {
  return columns.map((column) => {
    if ("columns" in column && Array.isArray(column.columns)) {
      return {
        ...column,
        columns: withTMDataGridDefaults<TData>(column.columns),
      };
    }
    return { filterFn: "tmDataGrid", ...column } as TMDataGridColumnDef<TData>;
  });
}

/**
 * Builds a TMDataGrid table plus its chrome store.
 *
 * Every `TableOptions` field passes straight through, so a server-driven grid
 * only needs `manualPagination` / `manualFiltering` / `manualSorting`,
 * `rowCount` and the matching `onXChange` callbacks — the chrome reads
 * `getRowCount()` / `getPageCount()` / `getPaginatedRowModel()`, all of which
 * already respect manual mode. `manualPagination` also switches the pagination
 * flag on, so `<TMDataGrid.Footer />` renders its pager without further
 * options.
 */
export function useTMDataGrid<TData extends RowData>({
  persist,
  // Not TanStack options, so they are kept out of what `useTable` receives.
  enableColumnOrdering,
  enablePagination,
  rowSelectionMode,
  highlightSelectedRows,
  ...options
}: UseTMDataGridOptions<TData>): TMDataGridApi<TData> {
  const selectionEnabled = options.enableRowSelection !== false;
  const pinningEnabled = options.enableColumnPinning !== false;
  // Only "checkbox" mode owns a column; "row" mode selects from the row itself.
  const selectColumnEnabled =
    selectionEnabled && rowSelectionMode !== "row";

  const columns = useMemo(() => {
    const base = withTMDataGridDefaults<TData>(
      options.columns as ReadonlyArray<TMDataGridColumnDef<TData>>,
    );
    return selectColumnEnabled ? [createSelectColumn<TData>(), ...base] : base;
  }, [options.columns, selectColumnEnabled]);

  // Read once on mount: `initialState` is only consumed on the first render,
  // and re-reading later would fight the user's live edits.
  const [persistedState] = useState(() => readPersistedState(persist));

  const table = useTable({
    columnResizeMode: "onChange",
    enableSorting: true,
    enableColumnResizing: true,
    globalFilterFn: "includesString",
    ...options,
    features: tmDataGridFeatures,
    columns: columns as TableOptions<TMDataGridFeatures, TData>["columns"],
    initialState: {
      ...options.initialState,
      ...persistedState,
      columnPinning: {
        // The checkbox column is structurally pinned, so it is re-applied on
        // top of anything restored from storage.
        left: [
          ...(selectColumnEnabled && pinningEnabled ? [SELECT_COLUMN_ID] : []),
          ...(
            persistedState.columnPinning?.left ??
            options.initialState?.columnPinning?.left ??
            []
          ).filter((id) => id !== SELECT_COLUMN_ID),
        ],
        right:
          persistedState.columnPinning?.right ??
          options.initialState?.columnPinning?.right ??
          [],
      },
      pagination: {
        pageIndex: 0,
        pageSize: 25,
        ...options.initialState?.pagination,
        ...persistedState.pagination,
      },
    },
  });

  // Mirror every state change back to storage. Subscribing (rather than writing
  // from an effect on a state snapshot) means nothing is missed, including
  // changes made straight through the table API by the consumer.
  useEffect(() => {
    if (!hasPersistenceKeys(persist)) return;
    writePersistedState(table.store.state, persist);
    const subscription = table.store.subscribe((state) => {
      writePersistedState(state, persist);
    });
    return () => subscription.unsubscribe();
  }, [persist, table]);

  const ui = useCreateStore<TMDataGridUiState, TMDataGridUiActions>(
    {
      filterPanelOpen: false,
      columnsPanelOpen: false,
      filterPanelColumnId: null,
      draggedColumnId: null,
    },
    ({ setState }) => ({
      openFilterPanel: (columnId = null) =>
        setState((prev) => ({
          ...prev,
          filterPanelOpen: true,
          filterPanelColumnId: columnId,
        })),
      closeFilterPanel: () =>
        setState((prev) => ({
          ...prev,
          filterPanelOpen: false,
          filterPanelColumnId: null,
        })),
      setColumnsPanelOpen: (open) =>
        setState((prev) => ({ ...prev, columnsPanelOpen: open })),
      toggleColumnsPanel: () =>
        setState((prev) => ({ ...prev, columnsPanelOpen: !prev.columnsPanelOpen })),
      startColumnDrag: (columnId) =>
        setState((prev) => ({ ...prev, draggedColumnId: columnId })),
      endColumnDrag: () =>
        setState((prev) => ({ ...prev, draggedColumnId: null })),
    }),
  );

  // Deliberately not memoized on `table`: the flags must re-derive whenever the
  // caller passes different options, and `table` keeps the same identity when
  // they do. See readFeatureFlags.
  const features = readFeatureFlags({
    ...options,
    enableColumnOrdering,
    enablePagination,
    rowSelectionMode,
    highlightSelectedRows,
  });

  return { table, ui, features };
}

/**
 * Opens the filter panel for a column, seeding an empty filter row when the
 * column has none yet — mirrors "Filter" in the column header menu.
 */
export function openColumnFilter<TData extends RowData>(
  api: TMDataGridApi<TData>,
  columnId: string,
): void {
  const column = api.table.getColumn(columnId);
  if (column && column.getFilterValue() === undefined) {
    column.setFilterValue({
      operator: getDefaultOperator(column.columnDef.meta?.type ?? "string"),
      value: "",
    });
  }
  api.ui.actions.openFilterPanel(columnId);
}

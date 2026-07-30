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
  type TableState,
  useTable,
} from "@tanstack/react-table";
import type { Store } from "@tanstack/store";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type TMDataGridColumnType,
  tmDataGridFilterFn,
  getDefaultOperator,
} from "./core/filterOperators";
import {
  hasPersistenceKeys,
  readPersistedState,
  type TMDataGridPersistence,
  writePersistedState,
} from "./core/persistence";
import {
  readFeatureFlags,
  type TMDataGridFeatureFlags,
  type TMDataGridSelectionMode,
} from "./core/capabilities";
import {
  createSelectColumn,
  SELECT_COLUMN_ID,
} from "./components/TMDataGridSelectColumn";

/**
 * How long the grid waits after the last state change before writing to
 * storage. Long enough to collapse a resize drag into one write, short enough
 * that a reload right after a change still sees it.
 */
const PERSIST_DEBOUNCE_MS = 200;

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
  /**
   * The single highlighted row — the one a detail panel would be showing. Its
   * own concept, not a slice of `rowSelection`: under
   * `selectionMode: "checkboxAndHighlight"` the two coexist, and TanStack's one
   * selection map cannot hold both.
   *
   * Not pruned when the row is filtered out, paged away or dropped from `data`,
   * matching how TanStack treats `rowSelection` — nothing there resets it
   * either. The row simply renders unhighlighted, and highlights again if it
   * comes back.
   */
  highlightedRowId: string | null;
  /** The pivot a shift-click extends from. See resolveRowSelectionClick. */
  selectionAnchorRowId: string | null;
};

export type TMDataGridUiActions = {
  openFilterPanel: (columnId?: string | null) => void;
  closeFilterPanel: () => void;
  setColumnsPanelOpen: (open: boolean) => void;
  toggleColumnsPanel: () => void;
  startColumnDrag: (columnId: string) => void;
  endColumnDrag: () => void;
  /**
   * Moves the active row, or clears it with `null` — which is how a consumer
   * closing its detail panel puts the grid back in step.
   */
  setHighlightedRow: (rowId: string | null) => void;
  setSelectionAnchor: (rowId: string | null) => void;
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
   * | Mode | Checkbox column | Row click |
   * | ---- | --------------- | --------- |
   * | `"checkbox"` | yes, multi-select | nothing |
   * | `"row"` | no | multi-selects, Ctrl/Shift modifiers |
   * | `"checkboxAndHighlight"` | yes, multi-select | highlights one row |
   * | `"highlight"` | no | highlights one row, no selection at all |
   *
   * One option rather than two, so the combination that cannot work — a click
   * that both toggles a multi-selection and moves the highlight — is not
   * expressible.
   *
   * The first two write to TanStack's `rowSelection`. The highlight is separate
   * state, which is what lets `"checkboxAndHighlight"` run both at once: tick
   * rows for a bulk action, click one to open its detail panel. See
   * `defaultHighlightedRowId` / `onHighlightedRowChange`.
   *
   * `enableRowSelection` still gates the selection half, predicate form
   * included; under `"highlight"` there is nothing for it to gate.
   */
  selectionMode?: TMDataGridSelectionMode;
  /**
   * Give selected rows the highlight background. Defaults to `true` under
   * `selectionMode: "row"`, where the highlight is the only feedback a click
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
  showSelectedBackground?: boolean;
  /**
   * The row that starts out highlighted, under a `selectionMode` that has a
   * highlight. Read once on mount, like `initialState`.
   *
   * The grid never persists the highlighted row. Pair this with
   * {@link onHighlightedRowChange} and keep it wherever it belongs — for a
   * detail panel that is usually the route, which gets you a shareable link and
   * a working back button as well as surviving a reload:
   *
   * ```tsx
   * const { rowId } = useParams();
   * useTMDataGrid({
   *   selectionMode: "highlight",
   *   defaultHighlightedRowId: rowId,
   *   onHighlightedRowChange: (id) => navigate(id ? `/employees/${id}` : "/employees"),
   * });
   * ```
   */
  defaultHighlightedRowId?: string | null;
  /**
   * Called with the newly highlighted row id, or `null` when it is cleared.
   * Fires for `ui.actions.setHighlightedRow` too, not only for clicks.
   */
  onHighlightedRowChange?: (rowId: string | null) => void;
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
  selectionMode,
  showSelectedBackground,
  defaultHighlightedRowId,
  onHighlightedRowChange,
  ...options
}: UseTMDataGridOptions<TData>): TMDataGridApi<TData> {
  // Derived up here, rather than just before the return, because the rest of the
  // hook needs `selectColumn` — one place decides what each mode means.
  //
  // Deliberately not memoized on `table`: the flags must re-derive whenever the
  // caller passes different options, and `table` keeps the same identity when
  // they do. See readFeatureFlags.
  const features = readFeatureFlags({
    ...options,
    enableColumnOrdering,
    enablePagination,
    selectionMode,
    showSelectedBackground,
  });

  const pinningEnabled = options.enableColumnPinning !== false;
  const selectColumnEnabled = features.selectColumn;

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
  //
  // Writes are debounced because `columnResizeMode: "onChange"` publishes a new
  // state on every pointer move of a resize drag, and `setItem` serialises
  // synchronously on the main thread. The trailing edge is enough: storage only
  // has to agree with the table once the user stops.
  useEffect(() => {
    if (!hasPersistenceKeys(persist)) return;
    writePersistedState(table.store.state, persist);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let pending: TableState<TMDataGridFeatures> | null = null;

    const flush = () => {
      timeout = undefined;
      if (pending === null) return;
      writePersistedState(pending, persist);
      pending = null;
    };

    const subscription = table.store.subscribe((state) => {
      pending = state;
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = setTimeout(flush, PERSIST_DEBOUNCE_MS);
    });

    return () => {
      subscription.unsubscribe();
      if (timeout !== undefined) clearTimeout(timeout);
      // An unmount mid-debounce would otherwise drop the last change.
      flush();
    };
  }, [persist, table]);

  const ui = useCreateStore<TMDataGridUiState, TMDataGridUiActions>(
    {
      filterPanelOpen: false,
      columnsPanelOpen: false,
      filterPanelColumnId: null,
      draggedColumnId: null,
      // `useCreateStore` builds the store once per mount, so this is a genuine
      // default rather than a value that would fight later clicks.
      highlightedRowId: defaultHighlightedRowId ?? null,
      selectionAnchorRowId: null,
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
      setHighlightedRow: (rowId) =>
        setState((prev) => ({ ...prev, highlightedRowId: rowId })),
      setSelectionAnchor: (rowId) =>
        setState((prev) => ({ ...prev, selectionAnchorRowId: rowId })),
    }),
  );

  // `onHighlightedRowChange` is fired from a subscription rather than from the store
  // action, so it covers every route to a new active row — a row click, and a
  // consumer calling `setHighlightedRow` itself. Held in a ref because the store is
  // built once and its actions would otherwise close over the first render's
  // callback.
  const onHighlightedRowChangeRef = useRef(onHighlightedRowChange);
  useEffect(() => {
    onHighlightedRowChangeRef.current = onHighlightedRowChange;
  }, [onHighlightedRowChange]);

  useEffect(() => {
    // Seeded from the current value so mounting with a `defaultHighlightedRowId`
    // does not report a change that nothing made.
    let previous = ui.state.highlightedRowId;
    const subscription = ui.subscribe((state) => {
      if (state.highlightedRowId === previous) return;
      previous = state.highlightedRowId;
      onHighlightedRowChangeRef.current?.(state.highlightedRowId);
    });
    return () => subscription.unsubscribe();
  }, [ui]);

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

import { useCreateStore } from "@tanstack/react-store";
import {
  aggregationFns,
  type ColumnDef,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  metaHelper,
  type Row,
  type RowData,
  rowExpandingFeature,
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
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { TMDataGridRowData } from "./TMDataGridContext";
import type { TMDataGridOptionsSource } from "./core/columnOptions";
import {
  createEditEngine,
  type TMDataGridEditApi,
  type TMDataGridEditCommitArgs,
  type TMDataGridEditCommitBatchArgs,
  type TMDataGridEditEngineContext,
  type TMDataGridEditMode,
  type TMDataGridEditorRenderer,
  type TMDataGridFieldValidate,
  type TMDataGridRowValidators,
} from "./core/editEngine";
import {
  type TMDataGridColumnType,
  tmDataGridFilterFn,
  getDefaultOperator,
} from "./core/filterOperators";
import {
  mergeLabels,
  type TMDataGridLabels,
  type TMDataGridLabelsOverride,
} from "./core/labels";
import {
  hasPersistenceKeys,
  readPersistedState,
  type TMDataGridPersistence,
  writePersistedState,
} from "./core/persistence";
import {
  readFeatureFlags,
  type TMDataGridCellSelectionMode,
  type TMDataGridFeatureFlags,
  type TMDataGridSelectionMode,
} from "./core/capabilities";
import {
  isSameCell,
  type TMDataGridCellPosition,
} from "./core/cellNavigation";
import type { TMDataGridCellRange } from "./core/cellRange";
import {
  createSelectColumn,
  SELECT_COLUMN_ID,
} from "./components/TMDataGridSelectColumn";
import {
  createGroupColumn,
  GROUP_COLUMN_ID,
} from "./components/TMDataGridGroupColumn";
import {
  createDetailsColumn,
  DETAILS_COLUMN_ID,
} from "./components/TMDataGridDetailsColumn";
import {
  createEditColumn,
  EDIT_COLUMN_ID,
} from "./components/TMDataGridEditColumn";

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
  /**
   * Drives which filter operators are offered and, once editing is on, which
   * editor the cell opens. Defaults to `"string"`.
   */
  type?: TMDataGridColumnType;
  /**
   * The choices of a `select` / `multiSelect` column — one declaration feeding
   * the filter panel's value control and the cell editor alike. A static
   * array, `"faceted"` (the distinct values present in the data), or a
   * function of the table, column and — for editors — the row. See
   * {@link TMDataGridOptionsSource}.
   */
  options?: TMDataGridOptionsSource;
  /** Share of the leftover width this column claims. Defaults to `1`. */
  flex?: number;
  align?: "left" | "right" | "center";
  /**
   * Size the column to its widest mounted content once, after the first rows
   * render — unless a persisted or user-set width already covers it. The same
   * measurement as double-clicking the resize divider; see `autosizeColumn`.
   */
  autoSize?: boolean;
  /**
   * `false` keeps the column where it is: no header dragging, no move items.
   * Column ordering is the one feature TanStack defines no column option for,
   * so its switch lives here rather than on the column definition.
   */
  enableOrdering?: boolean;
  /**
   * Whether this column's cells take edits, once `editMode` is on. `false`
   * switches the column off outright; a predicate decides per row. Defaults
   * to editable for any column that maps to a field — see {@link editField}.
   */
  editable?:
    | boolean
    | ((row: Row<TMDataGridFeatures, TMDataGridRowData>) => boolean);
  /**
   * The data path this column edits, when it is not the `accessorKey` — the
   * only way a column built on `accessorFn` becomes editable. Dot paths reach
   * into nested records: `"address.city"`.
   */
  editField?: string;
  /**
   * Field-level validators, in TanStack Form's own vocabulary. A bare Zod
   * schema (or any Standard Schema, or a plain function) means
   * `{ onChange: it }`; the object form takes every trigger Form defines.
   *
   * ```tsx
   * meta: { validate: z.string().min(2, "Too short") }
   * meta: { validate: { onBlur: z.string().email() } }
   * ```
   */
  validate?: TMDataGridFieldValidate;
  /**
   * Replaces the built-in editor for this column. Receives the live TanStack
   * Form `field` API plus the table context — the same contract the
   * built-ins fill. See {@link TMDataGridEditorArgs}.
   */
  renderEditor?: TMDataGridEditorRenderer;
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
  columnGroupingFeature,
  // Registered for grouping's sake rather than for tree data: the grouped row
  // model builds the parent rows, and this is what flattens the expanded ones
  // back into the flat list the body virtualizes.
  rowExpandingFeature,

  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  facetedUniqueValues: createFacetedUniqueValues(),

  filterFns: { ...filterFns, tmDataGrid: tmDataGridFilterFn },
  sortFns,
  // The names `columnDef.aggregationFn` accepts. Only consulted for columns
  // that ask for one — a column with no `aggregationFn` reports `undefined` on
  // a group row, which is what keeps a plain "group by" free of aggregates.
  aggregationFns,

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

/** What the `renderDetails` render prop is handed for an expanded row. */
export type TMDataGridDetailsArgs<TData extends RowData> = {
  row: Row<TMDataGridFeatures, TData>;
  table: TMDataGridTable<TData>;
};

/** Builds the panel shown underneath an expanded row. See `renderDetails`. */
export type TMDataGridDetailsRenderer<TData extends RowData> = (
  args: TMDataGridDetailsArgs<TData>,
) => ReactNode;

/**
 * What the virtualizer assumes a detail panel it has not measured yet is worth.
 * Only a seed — every mounted row is measured, so the real height replaces it.
 */
const DEFAULT_DETAILS_EST_HEIGHT = 160;

/** Rows kept mounted on each side of the viewport. See `overscan`. */
const DEFAULT_OVERSCAN = 6;

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
  /**
   * The cell the keyboard is on, under `enableCellSelection`. `null` until the
   * grid is first entered — and again whenever a consumer clears it.
   *
   * The state is the source of truth and DOM focus follows it, not the other
   * way around: under virtualization the cell it names is often not mounted,
   * which is exactly what a coordinate has to survive. Held as ids for the
   * same reason — see {@link TMDataGridCellPosition}.
   */
  focusedCell: TMDataGridCellPosition | null;
  /**
   * The selected rectangle, under `cellSelection: "range"`. Held as the two
   * cells that span it — see {@link TMDataGridCellRange}.
   *
   * Always covers the focused cell: every gesture that moves the focus either
   * extends the rectangle or collapses it onto the new cell, so the two never
   * describe different places.
   */
  cellRange: TMDataGridCellRange | null;
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
  /**
   * Moves the focused cell, or clears it with `null`. DOM focus follows while
   * the grid holds it — so this both moves the keyboard and, when the row is
   * off screen, scrolls it into view. Called for every arrow key, and available
   * for a consumer putting the keyboard somewhere itself.
   */
  setFocusedCell: (cell: TMDataGridCellPosition | null) => void;
  /**
   * Sets the selected rectangle, or clears it with `null`. Does not move the
   * focused cell — the two are set together by the gestures that change both,
   * which is what keeps "extend the selection" and "move the cursor" separable.
   */
  setCellRange: (range: TMDataGridCellRange | null) => void;
};

export type TMDataGridUiStore = Store<TMDataGridUiState, TMDataGridUiActions>;

/** What `useTMDataGrid` returns — spread straight onto `<TMDataGrid />`. */
export type TMDataGridApi<TData extends RowData> = {
  table: TMDataGridTable<TData>;
  ui: TMDataGridUiStore;
  /**
   * The edit engine — open forms, dirty/error projections, and the verbs
   * (`begin`, `commit`, `cancel`, `submitAll`). `edit.getForm(rowId)` hands
   * out the same TanStack Form the inline editors write through, so a drawer
   * or detail panel can share a row's draft. Inert until `editMode` is set.
   */
  edit: TMDataGridEditApi;
  /** Table-level feature switches, re-read from options on every render. */
  features: TMDataGridFeatureFlags;
  /** Every string the chrome renders, `labels` merged over the English defaults. */
  labels: TMDataGridLabels;
  /** The detail renderer, when row details are on. See `renderDetails`. */
  renderDetails?: TMDataGridDetailsRenderer<TData>;
  /** Detail estimate in px: the option, or {@link DEFAULT_DETAILS_EST_HEIGHT}. */
  renderDetailsEstHeight: number;
  /** Virtualizer overscan: the option, or {@link DEFAULT_OVERSCAN}. */
  overscan: number;
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
   * Overrides for the grid's strings — menu items, panels, the pager, and
   * every `aria-label`. Any subset, merged over the English defaults; a full
   * Swedish dictionary ships as `TMDATAGRID_LABELS_SV`.
   *
   * ```tsx
   * useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
   * useTMDataGrid({ data, columns, labels: { noResults: "Inga rader" } });
   * ```
   *
   * Keep the object referentially stable (module scope or `useMemo`) — the
   * chrome re-renders when its identity changes.
   */
  labels?: TMDataGridLabelsOverride;
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
  /**
   * How cells are selected. Defaults to `"none"`.
   *
   * | Mode | What it gives |
   * | ---- | ------------- |
   * | `"none"` | nothing; the body's tab stop stays on the row |
   * | `"single"` | one focused cell, moved with the arrow keys |
   * | `"range"` | as `"single"`, plus a rectangle of cells |
   *
   * Under either live mode:
   *
   * | Key | Moves to |
   * | --- | --- |
   * | Arrows | the neighbouring cell, clamped at the edges |
   * | PageUp / PageDown | one viewport of rows |
   * | Home / End | first / last cell of the row |
   * | Ctrl+Home / Ctrl+End | first / last cell of the grid |
   * | Enter or F2 | into the cell — the checkbox, link or button it holds |
   * | Escape | back out to the cell |
   * | Space | selects the row, as it does in row-selection mode |
   *
   * And under `"range"`, additionally:
   *
   * | Gesture | Does |
   * | ------- | ---- |
   * | Drag across cells | selects the rectangle they span |
   * | Shift+click, Shift+arrows | extends the rectangle from its anchor |
   * | Ctrl+C | copies it as tab-separated text — paste lands in Excel's cells |
   * | Right-click inside it | offers the CSV export, headers optional |
   *
   * Off, nothing about the body changes. On, three things do: the body's tab
   * stop moves from the row to a cell, so the whole grid is one Tab stop; the
   * grid reports itself as a `grid` of `gridcell`s rather than a `table` of
   * `cell`s, which is what tells a screen reader the arrow keys are live; and
   * the cells take `data-focused` / `data-selected` for the ring and the tint.
   *
   * The state is `ui.state.focusedCell` and `ui.state.cellRange`, and moving it
   * is `ui.actions.setFocusedCell` / `setCellRange` — so a consumer can put the
   * keyboard on a cell, or follow it:
   *
   * ```tsx
   * const grid = useTMDataGrid({
   *   data,
   *   columns,
   *   cellSelection: "range",
   *   onFocusedCellChange: (cell) => setStatus(cell?.columnId ?? ""),
   * });
   * ```
   *
   * Ids rather than a row/column index pair, so sorting, filtering and column
   * reordering move the selection with the cells instead of leaving it over
   * whatever slid into those positions.
   */
  cellSelection?: TMDataGridCellSelectionMode;
  /**
   * Called with the newly focused cell, or `null` when it is cleared. Fires for
   * `ui.actions.setFocusedCell` too, not only for keys and clicks.
   */
  onFocusedCellChange?: (cell: TMDataGridCellPosition | null) => void;
  /**
   * Turns cell editing on, and picks how commits happen. Off by default.
   *
   * | Mode | Commit | Cancel |
   * | ---- | ------ | ------ |
   * | `"cell"` | Enter, Tab, blur — Sheets | Escape |
   * | `"cellConfirm"` | ✓ or Enter only; blur keeps the draft | ✕ or Escape |
   * | `"row"` | Save in the edit lane, or Ctrl+Enter | Cancel, or Escape |
   * | `"batch"` | `edit.submitAll()` | `edit.cancelAll()` |
   *
   * One TanStack Form per editing row; drafts survive scrolling because the
   * forms live outside the DOM, keyed by row id — which is also why
   * `getRowId` is required. Which columns edit, and with what, is declared
   * per column: `meta.type` picks the built-in editor, `meta.validate` its
   * validators, `meta.editable` / `meta.renderEditor` the overrides.
   *
   * Requires `getRowId` — the index fallback points at a different record
   * after any sort.
   */
  editMode?: TMDataGridEditMode;
  /**
   * Form-level validators for the whole editing row — where cross-field
   * rules live. TanStack Form's own vocabulary, Standard Schema included:
   *
   * ```tsx
   * rowValidators: {
   *   onSubmit: z.object({ salary: z.number().positive() })
   *     .refine((r) => r.status !== "Terminated" || r.salary === 0, {
   *       message: "A terminated employee has no salary",
   *     }),
   * }
   * ```
   *
   * Pathed issues land on the matching columns; pathless ones on the row.
   */
  rowValidators?: TMDataGridRowValidators;
  /** Rows the pencil skips — `false` keeps a row read-only in every mode. */
  isRowEditable?: (row: Row<TMDataGridFeatures, TData>) => boolean;
  /**
   * Called when an edit commits. The grid never mutates `data`: apply the
   * change and let the new data arrive back through `data` as always. The
   * engine drops the draft only when this resolves — a slow save keeps the
   * draft visible with a busy marker — and a rejection keeps the form open
   * with the error on the row.
   *
   * `changes` is the per-field diff (one entry in cell mode) for consumers
   * who PATCH; `value` is the whole edited row for those who save records.
   */
  onEditCommit?: (
    args: TMDataGridEditCommitArgs<TData>,
  ) => void | Promise<void>;
  /**
   * Batch mode's save, called once by `edit.submitAll()` with every valid
   * dirty row. Without it, `submitAll` falls back to the per-row
   * {@link onEditCommit} loop. Rows failing validation stay open either way;
   * a rejection keeps every draft.
   */
  onEditCommitBatch?: (
    args: TMDataGridEditCommitBatchArgs<TData>,
  ) => void | Promise<void>;
  /**
   * Renders a panel underneath an expanded row, spanning every column. Setting
   * it is what turns row details on.
   *
   * Which rows are open is TanStack's own `expanded` state, so opening one is
   * `row.toggleExpanded()` from wherever suits — a chevron in a cell, a button
   * in the context menu, a double-click:
   *
   * ```tsx
   * const grid = useTMDataGrid({
   *   data,
   *   columns,
   *   renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
   * });
   * ```
   *
   * The panel is as tall as what it renders — see {@link renderDetailsEstHeight}
   * for what the virtualizer assumes before it has measured one.
   *
   * Group rows are left out: expanding one opens its children, and a panel there
   * would be about an arbitrary one of them. The same reason they sit out
   * `onRowClick`.
   *
   * Row details and `selectionMode: "highlight"` are two answers to the same
   * question. Details keep the record in place and in context, which suits a few
   * fields or an action strip; a highlight-driven side panel has room for more
   * and survives scrolling. Nothing stops a grid from doing both.
   */
  renderDetails?: TMDataGridDetailsRenderer<TData>;
  /**
   * What the virtualizer assumes an unmeasured detail panel is worth, in px.
   * Defaults to 160.
   *
   * An estimate, not a height: every mounted row is measured, so the real one
   * takes over as soon as the panel is on screen. It keeps the scrollbar honest
   * for panels that open off screen — restored `expanded` state, say — and being
   * roughly right is enough.
   */
  renderDetailsEstHeight?: number;
  /**
   * Rows the virtualizer keeps mounted above and below the viewport. Defaults
   * to 6.
   *
   * Raise it to trade memory for a scroll that stays painted — fast wheel or
   * touch flings can outrun the virtualizer and flash blank rows, and a larger
   * buffer covers the gap. Lower it when rows are expensive to render.
   */
  overscan?: number;
};

type TMDataGridColumnDef<TData extends RowData> = ColumnDef<
  TMDataGridFeatures,
  TData,
  unknown
>;

/**
 * Point every column at the operator-dispatching filter function, and take
 * grouping's aggregation defaults back off, unless the column opted into its
 * own. Anything the consumer set wins — it is spread over these.
 *
 * The aggregation pair needs explaining. TanStack's grouping feature hands
 * every column `aggregationFn: "auto"` and an `aggregatedCell` that stringifies
 * whatever comes out, so merely registering the feature would have every
 * numeric column silently sum itself and every date column show a range the
 * moment anything is grouped. That is a summary table, and "group by" is not a
 * request for one. Cleared here, so a grouped grid is a tree until a column
 * says otherwise — `aggregationFn: "sum"` on the column that wants it.
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
    return {
      filterFn: "tmDataGrid",
      aggregationFn: undefined,
      aggregatedCell: undefined,
      ...column,
    } as TMDataGridColumnDef<TData>;
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
  labels: labelsOverride,
  enableColumnOrdering,
  enablePagination,
  selectionMode,
  showSelectedBackground,
  defaultHighlightedRowId,
  onHighlightedRowChange,
  cellSelection,
  onFocusedCellChange,
  editMode,
  rowValidators,
  isRowEditable,
  onEditCommit,
  onEditCommitBatch,
  renderDetails,
  renderDetailsEstHeight = DEFAULT_DETAILS_EST_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
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
    cellSelection,
    editMode,
  });

  // Resolved on the override's identity, so a module-scope dictionary costs one
  // merge for the lifetime of the grid.
  const labels = useMemo(() => mergeLabels(labelsOverride), [labelsOverride]);

  const pinningEnabled = options.enableColumnPinning !== false;
  const selectColumnEnabled = features.selectColumn;
  const groupColumnEnabled = features.grouping;
  // The lane that opens the panels. Nothing to switch on: a grid with no
  // `renderDetails` has nothing for it to open.
  const detailsColumnEnabled = renderDetails !== undefined;
  // Row mode's Save sits at the end of the row — the lane is its chrome.
  const editColumnEnabled = editMode === "row";

  // The generated lanes bake `meta.label` into their definitions, so the memo
  // depends on the strings rather than on the labels object — a fresh
  // inline `labels` must not rebuild the table's columns.
  const selectColumnLabel = labels.selectColumnLabel;
  const groupColumnLabel = labels.groupColumnLabel;
  const detailsColumnLabel = labels.detailsColumnLabel;
  const editColumnLabel = labels.editColumnLabel;

  const columns = useMemo(() => {
    const base = withTMDataGridDefaults<TData>(
      options.columns as ReadonlyArray<TMDataGridColumnDef<TData>>,
    );
    // Every generated column is present whenever its feature is on, and the
    // tree column hides itself while nothing is grouped. Adding it to the array
    // only once a column is grouped would make the column list depend on table
    // state, which is the one thing that cannot be a `useMemo` dependency here
    // — the table is built from these columns.
    //
    // The order is the order they are pinned in, and it follows what each one
    // is about: tick a row, find it in the tree the user grouped it into, then
    // open it. The details chevron sits last because it acts on the record the
    // lanes to its left have narrowed down to.
    return [
      ...(selectColumnEnabled
        ? [createSelectColumn<TData>(selectColumnLabel)]
        : []),
      ...(groupColumnEnabled ? [createGroupColumn<TData>(groupColumnLabel)] : []),
      ...(detailsColumnEnabled
        ? [createDetailsColumn<TData>(detailsColumnLabel)]
        : []),
      ...base,
      // Last and pinned right — the row's Save belongs at the end of the row.
      ...(editColumnEnabled ? [createEditColumn<TData>(editColumnLabel)] : []),
    ];
  }, [
    options.columns,
    selectColumnEnabled,
    detailsColumnEnabled,
    groupColumnEnabled,
    editColumnEnabled,
    selectColumnLabel,
    groupColumnLabel,
    detailsColumnLabel,
    editColumnLabel,
  ]);

  // Read once on mount: `initialState` is only consumed on the first render,
  // and re-reading later would fight the user's live edits.
  const [persistedState] = useState(() => readPersistedState(persist));

  // Restored grouping decides whether the tree column starts out visible, so a
  // reload comes back to the tree the user left rather than to a hidden lane.
  const initialGrouping =
    persistedState.grouping ?? options.initialState?.grouping ?? [];

  const table = useTable({
    columnResizeMode: "onChange",
    enableSorting: true,
    enableColumnResizing: true,
    globalFilterFn: "includesString",
    // Grouping by a column takes it out of the grid, the way AG Grid does it:
    // its values have moved into the tree column, so leaving it in place would
    // show every row the same value it was grouped under. Overridable — pass
    // `"reorder"` to keep the column and have it moved to the front instead.
    groupedColumnMode: "remove",
    ...options,
    // Row details ride on `expanded`, the same state the tree uses — but a data
    // row answers `getCanExpand()` false, since TanStack's fallback is
    // `subRows.length > 0`. `() => true` is the right answer for a group row
    // too, so nothing here has to tell the two apart, and a consumer passing
    // their own predicate still wins.
    ...(renderDetails !== undefined
      ? { getRowCanExpand: options.getRowCanExpand ?? (() => true) }
      : {}),
    features: tmDataGridFeatures,
    columns: columns as TableOptions<TMDataGridFeatures, TData>["columns"],
    initialState: {
      ...options.initialState,
      ...persistedState,
      columnVisibility: {
        ...options.initialState?.columnVisibility,
        ...persistedState.columnVisibility,
        // Last word, because the tree column's visibility is not a user setting
        // — it tracks the grouping state. See the effect below.
        ...(groupColumnEnabled
          ? { [GROUP_COLUMN_ID]: initialGrouping.length > 0 }
          : {}),
      },
      columnPinning: {
        // The generated columns are structurally pinned, so they are re-applied
        // on top of anything restored from storage.
        left: [
          ...(selectColumnEnabled && pinningEnabled ? [SELECT_COLUMN_ID] : []),
          ...(groupColumnEnabled && pinningEnabled ? [GROUP_COLUMN_ID] : []),
          ...(detailsColumnEnabled && pinningEnabled ? [DETAILS_COLUMN_ID] : []),
          ...(
            persistedState.columnPinning?.left ??
            options.initialState?.columnPinning?.left ??
            []
          ).filter(
            (id) =>
              id !== SELECT_COLUMN_ID &&
              id !== DETAILS_COLUMN_ID &&
              id !== GROUP_COLUMN_ID,
          ),
        ],
        // The edit lane mirrors the generated columns on the left: structurally
        // pinned, outermost, re-applied over anything restored.
        right: [
          ...(
            persistedState.columnPinning?.right ??
            options.initialState?.columnPinning?.right ??
            []
          ).filter((id) => id !== EDIT_COLUMN_ID),
          ...(editColumnEnabled && pinningEnabled ? [EDIT_COLUMN_ID] : []),
        ],
      },
      pagination: {
        pageIndex: 0,
        pageSize: 25,
        ...options.initialState?.pagination,
        ...persistedState.pagination,
      },
    },
  });

  // The edit engine. Built once per mount; everything it needs later — the
  // table, the mode, the consumer's callbacks — is read through a ref updated
  // every render, so forms created at `begin()` always call the latest
  // `onEditCommit` (the onHighlightedRowChangeRef pattern, applied wholesale).
  const editContextRef = useRef<TMDataGridEditEngineContext>(null as never);
  editContextRef.current = {
    table: table as unknown as TMDataGridTable<TMDataGridRowData>,
    editMode: editMode ?? "cell",
    rowValidators,
    isRowEditable: isRowEditable as TMDataGridEditEngineContext["isRowEditable"],
    onEditCommit:
      onEditCommit as TMDataGridEditEngineContext["onEditCommit"],
    onEditCommitBatch:
      onEditCommitBatch as TMDataGridEditEngineContext["onEditCommitBatch"],
  };
  const [edit] = useState(() =>
    createEditEngine(() => editContextRef.current),
  );

  // Switching modes mid-flight drops every draft: the policies disagree about
  // what an open form means, and carrying one across is how a "batch" draft
  // silently commits under "cell".
  const previousEditModeRef = useRef(editMode);
  useEffect(() => {
    if (previousEditModeRef.current === editMode) return;
    previousEditModeRef.current = editMode;
    edit.cancelAll();
  }, [editMode, edit]);

  // Editing without stable ids points every draft at whatever record slides
  // into that index after a sort. Loud, once, in development.
  useEffect(() => {
    if (editMode !== undefined && options.getRowId === undefined) {
      console.error(
        "TMDataGrid: editMode requires getRowId — drafts are keyed by row id, and the index fallback names a different record after any sort or filter.",
      );
    }
    // The check is a mount-time contract, not something to re-run per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two things have to happen whenever `grouping` changes.
  //
  // One: the tree column appears with the first grouped column and goes away
  // with the last, so an ungrouped grid looks exactly as it did before grouping
  // existed. Driven from a subscription rather than by rebuilding the column
  // array, because the array is what the table is built from — deriving it from
  // table state would close the loop. Visibility is the one column property
  // that can be changed after the fact without touching the definitions.
  //
  // Two, and this one is a workaround. In table-core 9.0.0-beta.21 the
  // per-region column APIs do not list `grouping` among their memo
  // dependencies, even though they all derive from `getAllLeafColumns()`, which
  // does:
  //
  // | API | Declares |
  // | --- | --- |
  // | `getLeft/Center/RightVisibleLeafColumns` | columns, columnPinning, columnVisibility, columnOrder |
  // | `getLeft/Center/RightHeaderGroups` | columnPinning, columnOrder |
  // | `row.getLeft/Center/RightVisibleCells` | columnPinning, columnVisibility |
  //
  // So grouping a *second* column leaves every one of them returning the
  // previous list: the column TanStack removed keeps its header and its grid
  // track, and the row cells no longer line up with them. The first grouping
  // appears to work only because the visibility write above happens to touch a
  // dependency they share.
  //
  // Re-publishing `columnVisibility` and `columnOrder` — same contents, new
  // identity — invalidates all three families. `columnOrder` is the only
  // dependency the header groups declare, and `columnVisibility` the only one
  // the cells do, so both are needed. Remove this once the deps are fixed
  // upstream; the test that fails without it groups two columns and asserts the
  // second one leaves the grid.
  //
  // Writing back into the store from its own subscriber is safe: the guard is
  // on `grouping`'s identity, and neither write touches it, so the callback
  // these writes trigger short-circuits.
  useEffect(() => {
    if (!groupColumnEnabled) return;
    let previousGrouping = table.store.state.grouping;

    const subscription = table.store.subscribe((state) => {
      if (state.grouping === previousGrouping) return;
      previousGrouping = state.grouping;

      table.setColumnVisibility((old) => ({
        ...old,
        [GROUP_COLUMN_ID]: state.grouping.length > 0,
      }));
      table.setColumnOrder((old) => [...old]);
    });

    return () => subscription.unsubscribe();
  }, [groupColumnEnabled, table]);

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
      focusedCell: null,
      cellRange: null,
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
      setFocusedCell: (cell) =>
        setState((prev) =>
          // Same cell, same object: the body re-renders on every scroll frame
          // and mouse events land on the cell that already has the focus, so a
          // fresh identity here would republish the store for nothing.
          isSameCell(prev.focusedCell, cell)
            ? prev
            : { ...prev, focusedCell: cell },
        ),
      setCellRange: (range) =>
        setState((prev) =>
          // Same guard as above, and it earns more here: a drag publishes a new
          // corner on every mouse move, and most of those land on the cell the
          // range already ends at.
          isSameCell(prev.cellRange?.anchor ?? null, range?.anchor ?? null) &&
          isSameCell(prev.cellRange?.focus ?? null, range?.focus ?? null)
            ? prev
            : { ...prev, cellRange: range },
        ),
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

  // Same shape for the focused cell, and for the same reason: arrow keys, a
  // click and `setFocusedCell` all have to report through one place.
  const onFocusedCellChangeRef = useRef(onFocusedCellChange);
  useEffect(() => {
    onFocusedCellChangeRef.current = onFocusedCellChange;
  }, [onFocusedCellChange]);

  useEffect(() => {
    let previous = ui.state.focusedCell;
    const subscription = ui.subscribe((state) => {
      // Identity is enough: `setFocusedCell` keeps the previous object when the
      // cell has not changed, so a new one always means a new cell.
      if (state.focusedCell === previous) return;
      previous = state.focusedCell;
      onFocusedCellChangeRef.current?.(state.focusedCell);
    });
    return () => subscription.unsubscribe();
  }, [ui]);

  return {
    table,
    ui,
    edit,
    features,
    labels,
    renderDetails,
    renderDetailsEstHeight,
    overscan,
  };
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

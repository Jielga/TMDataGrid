import {
  FILTER_OPERATOR_LABELS,
  type TMDataGridFilterOperator,
} from "./filterOperators";

/**
 * Every user-facing string in the grid — menu items, panels, tooltips, the
 * pager, and the `aria-label`s a screen reader speaks. One flat object, so an
 * override is a spread rather than a deep merge; `operators` is the single
 * nested record and {@link mergeLabels} folds it separately.
 *
 * Labels that carry a value are functions rather than template strings, so a
 * language is free to put the value wherever its grammar wants it.
 */
export type TMDataGridLabels = {
  /** Filter operator names, as shown in the operator dropdown and on pills. */
  operators: Record<TMDataGridFilterOperator, string>;

  // Toolbar
  /** "Manage columns" — the burger button and the header menu item. */
  manageColumns: string;
  /** "Filters" — the funnel button and the filter panel's title. */
  filters: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;

  // Columns panel
  columnsSearchPlaceholder: string;
  columnsNoMatch: (search: string) => string;
  columnsShowHideAll: string;
  columnsReset: string;

  // Filter panel
  filterColumn: string;
  filterOperator: string;
  filterValue: string;
  filterValuePlaceholder: string;
  /** What a boolean column's `true` reads as — its filter choice and cell text. */
  booleanTrue: string;
  booleanFalse: string;
  addFilter: string;
  clearAllFilters: string;
  closeFilters: string;
  removeFilter: string;

  // Filter pills
  activeFilters: string;
  clearFilter: (column: string) => string;

  // Header menu
  sortAsc: string;
  sortDesc: string;
  filterMenuItem: string;
  groupBy: (column: string) => string;
  ungroup: (column: string) => string;
  expandAllGroups: string;
  collapseAllGroups: string;
  pinLeft: string;
  pinRight: string;
  unpin: string;
  moveLeft: string;
  moveRight: string;
  autosizeColumn: string;
  hideColumn: string;
  filterOn: (column: string) => string;
  sortColumn: (column: string) => string;
  columnMenu: (column: string) => string;

  // Footer / pager
  rowsPerPage: string;
  pageRange: (args: { from: number; to: number; total: number }) => string;
  groupedAllRows: (total: number) => string;
  pagingSuspendedHint: string;
  previousPage: string;
  nextPage: string;

  // Body
  noResults: string;
  loading: string;

  // Cell selection menu
  cellCount: (count: number) => string;
  copy: string;
  exportCsv: string;
  includeHeaders: string;

  // Generated checkbox lane
  selectColumnLabel: string;
  selectAllRows: string;
  selectRow: string;
  selectGroup: string;

  // Generated details lane
  detailsColumnLabel: string;
  showDetails: string;
  hideDetails: string;
  expandAllDetails: string;
  collapseAllDetails: string;

  // Generated tree lane
  groupColumnLabel: string;
  blankGroupValue: string;
  expandGroup: (label: string) => string;
  collapseGroup: (label: string) => string;
};

/**
 * What the `labels` option accepts: any subset, merged over the English
 * defaults — so `{ noResults: "Inga rader" }` is a complete configuration.
 */
export type TMDataGridLabelsOverride = Partial<
  Omit<TMDataGridLabels, "operators">
> & {
  operators?: Partial<Record<TMDataGridFilterOperator, string>>;
};

/** The built-in defaults. Also the reference for what a preset must cover. */
export const TMDATAGRID_LABELS_EN: TMDataGridLabels = {
  operators: FILTER_OPERATOR_LABELS,

  manageColumns: "Manage columns",
  filters: "Filters",
  searchPlaceholder: "Search",
  searchLabel: "Search rows",
  clearSearch: "Clear search",

  columnsSearchPlaceholder: "Search",
  columnsNoMatch: (search) => `No columns match “${search}”`,
  columnsShowHideAll: "Show/Hide All",
  columnsReset: "RESET",

  filterColumn: "Column",
  filterOperator: "Operator",
  filterValue: "Value",
  filterValuePlaceholder: "Filter value",
  booleanTrue: "Yes",
  booleanFalse: "No",
  addFilter: "Add filter",
  clearAllFilters: "Clear all",
  closeFilters: "Close filters",
  removeFilter: "Remove filter",

  activeFilters: "Active filters",
  clearFilter: (column) => `Clear ${column} filter`,

  sortAsc: "Sort by ASC",
  sortDesc: "Sort by DESC",
  filterMenuItem: "Filter",
  groupBy: (column) => `Group by ${column}`,
  ungroup: (column) => `Ungroup ${column}`,
  expandAllGroups: "Expand all groups",
  collapseAllGroups: "Collapse all groups",
  pinLeft: "Pin to left",
  pinRight: "Pin to right",
  unpin: "Unpin",
  moveLeft: "Move left",
  moveRight: "Move right",
  autosizeColumn: "Autosize column",
  hideColumn: "Hide column",
  filterOn: (column) => `Filter on ${column}`,
  sortColumn: (column) => `Sort ${column}`,
  columnMenu: (column) => `${column} column menu`,

  rowsPerPage: "Rows per page:",
  pageRange: ({ from, to, total }) => `${from}–${to} of ${total}`,
  groupedAllRows: (total) => `Grouped · all ${total} rows`,
  pagingSuspendedHint:
    "Paging is off while the rows are grouped: the whole tree is rendered and virtualized. Ungroup to page again.",
  previousPage: "Previous page",
  nextPage: "Next page",

  noResults: "No rows match your filters",
  loading: "Loading",

  cellCount: (count) => (count === 1 ? "1 cell" : `${count} cells`),
  copy: "Copy",
  exportCsv: "Export as CSV for Excel",
  includeHeaders: "Include headers",

  selectColumnLabel: "Checkbox selection",
  selectAllRows: "Select all rows",
  selectRow: "Select row",
  selectGroup: "Select group",

  detailsColumnLabel: "Details",
  showDetails: "Show details",
  hideDetails: "Hide details",
  expandAllDetails: "Expand all details",
  collapseAllDetails: "Collapse all details",

  groupColumnLabel: "Group",
  blankGroupValue: "(Blank)",
  expandGroup: (label) => `Expand ${label}`,
  collapseGroup: (label) => `Collapse ${label}`,
};

/** A partial override folded over the English defaults. */
export function mergeLabels(
  override?: TMDataGridLabelsOverride,
): TMDataGridLabels {
  if (!override) return TMDATAGRID_LABELS_EN;
  return {
    ...TMDATAGRID_LABELS_EN,
    ...override,
    operators: {
      ...TMDATAGRID_LABELS_EN.operators,
      ...override.operators,
    },
  };
}

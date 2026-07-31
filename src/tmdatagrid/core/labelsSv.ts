import type { TMDataGridLabels } from "./labels";

/**
 * The complete Swedish dictionary. Typed as {@link TMDataGridLabels} rather
 * than as an override, so a label added to the grid without a Swedish
 * translation is a compile error here instead of English quietly leaking
 * through.
 *
 * ```tsx
 * useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
 * ```
 */
export const TMDATAGRID_LABELS_SV: TMDataGridLabels = {
  operators: {
    contains: "innehåller",
    equals: "är lika med",
    notEquals: "är inte lika med",
    startsWith: "börjar med",
    endsWith: "slutar med",
    greaterThan: "är större än",
    greaterThanOrEqual: "är större än eller lika med",
    lessThan: "är mindre än",
    lessThanOrEqual: "är mindre än eller lika med",
    before: "är före",
    after: "är efter",
    onOrBefore: "är på eller före",
    onOrAfter: "är på eller efter",
    isAnyOf: "är någon av",
    isNoneOf: "är ingen av",
    isEmpty: "är tom",
    isNotEmpty: "är inte tom",
  },

  manageColumns: "Hantera kolumner",
  filters: "Filter",
  searchPlaceholder: "Sök",
  searchLabel: "Sök rader",
  clearSearch: "Rensa sökningen",

  columnsSearchPlaceholder: "Sök",
  columnsNoMatch: (search) => `Inga kolumner matchar ”${search}”`,
  columnsShowHideAll: "Visa/dölj alla",
  columnsReset: "ÅTERSTÄLL",

  filterColumn: "Kolumn",
  filterOperator: "Operator",
  filterValue: "Värde",
  filterValuePlaceholder: "Filtervärde",
  booleanTrue: "Ja",
  booleanFalse: "Nej",
  addFilter: "Lägg till filter",
  clearAllFilters: "Rensa alla",
  closeFilters: "Stäng filter",
  removeFilter: "Ta bort filter",

  activeFilters: "Aktiva filter",
  clearFilter: (column) => `Rensa filtret för ${column}`,

  sortAsc: "Sortera stigande",
  sortDesc: "Sortera fallande",
  filterMenuItem: "Filtrera",
  groupBy: (column) => `Gruppera på ${column}`,
  ungroup: (column) => `Avgruppera ${column}`,
  expandAllGroups: "Expandera alla grupper",
  collapseAllGroups: "Fäll ihop alla grupper",
  pinLeft: "Fäst till vänster",
  pinRight: "Fäst till höger",
  unpin: "Lossa",
  moveLeft: "Flytta åt vänster",
  moveRight: "Flytta åt höger",
  autosizeColumn: "Anpassa kolumnbredd",
  hideColumn: "Dölj kolumn",
  filterOn: (column) => `Filtrera på ${column}`,
  sortColumn: (column) => `Sortera ${column}`,
  columnMenu: (column) => `Kolumnmeny för ${column}`,

  rowsPerPage: "Rader per sida:",
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
  groupedAllRows: (total) => `Grupperad · alla ${total} rader`,
  pagingSuspendedHint:
    "Sidindelningen är avstängd medan raderna är grupperade: hela trädet renderas och virtualiseras. Avgruppera för att bläddra igen.",
  previousPage: "Föregående sida",
  nextPage: "Nästa sida",

  noResults: "Inga rader matchar dina filter",
  loading: "Laddar",

  editCell: (column) => `Redigera ${column}`,
  confirmEdit: "Spara",
  cancelEdit: "Avbryt",
  editColumnLabel: "Redigera",
  editRow: "Redigera rad",
  saveRow: "Spara rad",
  cancelRowEdit: "Avbryt redigering",
  editRowErrors: "Åtgärda de markerade cellerna",
  saveAllEdits: (rows) => (rows === 1 ? "Spara 1 rad" : `Spara ${rows} rader`),
  discardAllEdits: "Förkasta",
  confirmNewRow: "Lägg till rad",
  discardNewRow: "Släng ny rad",
  deleteRow: "Ta bort rad",
  restoreRow: "Återställ rad",

  cellCount: (count) => (count === 1 ? "1 cell" : `${count} celler`),
  copy: "Kopiera",
  exportCsv: "Exportera som CSV för Excel",
  includeHeaders: "Inkludera rubriker",

  selectColumnLabel: "Kryssrutemarkering",
  selectAllRows: "Markera alla rader",
  selectRow: "Markera rad",
  selectGroup: "Markera grupp",

  detailsColumnLabel: "Detaljer",
  showDetails: "Visa detaljer",
  hideDetails: "Dölj detaljer",
  expandAllDetails: "Expandera alla detaljer",
  collapseAllDetails: "Fäll ihop alla detaljer",

  groupColumnLabel: "Grupp",
  blankGroupValue: "(Tom)",
  expandGroup: (label) => `Expandera ${label}`,
  collapseGroup: (label) => `Fäll ihop ${label}`,
};

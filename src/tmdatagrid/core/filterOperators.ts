import type { Row, RowData, TableFeatures } from "@tanstack/react-table";

/**
 * The value shape stored in `columnFilters` for every TMDataGrid column.
 *
 * TanStack resolves `filterFn` statically per column, so the operator travels
 * inside the filter *value* instead. That keeps the whole filter model plain,
 * serialisable JSON — which is what makes it portable to a server-side
 * `manualFiltering` table (just forward `columnFilters` to the API).
 */
export type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string;
};

export type TMDataGridColumnType = "string" | "number";

export type TMDataGridFilterOperator =
  | "contains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "isEmpty"
  | "isNotEmpty";

export const FILTER_OPERATOR_LABELS: Record<TMDataGridFilterOperator, string> = {
  contains: "contains",
  equals: "equals",
  notEquals: "does not equal",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is greater than or equal to",
  lessThan: "is less than",
  lessThanOrEqual: "is less than or equal to",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const STRING_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "contains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];

const NUMBER_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "isEmpty",
  "isNotEmpty",
];

/** Operators that ignore the value input (the input is disabled for these). */
const VALUELESS_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "isEmpty",
  "isNotEmpty",
];

export function getOperatorsForType(
  type: TMDataGridColumnType,
): readonly TMDataGridFilterOperator[] {
  return type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
}

export function getDefaultOperator(
  type: TMDataGridColumnType,
): TMDataGridFilterOperator {
  return type === "number" ? "equals" : "contains";
}

export function operatorNeedsValue(operator: TMDataGridFilterOperator): boolean {
  return !VALUELESS_OPERATORS.includes(operator);
}

export function isTMDataGridFilterValue(
  value: unknown,
): value is TMDataGridFilterValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "operator" in value &&
    typeof (value as TMDataGridFilterValue).operator === "string"
  );
}

/**
 * A filter only narrows the row set once it has something to compare against.
 * Half-typed filters stay in state (so the panel keeps rendering their row) but
 * are treated as inactive for the funnel indicator and for row matching.
 */
export function isFilterActive(value: unknown): boolean {
  if (!isTMDataGridFilterValue(value)) return false;
  return !operatorNeedsValue(value.operator) || value.value.trim() !== "";
}

/**
 * One-line description of a single filter, as shown on a filter pill.
 *
 * The type's default operator is left implicit — "First name: Sofia" reads the
 * way a person would say it — while any other operator is spelled out, since
 * that is the part a reader cannot guess.
 */
export function formatFilterLabel({
  label,
  type,
  filter,
}: {
  label: string;
  type: TMDataGridColumnType;
  filter: TMDataGridFilterValue;
}): string {
  const { operator, value } = filter;
  if (!operatorNeedsValue(operator)) {
    return `${label} ${FILTER_OPERATOR_LABELS[operator]}`;
  }
  const text = value.trim();
  if (operator === getDefaultOperator(type)) return `${label}: ${text}`;
  return `${label} ${FILTER_OPERATOR_LABELS[operator]} ${text}`;
}

export function matchesFilter(
  cellValue: unknown,
  { operator, value }: TMDataGridFilterValue,
): boolean {
  if (operator === "isEmpty") {
    return cellValue === null || cellValue === undefined || cellValue === "";
  }
  if (operator === "isNotEmpty") {
    return cellValue !== null && cellValue !== undefined && cellValue !== "";
  }

  const filterText = value.trim();
  if (filterText === "") return true;

  const numericCell = typeof cellValue === "number" ? cellValue : Number.NaN;
  const numericFilter = Number(filterText);
  const compareNumeric =
    !Number.isNaN(numericCell) && !Number.isNaN(numericFilter);

  switch (operator) {
    case "greaterThan":
      return compareNumeric && numericCell > numericFilter;
    case "greaterThanOrEqual":
      return compareNumeric && numericCell >= numericFilter;
    case "lessThan":
      return compareNumeric && numericCell < numericFilter;
    case "lessThanOrEqual":
      return compareNumeric && numericCell <= numericFilter;
    default:
      break;
  }

  const cellText = String(cellValue ?? "").toLowerCase();
  const needle = filterText.toLowerCase();

  switch (operator) {
    case "contains":
      return cellText.includes(needle);
    case "equals":
      return compareNumeric ? numericCell === numericFilter : cellText === needle;
    case "notEquals":
      return compareNumeric ? numericCell !== numericFilter : cellText !== needle;
    case "startsWith":
      return cellText.startsWith(needle);
    case "endsWith":
      return cellText.endsWith(needle);
    default:
      return true;
  }
}

/**
 * The single filter function every TMDataGrid column uses. It dispatches on the
 * operator carried by the filter value, which is what lets one column offer
 * "contains" / "does not equal" / "is empty" without redefining the column.
 */
export function tmDataGridFilterFn<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(row: Row<TFeatures, TData>, columnId: string, filterValue: unknown): boolean {
  if (!isTMDataGridFilterValue(filterValue)) return true;
  return matchesFilter(row.getValue(columnId), filterValue);
}

import type { Column, Row } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/**
 * One choice of a `select` / `multiSelect` column. A bare string in any options
 * list is shorthand for `{ value }`.
 */
export type TMDataGridOption = {
  value: string;
  /** Shown in dropdowns. Defaults to the value itself. */
  label?: string;
  /** Mantine colour for the value's badge, where a cell renders one. */
  color?: string;
  disabled?: boolean;
  /** Dropdown group heading. Ungrouped options render first. */
  group?: string;
};

export type TMDataGridOptionsArgs = {
  table: TMDataGridTable<TMDataGridRowData>;
  column: Column<TMDataGridFeatures, TMDataGridRowData, unknown>;
  /** The row an editor is standing on. Absent when the filter panel asks. */
  row?: Row<TMDataGridFeatures, TMDataGridRowData>;
  /**
   * Source to use when the column declares none. The filter panel passes
   * `"faceted"` so a select column with no `meta.options` still offers the
   * values that exist, rather than an empty dropdown.
   */
  fallback?: TMDataGridOptionsSource;
};

/**
 * Where a column's options come from — `meta.options`. One declaration feeds
 * both the filter panel's value control and the cell editor.
 *
 * | Form | For |
 * | --- | --- |
 * | array | a known, fixed set |
 * | `"faceted"` | low-cardinality data columns: the distinct values present, via `getFacetedUniqueValues` |
 * | function | large or contextual sets — `row` is set when an editor asks, so options can depend on the record (city given country) |
 */
export type TMDataGridOptionsSource =
  | ReadonlyArray<TMDataGridOption | string>
  | "faceted"
  | ((args: TMDataGridOptionsArgs) => ReadonlyArray<TMDataGridOption | string>);

function addFacetValue(target: Set<string>, value: unknown): void {
  if (value === null || value === undefined || value === "") return;
  target.add(String(value));
}

/**
 * A column's options as a normalised list, whatever form `meta.options` took.
 * Empty for a column that declares none.
 *
 * `"faceted"` reads the distinct values actually present in the data. A
 * multiSelect cell holds an array, so array values contribute their elements
 * rather than the array itself.
 */
export function resolveColumnOptions({
  table,
  column,
  row,
  fallback,
}: TMDataGridOptionsArgs): Array<TMDataGridOption> {
  const source = column.columnDef.meta?.options ?? fallback;
  if (!source) return [];

  if (source === "faceted") {
    const values = new Set<string>();
    for (const key of column.getFacetedUniqueValues().keys()) {
      if (Array.isArray(key)) {
        for (const entry of key) addFacetValue(values, entry);
      } else {
        addFacetValue(values, key);
      }
    }
    return [...values]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((value) => ({ value }));
  }

  const list = typeof source === "function" ? source({ table, column, row }) : source;
  return list.map((option) =>
    typeof option === "string" ? { value: option } : option,
  );
}

type ComboboxItem = { value: string; label: string; disabled?: boolean };
type ComboboxData = Array<ComboboxItem | { group: string; items: ComboboxItem[] }>;

/**
 * The same list in the shape Mantine's `Select` / `MultiSelect` take, with
 * `group` fields folded into Mantine's group entries. Ungrouped options come
 * first, then the groups in first-appearance order.
 */
export function optionsToComboboxData(
  options: ReadonlyArray<TMDataGridOption>,
): ComboboxData {
  const ungrouped: ComboboxItem[] = [];
  const groups = new Map<string, ComboboxItem[]>();

  for (const option of options) {
    const item: ComboboxItem = {
      value: option.value,
      label: option.label ?? option.value,
      ...(option.disabled ? { disabled: true } : {}),
    };
    if (option.group === undefined) {
      ungrouped.push(item);
    } else {
      const bucket = groups.get(option.group);
      if (bucket) bucket.push(item);
      else groups.set(option.group, [item]);
    }
  }

  return [
    ...ungrouped,
    ...[...groups].map(([group, items]) => ({ group, items })),
  ];
}

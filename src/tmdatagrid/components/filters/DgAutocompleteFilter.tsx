import { Autocomplete } from "@mantine/core";
import { resolveColumnOptions } from "../../core/columnOptions";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import {
  operatorNeedsValue,
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "../../core/filterOperators";
import { TMDataGridFilterValueInput } from "./TMDataGridFilterValueInput";

/**
 * A built-in `meta.filterControl` for text-shaped columns: a free-text input
 * that also offers the values present in the data (or the column's declared
 * `meta.options`) as suggestions. Set or range operators fall back to the
 * standard input.
 */
export function DgAutocompleteFilter(args: TMDataGridFilterControlArgs) {
  const { column, table, operator, value, onChange, options, size, labels } =
    args;
  if (operatorTakesArrayValue(operator) || operatorTakesRangeValue(operator)) {
    return <TMDataGridFilterValueInput {...args} />;
  }
  const needsValue = operatorNeedsValue(operator);
  // `options` arrives pre-resolved only for declared or select-shaped
  // columns; on a plain string column the suggestions come from the faceted
  // values, resolved here.
  const suggestions =
    options.length > 0
      ? options
      : resolveColumnOptions({ table, column, fallback: "faceted" });

  return (
    <Autocomplete
      label={labels.filterValue}
      size={size}
      w={180}
      comboboxProps={{ withinPortal: false }}
      disabled={!needsValue}
      placeholder={needsValue ? labels.filterValuePlaceholder : ""}
      data={suggestions.map((option) => option.value)}
      limit={20}
      value={needsValue && typeof value === "string" ? value : ""}
      onChange={onChange}
    />
  );
}

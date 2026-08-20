import { Group, MultiSelect, Select, TextInput } from "@mantine/core";
import { optionsToComboboxData } from "../../core/columnOptions";
import { getColumnType } from "../../core/columnUtils";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import {
  operatorNeedsValue,
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "../../core/filterOperators";

/**
 * The built-in value control of a filter-panel row - what renders when a
 * column declares no `meta.filter.control`. Shaped by the operator: a
 * multi-select for the set operators, a From/To pair for `between`, a Yes/No
 * dropdown for booleans, a typed input otherwise.
 *
 * Exported so a custom control can fall back to it for the operators it does
 * not care about, instead of rebuilding them.
 */
export function TMDataGridFilterValueInput({
  column,
  operator,
  value,
  onChange,
  options,
  size,
  labels,
}: TMDataGridFilterControlArgs) {
  const type = getColumnType(column);
  const needsValue = operatorNeedsValue(operator);
  const scalarValue = typeof value === "string" ? value : "";
  const inputType =
    type === "number" ? "number" : type === "date" ? "date" : "text";

  if (operatorTakesRangeValue(operator)) {
    const rangeValue: [string, string] = Array.isArray(value)
      ? [String(value[0] ?? ""), String(value[1] ?? "")]
      : ["", ""];
    return (
      // The interval's two ends. Either may stay empty (an open end), and
      // each writes its slot of the `[min, max]` pair.
      <Group gap={4} wrap="nowrap" align="flex-start">
        <TextInput
          label={labels.filterFrom}
          size={size}
          w={88}
          type={inputType}
          data-dg-part="filter-value-from"
          value={rangeValue[0]}
          onChange={(event) =>
            onChange([event.currentTarget.value, rangeValue[1]])
          }
        />
        <TextInput
          label={labels.filterTo}
          size={size}
          w={88}
          type={inputType}
          data-dg-part="filter-value-to"
          value={rangeValue[1]}
          onChange={(event) =>
            onChange([rangeValue[0], event.currentTarget.value])
          }
        />
      </Group>
    );
  }

  if (operatorTakesArrayValue(operator)) {
    // The set the cell is tested against. Options come from `meta.options`;
    // a select column that declares none still gets the values present in
    // the data, via the faceted index.
    return (
      <MultiSelect
        label={labels.filterValue}
        size={size}
        w={180}
        comboboxProps={{ withinPortal: false }}
        searchable
        data-dg-part="filter-value"
        data={optionsToComboboxData(options)}
        value={Array.isArray(value) ? [...value] : []}
        onChange={onChange}
      />
    );
  }

  if (type === "boolean") {
    return (
      <Select
        label={labels.filterValue}
        size={size}
        w={180}
        comboboxProps={{ withinPortal: false }}
        data-dg-part="filter-value"
        disabled={!needsValue}
        clearable
        placeholder={needsValue ? labels.filterValuePlaceholder : ""}
        data={[
          { value: "true", label: labels.booleanTrue },
          { value: "false", label: labels.booleanFalse },
        ]}
        value={needsValue && scalarValue !== "" ? scalarValue : null}
        onChange={(next) => onChange(next ?? "")}
      />
    );
  }

  return (
    <TextInput
      label={labels.filterValue}
      size={size}
      w={180}
      type={needsValue ? inputType : "text"}
      data-dg-part="filter-value"
      disabled={!needsValue}
      placeholder={needsValue ? labels.filterValuePlaceholder : ""}
      value={needsValue ? scalarValue : ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

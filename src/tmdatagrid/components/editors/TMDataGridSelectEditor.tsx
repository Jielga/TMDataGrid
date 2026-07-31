import { Select } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import {
  optionsToComboboxData,
  resolveColumnOptions,
} from "../../core/columnOptions";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import { useFieldError, useFieldValue } from "./editorShared";

/**
 * The built-in editor for `meta.type: "select"`. Options come from the same
 * `meta.options` the filter panel reads — with the row in hand, so a
 * function source can depend on the record being edited.
 */
export function TMDataGridSelectEditor({
  field,
  autoFocus,
  column,
  row,
  table,
  size,
  commit,
}: TMDataGridEditorArgs) {
  const { labels, features } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  return (
    <Select
      size={size}
      w="100%"
      autoFocus={autoFocus}
      searchable
      // Inside the cell, so picking an option is not a click-away — the same
      // reason the filter panel keeps its dropdowns unportalled.
      comboboxProps={{ withinPortal: false }}
      aria-label={labels.editCell(getColumnLabel(column))}
      data={optionsToComboboxData(
        resolveColumnOptions({ table, column, row, fallback: "faceted" }),
      )}
      value={typeof value === "string" ? value : null}
      onChange={(next) => {
        field.handleChange(next);
        // Sheets semantics under `"cell"`: a pick is the edit, so it commits.
        // The confirming modes leave the draft for their explicit commit.
        if (next !== null && features.editMode === "cell") void commit();
      }}
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

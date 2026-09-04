import { MultiSelect } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import {
  optionsToComboboxData,
  resolveColumnOptions,
} from "../../core/columnOptions";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import { useFieldInvalid, useFieldValue } from "./editorShared";

/**
 * The built-in editor for `meta.type: "multiSelect"` - cells holding string
 * arrays. Never commits on pick: building a set takes several, so the commit
 * stays on Enter/blur like a text edit.
 */
export function TMDataGridMultiSelectEditor({
  field,
  column,
  row,
  table,
  size,
}: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  return (
    <MultiSelect
      size={size}
      w="100%"
      searchable
      comboboxProps={{ withinPortal: false }}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      data={optionsToComboboxData(
        resolveColumnOptions({ table, column, row, fallback: "faceted" }),
      )}
      value={Array.isArray(value) ? value.map(String) : []}
      onChange={(next) => field.handleChange(next)}
      onBlur={field.handleBlur}
      error={invalid}
    />
  );
}

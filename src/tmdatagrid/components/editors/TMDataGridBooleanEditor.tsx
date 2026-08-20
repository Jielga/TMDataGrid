import { Checkbox } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import { useFieldError, useFieldValue } from "./editorShared";

/** The built-in editor for `meta.type: "boolean"` - a focused checkbox. */
export function TMDataGridBooleanEditor({
  field,
  column,
  size,
}: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  return (
    <Checkbox
      size={size}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      checked={value === true}
      onChange={(event) => field.handleChange(event.currentTarget.checked)}
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

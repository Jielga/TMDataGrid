import { TextInput } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import { selectAllOnFocus, useFieldError, useFieldValue } from "./editorShared";

/** The built-in editor for `meta.type: "string"` (and the default). */
export function TMDataGridStringEditor({
  field,
  autoFocus,
  column,
  size,
}: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  return (
    <TextInput
      size={size}
      w="100%"
      autoFocus={autoFocus}
      onFocus={selectAllOnFocus}
      aria-label={labels.editCell(getColumnLabel(column))}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => field.handleChange(event.currentTarget.value)}
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

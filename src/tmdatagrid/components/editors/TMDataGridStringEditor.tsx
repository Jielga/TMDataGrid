import { TextInput } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  selectAllOnFocus,
  useCaretKeeper,
  useFieldError,
  useFieldValue,
} from "./editorShared";

/** The built-in editor for `meta.type: "string"` (and the default). */
export function TMDataGridStringEditor({ field, column, size }: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  const { inputRef, remember } = useCaretKeeper();
  return (
    <TextInput
      ref={inputRef}
      size={size}
      w="100%"
      onFocus={selectAllOnFocus}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => {
        remember(event.currentTarget);
        field.handleChange(event.currentTarget.value);
      }}
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

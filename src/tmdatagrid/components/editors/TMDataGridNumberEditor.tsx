import { NumberInput } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  selectAllOnFocus,
  useCaretKeeper,
  useFieldError,
  useFieldValue,
} from "./editorShared";

/** The built-in editor for `meta.type: "number"`. */
export function TMDataGridNumberEditor({ field, column, size }: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  const { inputRef, remember } = useCaretKeeper();
  return (
    <NumberInput
      ref={inputRef}
      size={size}
      w="100%"
      onFocus={selectAllOnFocus}
      hideControls
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={typeof value === "number" ? value : ""}
      onChange={(next) => {
        if (inputRef.current !== null) remember(inputRef.current);
        // Mantine reports a number once one can be parsed, and a string while
        // it cannot. An empty cell is `null`, meaning no value.
        field.handleChange(
          typeof next === "number" ? next : next === "" ? null : Number(next),
        );
      }}
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

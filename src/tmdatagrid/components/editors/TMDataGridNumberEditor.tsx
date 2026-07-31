import { NumberInput } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import { selectAllOnFocus, useFieldError, useFieldValue } from "./editorShared";

/** The built-in editor for `meta.type: "number"`. */
export function TMDataGridNumberEditor({
  field,
  autoFocus,
  column,
  size,
}: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  return (
    <NumberInput
      size={size}
      w="100%"
      autoFocus={autoFocus}
      onFocus={selectAllOnFocus}
      hideControls
      aria-label={labels.editCell(getColumnLabel(column))}
      value={typeof value === "number" ? value : ""}
      onChange={(next) =>
        // Mantine reports a number once one can be parsed, and a string while
        // it cannot. An empty cell is `null` — the honest "no value".
        field.handleChange(
          typeof next === "number" ? next : next === "" ? null : Number(next),
        )
      }
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

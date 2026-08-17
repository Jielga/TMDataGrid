import { TextInput } from "@mantine/core";
import { useRef } from "react";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import { useFieldError, useFieldValue } from "./editorShared";

/**
 * The built-in editor for `meta.type: "date"` - the native
 * `<input type="date">` styled by Mantine, no `@mantine/dates` involved. A
 * consumer wanting a real picker plugs one in through `meta.editor`.
 */
export function TMDataGridDateEditor({
  field,
  autoFocus,
  column,
  size,
}: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const error = useFieldError(field);
  // The cell's original shape decides what the editor writes back: a `Date`
  // cell keeps getting Dates, an ISO-string cell keeps getting strings -
  // decided once at open, so clearing and retyping cannot flip the type.
  const writesDates = useRef(value instanceof Date);

  const text =
    value instanceof Date
      ? value.toLocaleDateString("sv-SE")
      : typeof value === "string"
        ? value.slice(0, 10)
        : "";

  return (
    <TextInput
      size={size}
      w="100%"
      autoFocus={autoFocus}
      type="date"
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={text}
      onChange={(event) => {
        const next = event.currentTarget.value;
        if (next === "") {
          field.handleChange(null);
          return;
        }
        field.handleChange(
          writesDates.current ? new Date(`${next}T00:00:00`) : next,
        );
      }}
      onBlur={field.handleBlur}
      error={error}
    />
  );
}

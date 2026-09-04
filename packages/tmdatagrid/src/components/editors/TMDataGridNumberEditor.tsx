import { NumberInput } from "@mantine/core";
import { useState } from "react";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  selectAllOnFocus,
  useCaretKeeper,
  useFieldInvalid,
  useFieldValue,
} from "./editorShared";

/** The built-in editor for `meta.type: "number"`. */
export function TMDataGridNumberEditor({ field, column, size }: TMDataGridEditorArgs) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  const { inputRef, remember } = useCaretKeeper();
  /**
   * The last text Mantine reported instead of a number - "-" or "1e" on the
   * way to one. Held so a half-typed number stays on screen while the field
   * itself holds no value.
   */
  const [typed, setTyped] = useState<string | null>(null);
  // The field is the source of truth: the text survives only while it still
  // describes what the field holds, so a write from outside the editor -
  // `edit.setCellValue`, a revert - replaces it rather than being masked.
  const parsedTyped = typed === null || typed === "" ? null : Number(typed);
  const textDescribesField = Number.isFinite(parsedTyped)
    ? parsedTyped === value
    : value === null;
  return (
    <NumberInput
      ref={inputRef}
      size={size}
      w="100%"
      onFocus={selectAllOnFocus}
      hideControls
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={
        typed !== null && textDescribesField
          ? typed
          : typeof value === "number"
            ? value
            : ""
      }
      onChange={(next) => {
        if (inputRef.current !== null) remember(inputRef.current);
        if (typeof next === "number") {
          setTyped(null);
          field.handleChange(next);
          return;
        }
        // Mantine reports a number once one can be parsed and a string while
        // it cannot: "" for an empty cell, partial input on the way to a
        // number. Anything that does not parse leaves the field empty rather
        // than `NaN` - which is a number to every validator and would commit
        // as one, with no message a user could act on.
        setTyped(next);
        const parsed = Number(next);
        field.handleChange(
          next !== "" && Number.isFinite(parsed) ? parsed : null,
        );
      }}
      onBlur={field.handleBlur}
      error={invalid}
    />
  );
}

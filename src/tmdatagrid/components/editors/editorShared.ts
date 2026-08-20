import { useStore } from "@tanstack/react-form";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { TMDataGridEditField } from "../../core/editEngine";

/**
 * The first error as text, whatever shape the validator produced - TanStack
 * Form keeps errors verbatim, so a Zod issue arrives as `{ message }`, a
 * plain function's return arrives as it was, and a form-level schema's
 * pathless issues arrive keyed under an empty path (`{ "": [issues] }`).
 * This digs until it finds a message.
 */
export function firstErrorText(error: unknown): string | undefined {
  if (error === null || error === undefined) return undefined;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    for (const entry of error) {
      const text = firstErrorText(entry);
      if (text !== undefined) return text;
    }
    return undefined;
  }
  if (typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    for (const value of Object.values(error)) {
      const text = firstErrorText(value);
      if (text !== undefined) return text;
    }
  }
  return undefined;
}

/** The field's live value - one subscription, on the field's own store. */
export function useFieldValue(field: TMDataGridEditField): unknown {
  return useStore(field.store, (state) => state.value as unknown);
}

/** The field's first error, for the Mantine input's `error` prop. */
export function useFieldError(field: TMDataGridEditField): string | undefined {
  return useStore(field.store, (state) =>
    firstErrorText(state.meta.errors as ReadonlyArray<unknown>),
  );
}

/** Select-all on focus - F2/Enter open with the value ready to replace. */
export function selectAllOnFocus(event: { currentTarget: unknown }): void {
  const target = event.currentTarget;
  if (target instanceof HTMLInputElement) target.select();
}

/**
 * Keeps the caret where it was typed when the value comes back changed.
 *
 * A column with `meta.edit.mapValue` writes something other than what the
 * input holds, so React reassigns `input.value` - and the browser collapses
 * the selection to the end of the field. Typing into the middle of a value
 * then jumped to the end on every keystroke.
 *
 * `remember` records the caret as the change is handed over; the effect puts
 * it back once the mapped value has rendered, shifted by however much the map
 * changed the length so a mask that inserts or strips characters keeps the
 * caret beside the same text. Without a map nothing is recorded twice and the
 * restore is a no-op, so an unmapped column is untouched.
 */
export function useCaretKeeper(): {
  inputRef: RefObject<HTMLInputElement | null>;
  remember: (input: HTMLInputElement) => void;
} {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caret = useRef<{ position: number; length: number } | null>(null);

  useLayoutEffect(() => {
    const pending = caret.current;
    const input = inputRef.current;
    caret.current = null;
    if (pending === null || input === null) return;
    const shift = input.value.length - pending.length;
    const next = Math.max(
      0,
      Math.min(pending.position + shift, input.value.length),
    );
    input.setSelectionRange(next, next);
  });

  return {
    inputRef,
    remember: (input) => {
      if (input.selectionStart === null) return;
      caret.current = {
        position: input.selectionStart,
        length: input.value.length,
      };
    },
  };
}

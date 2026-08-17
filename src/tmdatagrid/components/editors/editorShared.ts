import { useStore } from "@tanstack/react-form";
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

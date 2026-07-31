import { useStore } from "@tanstack/react-form";
import type { TMDataGridEditField } from "../../core/editEngine";

/**
 * The first field error as text, whatever shape the validator produced —
 * TanStack Form keeps errors verbatim, so a Zod issue arrives as
 * `{ message }` while a plain function's return arrives as it was.
 */
export function firstErrorText(
  errors: ReadonlyArray<unknown>,
): string | undefined {
  for (const error of errors) {
    if (error === null || error === undefined) continue;
    if (typeof error === "string") return error;
    if (
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
  }
  return undefined;
}

/** The field's live value — one subscription, on the field's own store. */
export function useFieldValue(field: TMDataGridEditField): unknown {
  return useStore(field.store, (state) => state.value as unknown);
}

/** The field's first error, for the Mantine input's `error` prop. */
export function useFieldError(field: TMDataGridEditField): string | undefined {
  return useStore(field.store, (state) => firstErrorText(state.meta.errors));
}

/** Select-all on focus — F2/Enter open with the value ready to replace. */
export function selectAllOnFocus(event: { currentTarget: unknown }): void {
  const target = event.currentTarget;
  if (target instanceof HTMLInputElement) target.select();
}

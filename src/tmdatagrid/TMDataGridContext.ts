import { createContext, useContext } from "react";
import type { TMDataGridSize } from "./sizes";
import type { TMDataGridApi } from "./useTMDataGrid";

/**
 * Row shape the chrome components work against. They only ever touch columns,
 * rows and cells generically, so the concrete row type is erased at the context
 * boundary — the same trick Mantine uses for its compound components.
 */
export type TMDataGridRowData = Record<string, unknown>;

export type TMDataGridContextValue = TMDataGridApi<TMDataGridRowData> & {
  size: TMDataGridSize;
  /** Row height in px, already resolved from `size` and `meta.rowHeight`. */
  rowHeight: number;
  /** Mantine control size that pairs with `size`. */
  controlSize: TMDataGridSize;
};

const TMDataGridContext = createContext<unknown>(null);

export const TMDataGridContextProvider = TMDataGridContext.Provider;

export function useTMDataGridContext(): TMDataGridContextValue {
  const api = useContext(TMDataGridContext);
  if (!api) {
    throw new Error(
      "TMDataGrid compound components must be rendered inside <TMDataGrid>",
    );
  }
  return api as TMDataGridContextValue;
}

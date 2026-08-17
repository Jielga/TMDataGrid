import { createContext, useContext } from "react";
import type { TMDataGridSize } from "./core/sizes";
import type { TMDataGridApi } from "./useTMDataGrid";

/**
 * Row shape the chrome components work against. They only ever touch columns,
 * rows and cells generically, so the concrete row type is erased at the context
 * boundary - the same trick Mantine uses for its compound components.
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

/**
 * What a control inside a *body* cell should put in its `tabIndex`.
 *
 * `-1` once cell selection is on, and this is what makes the promise of one tab
 * stop true. Without it the browser walks Tab into the checkbox of every
 * mounted row - a grid showing twenty rows would be twenty tab stops, and
 * scrolling would change how many. Enter or F2 steps into the cell instead,
 * which reaches a `-1` control perfectly well.
 *
 * Header controls are not covered: the header row is not part of cell
 * navigation, so its sort buttons and menus stay in the tab order, where they
 * are the only way to reach them.
 *
 * A custom cell renderer with a control in it wants the same:
 *
 * ```tsx
 * cell: ({ row }) => (
 *   <Button tabIndex={useCellControlTabIndex()} onClick={...}>Open</Button>
 * )
 * ```
 */
export function useCellControlTabIndex(): 0 | -1 {
  const { features } = useTMDataGridContext();
  return features.cellSelection ? -1 : 0;
}

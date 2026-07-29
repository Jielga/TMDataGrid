import type { RowData } from "@tanstack/react-table";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import classes from "./TMDataGrid.module.css";
import { TMDataGridColumnsPanel } from "./TMDataGridColumnsPanel.js";
import { TMDataGridContextProvider } from "./TMDataGridContext.js";
import { TMDataGridFilterPanel } from "./TMDataGridFilterPanel.js";
import { TMDataGridFooter } from "./TMDataGridFooter.js";
import { TMDataGridTable } from "./TMDataGridTable.js";
import {
  TMDataGridColumnsButton,
  TMDataGridFilterButton,
  TMDataGridSummaryCount,
  TMDataGridToolbar,
  TMDataGridToolbarSpacer,
} from "./TMDataGridToolbar.js";
import {
  DEFAULT_TMDATAGRID_SIZE,
  SIZE_CONTROL_SIZE,
  SIZE_ROW_HEIGHT,
  type TMDataGridSize,
} from "./sizes.js";
import type { TMDataGridApi } from "./useTMDataGrid.js";

export type TMDataGridProps<TData extends RowData> = TMDataGridApi<TData> & {
  children: ReactNode;
  /**
   * Mantine size scale. Drives row height, font size, cell padding and the
   * size of the controls in the chrome. `meta.rowHeight` still wins if set.
   */
  size?: TMDataGridSize;
  className?: string;
  style?: CSSProperties;
};

/**
 * Root of the grid. Takes the object returned by `useTMDataGrid` — spread it —
 * and publishes it to the compound components below it:
 *
 * ```tsx
 * const grid = useTMDataGrid({ data, columns });
 *
 * <TMDataGrid {...grid}>
 *   <TMDataGrid.Toolbar>
 *     <TMDataGrid.SummaryCount />
 *     <TMDataGrid.Spacer />
 *     <TMDataGrid.ColumnsButton />
 *   </TMDataGrid.Toolbar>
 *   <TMDataGrid.Table />
 *   <TMDataGrid.Footer />
 * </TMDataGrid>
 * ```
 */
function TMDataGridRoot<TData extends RowData>({
  table,
  ui,
  features,
  size = DEFAULT_TMDATAGRID_SIZE,
  children,
  className,
  style,
}: TMDataGridProps<TData>) {
  const rowHeight = table.options.meta?.rowHeight ?? SIZE_ROW_HEIGHT[size];

  const api = useMemo(
    () => ({
      table,
      ui,
      features,
      size,
      rowHeight,
      controlSize: SIZE_CONTROL_SIZE[size],
    }),
    [table, ui, features, size, rowHeight],
  );

  return (
    <TMDataGridContextProvider value={api}>
      <div
        data-size={size}
        className={[classes.root, className].filter(Boolean).join(" ")}
        style={style}
      >
        {children}
      </div>
    </TMDataGridContextProvider>
  );
}

export const TMDataGrid = Object.assign(TMDataGridRoot, {
  Toolbar: TMDataGridToolbar,
  Spacer: TMDataGridToolbarSpacer,
  SummaryCount: TMDataGridSummaryCount,
  ColumnsButton: TMDataGridColumnsButton,
  FilterButton: TMDataGridFilterButton,
  Table: TMDataGridTable,
  Footer: TMDataGridFooter,
  /** Rendered by `TMDataGrid.Table`; exported for custom layouts. */
  FilterPanel: TMDataGridFilterPanel,
  /** Rendered by `TMDataGrid.ColumnsButton`; exported for custom layouts. */
  ColumnsPanel: TMDataGridColumnsPanel,
});

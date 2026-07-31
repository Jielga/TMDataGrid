import type { RowData } from "@tanstack/react-table";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import classes from "./TMDataGrid.module.css";
import { TMDataGridColumnsPanel } from "./TMDataGridColumnsPanel";
import { TMDataGridContextProvider } from "../TMDataGridContext";
import { TMDataGridFilterPanel } from "./TMDataGridFilterPanel";
import { TMDataGridFilterPills } from "./TMDataGridFilterPills";
import { TMDataGridFooter } from "./TMDataGridFooter";
import { TMDataGridTable } from "./TMDataGridTable";
import {
  TMDataGridColumnsButton,
  TMDataGridFilterButton,
  TMDataGridSummaryCount,
  TMDataGridToolbar,
  TMDataGridToolbarSpacer,
} from "./TMDataGridToolbar";
import {
  DEFAULT_TMDATAGRID_SIZE,
  SIZE_CONTROL_SIZE,
  SIZE_ROW_HEIGHT,
  type TMDataGridSize,
} from "../core/sizes";
import type { TMDataGridApi } from "../useTMDataGrid";

export type TMDataGridProps<TData extends RowData> = TMDataGridApi<TData> & {
  children: ReactNode;
  /**
   * Mantine size scale. Drives row height, font size, cell padding and the
   * size of the controls in the chrome. `meta.rowHeight` still wins if set.
   */
  size?: TMDataGridSize;
  className?: string;
  /**
   * Inline styles. Widened to accept CSS variables, which is how the grid's
   * colours are themed — `--dg-row-selected-bg` for the selected row
   * background. Plain `CSSProperties` rejects `--*` keys.
   */
  style?: CSSProperties & Record<`--${string}`, string | number>;
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
  labels,
  renderDetails,
  renderDetailsEstHeight,
  overscan,
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
      labels,
      renderDetails,
      renderDetailsEstHeight,
      overscan,
      size,
      rowHeight,
      controlSize: SIZE_CONTROL_SIZE[size],
    }),
    [
      table,
      ui,
      features,
      labels,
      renderDetails,
      renderDetailsEstHeight,
      overscan,
      size,
      rowHeight,
    ],
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
  /**
   * Takes the grid as an `api` prop rather than from context, so it can be
   * rendered outside `<TMDataGrid>` — a page header, for instance.
   */
  FilterPills: TMDataGridFilterPills,
  /** Rendered by `TMDataGrid.ColumnsButton`; exported for custom layouts. */
  ColumnsPanel: TMDataGridColumnsPanel,
});

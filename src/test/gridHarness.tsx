import { MantineProvider } from "@mantine/core";
import { render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridRowData,
  type UseTMDataGridOptions,
} from "../tmdatagrid";

/**
 * Shared fixtures for the grid's tests. Lives outside `src/tmdatagrid/` so it
 * stays out of the published package and out of the declaration build.
 */
export type TestRow = {
  id: number;
  name: string;
  age: number;
  city: string;
};

const helper = createTMDataGridColumnHelper<TestRow>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
export const testColumns = helper.columns([
  helper.accessor("id", {
    header: "ID",
    meta: { type: "number" },
    minSize: 80,
  }),
  helper.accessor("name", { header: "Name", minSize: 120 }),
  helper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
    minSize: 80,
  }),
  helper.accessor("city", { header: "City", minSize: 120 }),
]);

const CITIES = ["Stockholm", "Göteborg", "Malmö"];
const NAMES = ["Anna", "Erik", "Maria", "Lars", "Sofia"];

export function makeRows(count: number): Array<TestRow> {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: NAMES[index % NAMES.length],
    age: 20 + ((index * 7) % 40),
    city: CITIES[index % CITIES.length],
  }));
}

export const testRows = makeRows(12);

/**
 * `env="test"` disables Mantine's transitions. Without it a Popover's dropdown
 * never finishes mounting under jsdom, so panels opened in a test stay empty.
 */
export function MantineWrapper({ children }: { children: ReactNode }) {
  return <MantineProvider env="test">{children}</MantineProvider>;
}

export function renderWithMantine(ui: ReactElement) {
  return render(ui, { wrapper: MantineWrapper });
}

type GridOptions = Partial<UseTMDataGridOptions<TestRow>>;

/**
 * Builds a real table through the hook, so tests exercise the same TanStack
 * state the grid runs on rather than a stand-in.
 */
export function renderGrid(options: GridOptions = {}) {
  return renderHook(
    () =>
      useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row) => String(row.id),
        ...options,
      } as UseTMDataGridOptions<TestRow>),
    { wrapper: MantineWrapper },
  );
}

export type GridResult = ReturnType<typeof renderGrid>;

/**
 * Erases the concrete row type, the way `TMDataGridContext` does at runtime.
 * The chrome and the headless helpers are all written against
 * `TMDataGridRowData`, so a test holding a `TestRow` table has to cross the
 * same boundary the components do — once, here, rather than at every call.
 */
export function erased(
  api: TMDataGridApi<TestRow>,
): TMDataGridApi<TMDataGridRowData> {
  return api as unknown as TMDataGridApi<TMDataGridRowData>;
}

/** Visible leaf column ids, in render order. */
export function visibleColumnIds(api: TMDataGridApi<TestRow>): Array<string> {
  return [
    ...api.table.getLeftVisibleLeafColumns(),
    ...api.table.getCenterVisibleLeafColumns(),
    ...api.table.getRightVisibleLeafColumns(),
  ].map((column) => column.id);
}

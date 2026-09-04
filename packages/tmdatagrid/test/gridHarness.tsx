import { MantineProvider } from "@mantine/core";
import { act, render, renderHook, screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  TMDataGridFilterPills,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridDraftActionsProps,
  type TMDataGridFooterProps,
  type TMDataGridRowData,
  type TMDataGridTableProps,
  type UseTMDataGridOptions,
} from "../src";

/**
 * Shared fixtures for the grid's tests. Lives outside `src/` so it stays out
 * of the published package and out of the declaration build.
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
 * same boundary the components do - once, here, rather than at every call.
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

export type GridProps = Partial<UseTMDataGridOptions<TestRow>> & {
  /** Everything under this key goes to `TMDataGrid.Table`, not to the hook. */
  tableProps?: TMDataGridTableProps<TestRow>;
  /** Everything under this key goes to `TMDataGrid.Footer`. */
  footerProps?: TMDataGridFooterProps;
  /** Renders `TMDataGrid.DraftActions` in the toolbar, with these props. */
  draftActionsProps?: TMDataGridDraftActionsProps;
  /** Passed to `<TMDataGrid>` itself, the way a consumer names a grid. */
  "data-testid"?: string;
};

/**
 * The full compound grid the component tests render - chrome, table and
 * footer - over the harness rows. Smoke tests for the wiring between the
 * chrome and the table live on this; TanStack's own behaviour is not
 * re-tested through it.
 */
export function Grid({
  tableProps,
  footerProps,
  draftActionsProps,
  "data-testid": testId,
  ...options
}: GridProps = {}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    ...options,
  } as UseTMDataGridOptions<TestRow>);

  return (
    <>
      {/* Rendered outside the provider on purpose: the pills take the api as a
          prop, and nothing else in the grid may. */}
      <TMDataGridFilterPills api={grid} />
      <TMDataGrid {...grid} data-testid={testId}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          {draftActionsProps ? (
            <TMDataGrid.DraftActions {...draftActionsProps} />
          ) : null}
          <TMDataGrid.FilterButton />
          <TMDataGrid.Menu>
            <TMDataGrid.Menu.Columns />
          </TMDataGrid.Menu>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> {...tableProps} />
        <TMDataGrid.Footer {...footerProps} />
      </TMDataGrid>
    </>
  );
}

export const renderGridUi = (options: GridProps = {}) =>
  renderWithMantine(<Grid {...options} />);

/**
 * Which part of the grid, and, where a part repeats, which row or column of
 * it. The `data-dg-part` contract consumers write their own suites against, so
 * the tests reach for it the same way the Testing docs page tells them to.
 */
export type PartKey = { rowId?: string; columnId?: string };

export const partSelector = (name: string, key: PartKey = {}) =>
  `[data-dg-part="${name}"]` +
  (key.rowId === undefined ? "" : `[data-row-id="${CSS.escape(key.rowId)}"]`) +
  (key.columnId === undefined
    ? ""
    : `[data-column-id="${CSS.escape(key.columnId)}"]`);

export const parts = (name: string, key?: PartKey, scope: ParentNode = document) =>
  Array.from(scope.querySelectorAll<HTMLElement>(partSelector(name, key)));

/** The one matching element, or `null` - for `not.toBeInTheDocument()`. */
export const queryPart = (
  name: string,
  key?: PartKey,
  scope: ParentNode = document,
) => scope.querySelector<HTMLElement>(partSelector(name, key));

export const part = (name: string, key?: PartKey, scope?: ParentNode) => {
  const found = queryPart(name, key, scope);
  if (found === null) {
    throw new Error(`No element matching ${partSelector(name, key)}`);
  }
  return found;
};

export const header = (columnId: string) => part("header", { columnId });

export const bodyRows = () => parts("row");

/**
 * How many rows the grid says it has, mounted or not. Virtualization decides
 * what is in the DOM - and under jsdom, which has no layout, it mounts a
 * handful - so a count of rows has to come off `aria-rowcount`, minus the
 * header rows it includes. The role is `grid` rather than `table` once cell
 * selection is on, which `editing` switches on by itself.
 *
 * The header rows are counted rather than assumed to be one: header groups
 * stack, and `filters.inHeader` adds a filter row below them. Counted on the
 * grid element itself, so a second grid in the document cannot skew it.
 */
export const gridRowCount = () => {
  const grid = screen.queryByRole("table") ?? screen.getByRole("grid");
  return (
    Number(grid.getAttribute("aria-rowcount")) -
    grid.querySelectorAll("[data-dg-header-row]").length
  );
};

/** Row ids in the order they are rendered. */
export const renderedRowIds = () =>
  bodyRows().map((row) => row.getAttribute("data-row-id") ?? "");

/** Column ids in the order their headers are rendered, left lane first. */
export const renderedHeaderIds = () =>
  parts("header").map((cell) => cell.getAttribute("data-column-id") ?? "");

/**
 * Text of one column's cells, in rendered order. Cell 0 is the generated
 * checkbox column, so the defined columns start at 1.
 */
export const renderedColumn = (index: number) =>
  bodyRows().map(
    (row) => within(row).getAllByRole("cell")[index]?.textContent ?? "",
  );

/**
 * One body cell by position, on a grid running cell selection (which is what
 * flips the cells' role to `gridcell`). On the default harness grid the
 * columns are [checkbox, ID, Name, Age, City], so `name` is cell 2.
 */
export const cellAt = (rowIndex: number, columnIndex: number) =>
  within(bodyRows()[rowIndex]!).getAllByRole("gridcell")[columnIndex]!;

/** The selected block as `rowId:columnId`, in render order. */
export const selectedCells = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-cell][data-selected="true"]'),
  ).map((cell) => `${cell.dataset.rowId}:${cell.dataset.columnId}`);

/**
 * How many times the body asked its scroll container to move.
 *
 * The offset it asks for is TanStack Virtual's to compute, and jsdom cannot
 * check it: nothing is laid out, the ResizeObserver is a stub, and the
 * virtualizer measures everything as zero. What is testable here is the part
 * this grid owns - whether a row resolves to a scroll at all. That the rows
 * then mount is a browser-level concern; see the Testing docs page.
 */
export function countScrolls(run: () => void): number {
  const container = document.querySelector<HTMLElement>(
    "[data-dg-scroll-container]",
  );
  if (container === null) throw new Error("no scroll container");
  const original = container.scrollTo;
  let calls = 0;
  container.scrollTo = (() => {
    calls += 1;
  }) as typeof container.scrollTo;
  try {
    act(run);
  } finally {
    container.scrollTo = original;
  }
  return calls;
}

type UserEvent = ReturnType<typeof userEvent.setup>;

/** Opens a header's column menu and returns its items. */
export const openColumnMenu = async (user: UserEvent, label: string) => {
  await user.click(
    screen.getByRole("button", { name: `${label} column menu` }),
  );
  return screen.getAllByRole("menuitem");
};

export const clickMenuItem = async (
  user: UserEvent,
  label: string,
  item: string | RegExp,
) => {
  await openColumnMenu(user, label);
  await user.click(screen.getByRole("menuitem", { name: item }));
};

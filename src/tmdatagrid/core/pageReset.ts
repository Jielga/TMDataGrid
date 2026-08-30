import {
  functionalUpdate,
  makeStateUpdater,
  type TableState,
  type Updater,
} from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { sameStateValue } from "./controlledState";
import { activeColumnFilters } from "./filterOperators";

/**
 * Sends a server-paged grid back to the first page when the query changes.
 *
 * Under `manualPagination` the grid does not own the result set, so a column
 * filter, the quick search or a sort leaves `pageIndex` pointing into a page
 * range that no longer exists: the next request asks the server for page 8 of
 * a result set that now has three, and the consumer gets an empty grid with
 * no error.
 *
 * TanStack's `autoResetPageIndex` does not cover it. It defaults to
 * `!manualPagination`, so it is off exactly when this is needed, and it fires
 * on a data change - which server-side is the response landing, one request
 * too late.
 *
 * The reset rides on the slice's own change callback rather than on an effect
 * over table state, so both writes land in the same render and the query goes
 * out once. From an effect the request for the stale page would leave first.
 */

/** The state a server-side query is built from. */
export type TMDataGridQuerySlice =
  | "columnFilters"
  | "globalFilter"
  | "sorting";

/** What the reset reads and writes - the table, narrowed to that. */
export type TMDataGridQueryTable = {
  store: { state: TableState<TMDataGridFeatures> };
  setPageIndex: (index: number) => void;
};

type QueryHandler = (updater: never) => void;

/**
 * Whether the server would answer the next state differently.
 *
 * A column filter with an empty value matches every row, so it is not part of
 * the query: opening the filter panel seeds a row on the first filterable
 * column, and the user then types into it. Neither moves the result set, and
 * neither may throw away the page the user is on.
 */
function changesTheQuery(
  slice: TMDataGridQuerySlice,
  previous: unknown,
  next: unknown,
): boolean {
  if (slice === "columnFilters") {
    return !sameStateValue(
      activeColumnFilters(previous as TableState<TMDataGridFeatures>["columnFilters"]),
      activeColumnFilters(next as TableState<TMDataGridFeatures>["columnFilters"]),
    );
  }
  return !sameStateValue(previous, next);
}

/**
 * Wraps one slice's change callback. `handler` is the consumer's, where they
 * control the slice; without one the write is the same `makeStateUpdater`
 * TanStack would have defaulted to, which this option replaces.
 */
export function withPageReset(
  slice: TMDataGridQuerySlice,
  handler: QueryHandler | undefined,
  getTable: () => TMDataGridQueryTable,
): QueryHandler {
  return (updater) => {
    const table = getTable();
    const previous = table.store.state[slice];
    // Resolved here rather than read back off the table afterwards: where the
    // consumer owns the slice the write is their `setState`, so the table
    // still holds the old value when this returns. Updaters are pure
    // derivations of the previous value, so applying one twice is safe.
    const next = functionalUpdate(updater as Updater<unknown>, previous);

    (handler ?? (makeStateUpdater(slice, table as never) as QueryHandler))(
      updater,
    );

    if (!changesTheQuery(slice, previous, next)) return;
    // Already on the first page: writing anyway would publish the store and
    // re-render the grid for a value that did not move.
    if (table.store.state.pagination.pageIndex !== 0) table.setPageIndex(0);
  };
}

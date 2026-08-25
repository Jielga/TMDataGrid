import type { TableState } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type GridState = TableState<TMDataGridFeatures>;

/**
 * Controlled state, and the two things the grid has to do about it.
 *
 * TanStack's `state` option is a per-slice override: table-core re-reads it on
 * every render - `useTable` calls `setOptions` while rendering - and writes any
 * slice whose value is not *identical* to the one the table holds back into the
 * table's atom. That write publishes the store, which re-renders the consumer,
 * which builds its options object again. An object literal written in the
 * render body is a new identity every time, so the cycle never closes:
 *
 * ```tsx
 * // Renders forever, with or without this grid.
 * useTMDataGrid({ data, columns, state: { columnVisibility: { play: false } } });
 * ```
 *
 * {@link stabilizeControlledState} closes it by handing the table back the
 * previous render's value whenever the new one says the same thing, and
 * {@link findFrozenStateSlices} names the other half of the trap: a controlled
 * slice with no callback to write through, which the grid cannot change no
 * matter what the user clicks.
 */

/**
 * The `onXChange` option that owns each controlled slice. `globalFilterFn` is
 * left out: it is configuration living in the state bag, not something the grid
 * writes.
 */
export const CONTROLLED_SLICE_HANDLERS = {
  columnFilters: "onColumnFiltersChange",
  columnOrder: "onColumnOrderChange",
  columnPinning: "onColumnPinningChange",
  columnResizing: "onColumnResizingChange",
  columnSizing: "onColumnSizingChange",
  columnVisibility: "onColumnVisibilityChange",
  expanded: "onExpandedChange",
  globalFilter: "onGlobalFilterChange",
  grouping: "onGroupingChange",
  pagination: "onPaginationChange",
  rowPinning: "onRowPinningChange",
  rowSelection: "onRowSelectionChange",
  sorting: "onSortingChange",
} as const satisfies Partial<Record<keyof GridState, string>>;

export type TMDataGridControlledSlice = keyof typeof CONTROLLED_SLICE_HANDLERS;

/** The options {@link findFrozenStateSlices} reads - a subset of `TableOptions`. */
type ControlledOptions = {
  state?: Partial<GridState>;
  /**
   * The v9 way of owning a slice: an atom the table writes through directly.
   * It outranks `state`, so a slice backed by one is never frozen.
   */
  atoms?: Record<string, unknown>;
} & Partial<
  Record<(typeof CONTROLLED_SLICE_HANDLERS)[TMDataGridControlledSlice], unknown>
>;

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

/**
 * An object carrying data rather than behaviour - a state slice, or one of the
 * records inside it.
 *
 * Null prototypes count: table-core builds its visibility, sizing and selection
 * maps with `Object.create(null)`, so the state the consumer echoes back from a
 * callback is made of them.
 */
function isDataObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Whether two state values say the same thing.
 *
 * Structural, because the whole point is to see past the identity a fresh
 * object literal has. Dates, `Map`s and class instances are compared by
 * identity - they are not what state slices are made of, and guessing at their
 * contents would be worse than the extra render.
 */
export function sameStateValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return (
      a.length === b.length &&
      a.every((item, index) => sameStateValue(item, b[index]))
    );
  }
  if (!isDataObject(a) || !isDataObject(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => hasOwn(b, key) && sameStateValue(a[key], b[key]));
}

/**
 * Gives every unchanged slice of `next` the identity it had last render, so
 * table-core's per-render sync has nothing to write.
 *
 * Returns `previous` itself when nothing changed at all, which keeps the
 * options object stable too.
 */
export function stabilizeControlledState(
  next: Partial<GridState> | undefined,
  previous: Partial<GridState> | undefined,
): Partial<GridState> | undefined {
  if (next === undefined || previous === undefined || next === previous) {
    return next;
  }

  const keys = Object.keys(next);
  const stabilized: Record<string, unknown> = {};
  let changed = keys.length !== Object.keys(previous).length;

  for (const key of keys) {
    const nextValue = (next as Record<string, unknown>)[key];
    const previousValue = (previous as Record<string, unknown>)[key];
    if (hasOwn(previous, key) && sameStateValue(nextValue, previousValue)) {
      // The value this render built says the same thing, so the table keeps the
      // object it already has and its sync finds nothing to write.
      stabilized[key] = previousValue;
    } else {
      stabilized[key] = nextValue;
      changed = true;
    }
  }

  return changed ? (stabilized as Partial<GridState>) : previous;
}

/**
 * The controlled slices nothing can write back to: `state.x` is set, no
 * `onXChange` was passed, and no external atom owns the slice either.
 *
 * TanStack routes every write through the callback, so such a slice is frozen
 * at the value the consumer passes - the column menu, the filter panel and the
 * pager go through the motions and the next render puts the old value back.
 * Seeding a starting value is `initialState`'s job.
 */
export function findFrozenStateSlices(
  options: ControlledOptions,
): Array<{ slice: TMDataGridControlledSlice; handler: string }> {
  const state = options.state;
  if (state === undefined) return [];

  return (
    Object.entries(CONTROLLED_SLICE_HANDLERS) as Array<
      [TMDataGridControlledSlice, string]
    >
  )
    .filter(
      ([slice, handler]) =>
        hasOwn(state, slice) &&
        (options as Record<string, unknown>)[handler] === undefined &&
        options.atoms?.[slice] === undefined,
    )
    .map(([slice, handler]) => ({ slice, handler }));
}

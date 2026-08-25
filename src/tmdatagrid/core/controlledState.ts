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
 * The `onXChange` option that owns each controlled slice - every slice v9
 * defines. `globalFilterFn` is not among them: in this beta it is a table
 * option, not state.
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
 * Structural, to see past the identity a fresh object literal has. `Date`s
 * compare by time, because the grid's own date filters hold them and a filter
 * value rebuilt each render must not read as a change. `Map`s and class
 * instances compare by identity: their contents are not knowable here, and a
 * controlled slice holding one built inline stays unstable - which TanStack
 * turns into the render loop this module exists to stop. Filter values should
 * be primitives, plain objects, arrays or `Date`s.
 */
export function sameStateValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }
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
 * Drops entries whose value is `undefined` - the conditionally-controlled
 * shape, `state: { sorting: cond ? sorting : undefined }`.
 *
 * TanStack's sync iterates the keys of `state` and writes each value into the
 * slice's atom, `undefined` included, which leaves `getState().sorting` broken
 * for everything that reads it. A key set to `undefined` means "not controlled
 * right now", so it is removed before the table sees it and the slice falls
 * back to the table's own state. Identity is kept when there is nothing to
 * drop - the stabilizer downstream compares by it.
 */
export function withoutUndefinedSlices(
  state: Partial<GridState> | undefined,
): Partial<GridState> | undefined {
  if (state === undefined) return state;
  if (!Object.values(state).includes(undefined)) return state;
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined) compacted[key] = value;
  }
  return compacted as Partial<GridState>;
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
        // An undefined-valued key is scrubbed before the table sees it - the
        // slice is not controlled, so there is nothing to freeze.
        (state as Record<string, unknown>)[slice] !== undefined &&
        (options as Record<string, unknown>)[handler] === undefined &&
        options.atoms?.[slice] === undefined,
    )
    .map(([slice, handler]) => ({ slice, handler }));
}

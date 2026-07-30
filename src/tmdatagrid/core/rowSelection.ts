import type { Row, RowData, RowSelectionState } from "@tanstack/react-table";
import type { TMDataGridFeatureFlags } from "./capabilities";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/**
 * Rows in the order they are displayed, which is the order a shift-click range
 * is measured over — so a range follows the active sort and skips filtered-out
 * rows. Under pagination it is the current page, so a range cannot cross a page
 * boundary.
 */
export function getDisplayedRows<TData extends RowData>(
  table: TMDataGridTable<TData>,
  features: TMDataGridFeatureFlags,
): Array<Row<TMDataGridFeatures, TData>> {
  return features.pagination
    ? table.getPaginatedRowModel().rows
    : table.getPrePaginatedRowModel().rows;
}

/**
 * Which modifiers were held. Named for what they mean rather than for the keys,
 * because the keys differ per platform — `toggle` is Ctrl on Windows/Linux and
 * Cmd on macOS.
 */
export type TMDataGridRowClickModifiers = {
  toggle: boolean;
  extend: boolean;
};

export type ResolveRowSelectionClickArgs<TData extends RowData> = {
  /** Displayed order — see {@link getDisplayedRows}. */
  rows: ReadonlyArray<Row<TMDataGridFeatures, TData>>;
  rowId: string;
  /** The pivot a shift-click extends from. */
  anchorRowId: string | null;
  modifiers: TMDataGridRowClickModifiers;
  selection: RowSelectionState;
  /**
   * Whether this gesture is allowed to clear rows it did not touch.
   *
   * `true` for a bare row click, where replacing is the whole point. `false` for
   * a checkbox, which is only ever additive — ticking one box has never cleared
   * the others, and shift-clicking one adds the range rather than becoming it.
   */
  canReplaceSelection: boolean;
};

export type ResolvedRowSelection = {
  selection: RowSelectionState;
  anchorRowId: string | null;
};

/**
 * Turns one click into the next selection, following the convention every
 * desktop list uses:
 *
 * | Gesture | Effect |
 * | ------- | ------ |
 * | Click | selection becomes only this row |
 * | Ctrl/Cmd + click | toggle this row, leave the rest |
 * | Shift + click | selection becomes the range anchor → this row |
 * | Ctrl/Cmd + Shift + click | add that range to the selection |
 *
 * The anchor is a *pivot*, not "the last row touched": only a plain or
 * Ctrl-click moves it, which is what lets a run of shift-clicks grow and shrink
 * the same range from a fixed point.
 *
 * Selection state is rebuilt here and handed to `setRowSelection` wholesale
 * rather than going through `row.toggleSelected()` per row, which would publish
 * one state update each. That skips TanStack's sub-row cascade — fine for this
 * grid, which registers neither grouping nor expanding, so no row has subRows.
 */
export function resolveRowSelectionClick<TData extends RowData>({
  rows,
  rowId,
  anchorRowId,
  modifiers,
  selection,
  canReplaceSelection,
}: ResolveRowSelectionClickArgs<TData>): ResolvedRowSelection {
  const index = rows.findIndex((row) => row.id === rowId);
  const clickedRow = rows[index];
  // Clicked row is not in the displayed set — nothing sensible to resolve.
  if (index === -1 || clickedRow === undefined) return { selection, anchorRowId };

  // `enableMultiRowSelection: false`, or the per-row predicate saying no: one
  // row at a time, so the modifiers have nothing to build on and every gesture
  // collapses to a single id.
  //
  // This has to be enforced here. Rebuilding the map and handing it to
  // `setRowSelection` skips `mutateRowIsSelected`, which is where TanStack
  // clears the other rows — so without this, Ctrl and Shift would quietly
  // produce the multi-selection the option ruled out.
  if (!clickedRow.getCanMultiSelect()) {
    // A checkbox must still be able to untick the one selected row; a row click
    // only ever sets, so re-clicking it cannot empty the selection.
    const untick = !canReplaceSelection && selection[rowId] === true;
    return {
      selection: untick ? {} : { [rowId]: true },
      anchorRowId: rowId,
    };
  }

  const anchorIndex =
    anchorRowId === null
      ? -1
      : rows.findIndex((row) => row.id === anchorRowId);

  // A range needs a pivot that is still on screen. When the anchor has been
  // filtered or paged away, fall through and treat this as a fresh click.
  if (modifiers.extend && anchorIndex !== -1) {
    const from = Math.min(anchorIndex, index);
    const to = Math.max(anchorIndex, index);
    // Ctrl+Shift adds to what is already selected; Shift alone becomes the
    // range — unless the gesture may not replace, in which case it also adds.
    const next: RowSelectionState =
      modifiers.toggle || !canReplaceSelection ? { ...selection } : {};
    for (const row of rows.slice(from, to + 1)) {
      if (row.getCanSelect()) next[row.id] = true;
    }
    // The pivot deliberately stays put.
    return { selection: next, anchorRowId };
  }

  if (modifiers.toggle || !canReplaceSelection) {
    const next: RowSelectionState = { ...selection };
    if (next[rowId] === true) delete next[rowId];
    else next[rowId] = true;
    return { selection: next, anchorRowId: rowId };
  }

  return { selection: { [rowId]: true }, anchorRowId: rowId };
}

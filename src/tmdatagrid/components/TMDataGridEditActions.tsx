import { Button, Group } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";

/**
 * How many rows are waiting to be saved: dirty edits, entry rows (an add is
 * pending whether or not it was touched), and deletion marks.
 */
function usePendingCount(): number {
  const { edit } = useTMDataGridContext();
  return useSelector(
    edit.store,
    (state) =>
      state.openRowIds.filter(
        (rowId) =>
          state.newRows.some((newRow) => newRow.tempId === rowId) ||
          (state.rows[rowId]?.dirtyFields.length ?? 0) > 0,
      ).length + state.deletedRowIds.length,
  );
}

/*
 * Module scope, like the pagination controls and for the same reason: a
 * component defined inside the render body is a new type every render, so
 * React would remount the buttons underneath an interaction.
 */

function EditSaveButton() {
  const { edit, labels } = useTMDataGridContext();
  const pendingCount = usePendingCount();
  const isSubmitting = useSelector(edit.store, (state) =>
    state.openRowIds.some((rowId) => state.rows[rowId]?.isSubmitting === true),
  );

  return (
    <Button
      size="compact-sm"
      disabled={pendingCount === 0}
      loading={isSubmitting}
      data-dg-part="save-all"
      onClick={() => void edit.submitAll()}
    >
      {labels.saveAllEdits(pendingCount)}
    </Button>
  );
}

function EditDiscardButton() {
  const { edit, labels } = useTMDataGridContext();
  const pendingCount = usePendingCount();

  return (
    <Button
      variant="subtle"
      color="gray"
      size="compact-sm"
      disabled={pendingCount === 0}
      data-dg-part="discard-all"
      onClick={() => edit.cancelAll()}
    >
      {labels.discardAllEdits}
    </Button>
  );
}

const EDIT_ACTIONS_CONTROLS: TMDataGridEditActionsControls = {
  Save: EditSaveButton,
  Discard: EditDiscardButton,
};

/** What the edit chrome is showing. */
export type TMDataGridEditActionsState = {
  /** Rows with unsaved work: dirty edits, entry rows, and deletion marks. */
  pendingCount: number;
  /** Whether a submit is in flight. */
  isSubmitting: boolean;
};

/** What the edit chrome can do. */
export type TMDataGridEditActionsActions = {
  /** Commits every open row. Resolves `false` when a row stayed open. */
  save: () => Promise<boolean>;
  /** Drops every draft. */
  discard: () => void;
};

/** The pre-bound pieces of the built-in edit chrome. */
export type TMDataGridEditActionsControls = {
  /** Save, with the pending count, disabled while nothing is pending. */
  Save: () => ReactNode;
  /** Discard, disabled while nothing is pending. */
  Discard: () => ReactNode;
};

/** What {@link TMDataGridEditActionsProps.renderActions} is handed. */
export type TMDataGridEditActionsSlotArgs = {
  state: TMDataGridEditActionsState;
  actions: TMDataGridEditActionsActions;
  Controls: TMDataGridEditActionsControls;
};

export type TMDataGridEditActionsProps = {
  /**
   * Replaces the built-in Save/Discard pair, and is handed the pieces of it.
   *
   * ```tsx
   * <TMDataGrid.EditActions
   *   renderActions={({ state, Controls }) => (
   *     <Group>
   *       {state.pendingCount > 0 && <Badge>{state.pendingCount}</Badge>}
   *       <Controls.Save />
   *       <Controls.Discard />
   *     </Group>
   *   )}
   * />
   * ```
   */
  renderActions?: (args: TMDataGridEditActionsSlotArgs) => ReactNode;
};

/**
 * Batch mode's toolbar chrome: Save with the dirty-row count, and Discard.
 * Both read the edit store, so they grey out while nothing is dirty and the
 * Save spins while a submit is in flight. Works under any `editMode` - a
 * cellConfirm grid accumulating drafts can offer the same pair - and renders
 * nothing while editing is off.
 *
 * ```tsx
 * <TMDataGrid.Toolbar>
 *   <TMDataGrid.SummaryCount />
 *   <TMDataGrid.Spacer />
 *   <TMDataGrid.EditActions />
 * </TMDataGrid.Toolbar>
 * ```
 */
export function TMDataGridEditActions({
  renderActions,
}: TMDataGridEditActionsProps = {}) {
  const { edit, features } = useTMDataGridContext();
  const pendingCount = usePendingCount();
  const isSubmitting = useSelector(edit.store, (state) =>
    state.openRowIds.some((rowId) => state.rows[rowId]?.isSubmitting === true),
  );

  if (!features.editing) return null;

  if (renderActions) {
    return renderActions({
      state: { pendingCount, isSubmitting },
      actions: { save: () => edit.submitAll(), discard: () => edit.cancelAll() },
      Controls: EDIT_ACTIONS_CONTROLS,
    });
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <EditSaveButton />
      <EditDiscardButton />
    </Group>
  );
}

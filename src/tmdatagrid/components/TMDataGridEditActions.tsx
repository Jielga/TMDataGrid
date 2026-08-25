import { Button, Group, Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";

/**
 * How many rows the draft store holds - committed edits, committed entry
 * rows and deletion marks. This is what Save sends, so it is what Save
 * counts: a row the user is still typing into is not in here.
 */
function useDraftCount(): number {
  const { edit } = useTMDataGridContext();
  return useSelector(
    edit.store,
    (state) =>
      state.committedRowIds.length +
      state.newRows.filter((newRow) => newRow.committed).length +
      state.deletedRowIds.length,
  );
}

/**
 * How many rows are still open - edited or entered but not committed, so not
 * part of the save. Surfaced beside Save so an uncommitted row is visible
 * rather than silently left behind.
 */
function useOpenCount(): number {
  const { edit } = useTMDataGridContext();
  return useSelector(
    edit.store,
    (state) =>
      state.openRowIds.filter(
        (rowId) =>
          !state.committedRowIds.includes(rowId) &&
          !state.newRows.some(
            (newRow) => newRow.tempId === rowId && newRow.committed,
          ) &&
          (state.newRows.some((newRow) => newRow.tempId === rowId) ||
            (state.rows[rowId]?.dirtyFields.length ?? 0) > 0),
      ).length,
  );
}

/*
 * Module scope, like the pagination controls and for the same reason: a
 * component defined inside the render body is a new type every render, so
 * React would remount the buttons underneath an interaction.
 */

function EditSaveButton() {
  const { edit, labels } = useTMDataGridContext();
  const draftCount = useDraftCount();
  const isSubmitting = useSelector(edit.store, (state) =>
    state.openRowIds.some((rowId) => state.rows[rowId]?.isSubmitting === true),
  );

  return (
    <Button
      size="compact-sm"
      disabled={draftCount === 0}
      loading={isSubmitting}
      data-dg-part="save-all"
      data-draft-count={draftCount}
      onClick={() => void edit.saveDrafts()}
    >
      {labels.saveAllEdits(draftCount)}
    </Button>
  );
}

/** The count of rows left open, or nothing while every row is decided. */
function EditOpenRowsNote() {
  const { labels } = useTMDataGridContext();
  const openCount = useOpenCount();
  if (openCount === 0) return null;
  return (
    <Text
      size="xs"
      c="dimmed"
      data-dg-part="open-rows-note"
      data-open-count={openCount}
    >
      {labels.editRowsStillOpen(openCount)}
    </Text>
  );
}

function EditDiscardButton() {
  const { edit, labels } = useTMDataGridContext();
  // Discard drops everything the grid is holding, open rows included, so it
  // stays live while anything is uncommitted.
  const pendingCount = useDraftCount() + useOpenCount();

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
  OpenRowsNote: EditOpenRowsNote,
};

/** What the edit chrome is showing. */
export type TMDataGridEditActionsState = {
  /**
   * Rows in the draft store, which is what Save sends: committed edits,
   * committed entry rows and deletion marks.
   */
  draftCount: number;
  /**
   * Rows still open - edited or entered but not committed, so not part of
   * the save. They stay open across a save.
   */
  openCount: number;
  /**
   * @deprecated Was "everything uncommitted", which Save no longer sends.
   * Reads as `draftCount + openCount`; use whichever you meant.
   */
  pendingCount: number;
  /** Whether a submit is in flight. */
  isSubmitting: boolean;
};

/** What the edit chrome can do. */
export type TMDataGridEditActionsActions = {
  /** Saves the draft store. Open rows are left alone. */
  save: () => Promise<boolean>;
  /** Submits every open row, committing the ones that validate. */
  commitAll: () => Promise<boolean>;
  /** Drops everything - open form state and the draft store alike. */
  discard: () => void;
};

/** The pre-bound pieces of the built-in edit chrome. */
export type TMDataGridEditActionsControls = {
  /** Save, with the draft count, disabled while the draft store is empty. */
  Save: () => ReactNode;
  /** Discard, disabled while nothing is pending. */
  Discard: () => ReactNode;
  /** The "N rows still being edited" note, or nothing while there are none. */
  OpenRowsNote: () => ReactNode;
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
   *       {state.draftCount > 0 && <Badge>{state.draftCount}</Badge>}
   *       <Controls.OpenRowsNote />
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
 * Draft mode's toolbar chrome: Save with the draft-store count, Discard, and
 * a note counting rows still open. Save sends the draft store and leaves open
 * rows alone, so it greys out while nothing is committed however much is
 * being typed - the note is what makes those rows visible. Works under any
 * `editing.mode` and renders nothing while editing is off.
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
  const draftCount = useDraftCount();
  const openCount = useOpenCount();
  const isSubmitting = useSelector(edit.store, (state) =>
    state.openRowIds.some((rowId) => state.rows[rowId]?.isSubmitting === true),
  );

  if (!features.editing) return null;

  if (renderActions) {
    return renderActions({
      state: {
        draftCount,
        openCount,
        pendingCount: draftCount + openCount,
        isSubmitting,
      },
      actions: {
        save: () => edit.saveDrafts(),
        commitAll: () => edit.commitAll(),
        discard: () => edit.cancelAll(),
      },
      Controls: EDIT_ACTIONS_CONTROLS,
    });
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <EditOpenRowsNote />
      <EditSaveButton />
      <EditDiscardButton />
    </Group>
  );
}

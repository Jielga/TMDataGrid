import { Button, Group, Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";

/**
 * How many rows the draft store holds - parked edits, parked entry rows and
 * deletion marks. This is what Save sends, so it is what Save counts: a row
 * the user is still typing into is not in here.
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
 * How many rows are still open - edited or entered but not parked, so not
 * part of the save. Surfaced beside Save so an undecided row is visible
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

const EDIT_ACTIONS_CONTROLS: TMDataGridDraftActionsControls = {
  Save: EditSaveButton,
  Discard: EditDiscardButton,
  OpenRowsNote: EditOpenRowsNote,
};

/** What the edit chrome is showing. */
export type TMDataGridDraftActionsState = {
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
export type TMDataGridDraftActionsActions = {
  /** Saves the draft store. Open rows are left alone. */
  save: () => Promise<boolean>;
  /** Submits every open row, committing the ones that validate. */
  commitAll: () => Promise<boolean>;
  /** Drops everything - open form state and the draft store alike. */
  discard: () => void;
};

/** The pre-bound pieces of the built-in edit chrome. */
export type TMDataGridDraftActionsControls = {
  /** Save, with the draft count, disabled while the draft store is empty. */
  Save: () => ReactNode;
  /** Discard, disabled while nothing is pending. */
  Discard: () => ReactNode;
  /** The "N rows still being edited" note, or nothing while there are none. */
  OpenRowsNote: () => ReactNode;
};

/** What {@link TMDataGridDraftActionsProps.renderActions} is handed. */
export type TMDataGridDraftActionsSlotArgs = {
  state: TMDataGridDraftActionsState;
  actions: TMDataGridDraftActionsActions;
  Controls: TMDataGridDraftActionsControls;
};

export type TMDataGridDraftActionsProps = {
  /**
   * Replaces the built-in Save/Discard pair, and is handed the pieces of it.
   *
   * ```tsx
   * <TMDataGrid.DraftActions
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
  renderActions?: (args: TMDataGridDraftActionsSlotArgs) => ReactNode;
};

/**
 * The draft store's toolbar chrome: Save with the store's count, Discard, and
 * a note counting the rows still open. Save sends the store and leaves open
 * rows alone, so it greys out while nothing is parked however much is being
 * typed - the note is what makes those rows visible.
 *
 * Works under any `editing.mode`. The toolbar is declarative: the grid does
 * not decide for you, so include this only when the grid runs a draft store -
 * without `editing.draft` there is nothing to save and Save stays disabled.
 *
 * ```tsx
 * <TMDataGrid.Toolbar>
 *   <TMDataGrid.SummaryCount />
 *   <TMDataGrid.Spacer />
 *   <TMDataGrid.DraftActions />
 * </TMDataGrid.Toolbar>
 * ```
 */
export function TMDataGridDraftActions({
  renderActions,
}: TMDataGridDraftActionsProps = {}) {
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

import { Button, Group } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useTMDataGridContext } from "../TMDataGridContext";

/**
 * Batch mode's toolbar chrome: Save with the dirty-row count, and Discard.
 * Both read the edit store, so they grey out while nothing is dirty and the
 * Save spins while a submit is in flight. Works under any `editMode` — a
 * cellConfirm grid accumulating drafts can offer the same pair — and renders
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
export function TMDataGridEditActions() {
  const { edit, features, labels } = useTMDataGridContext();
  // Everything pending counts: dirty edits, entry rows (an add is pending
  // whether or not it was touched), and deletion marks.
  const dirtyCount = useSelector(
    edit.store,
    (state) =>
      state.openRowIds.filter(
        (rowId) =>
          state.newRows.some((newRow) => newRow.tempId === rowId) ||
          (state.rows[rowId]?.dirtyFields.length ?? 0) > 0,
      ).length + state.deletedRowIds.length,
  );
  const isSubmitting = useSelector(edit.store, (state) =>
    state.openRowIds.some((rowId) => state.rows[rowId]?.isSubmitting === true),
  );

  if (!features.editing) return null;

  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        size="compact-sm"
        disabled={dirtyCount === 0}
        loading={isSubmitting}
        data-dg-part="save-all"
        onClick={() => void edit.submitAll()}
      >
        {labels.saveAllEdits(dirtyCount)}
      </Button>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        disabled={dirtyCount === 0}
        data-dg-part="discard-all"
        onClick={() => edit.cancelAll()}
      >
        {labels.discardAllEdits}
      </Button>
    </Group>
  );
}

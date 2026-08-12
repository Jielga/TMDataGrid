import { ActionIcon } from "@mantine/core";
import { FieldApi } from "@tanstack/react-form";
import type { Cell, Row } from "@tanstack/react-table";
import {
  type ComponentType,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import classes from "./TMDataGridTable.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import {
  getEditFieldName,
  normalizeFieldValidate,
  type TMDataGridEditField,
  type TMDataGridEditorArgs,
} from "../core/editEngine";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { CheckIcon, CloseIcon } from "./icons";
import { TMDataGridBooleanEditor } from "./editors/TMDataGridBooleanEditor";
import { TMDataGridDateEditor } from "./editors/TMDataGridDateEditor";
import { TMDataGridMultiSelectEditor } from "./editors/TMDataGridMultiSelectEditor";
import { TMDataGridNumberEditor } from "./editors/TMDataGridNumberEditor";
import { TMDataGridSelectEditor } from "./editors/TMDataGridSelectEditor";
import { TMDataGridStringEditor } from "./editors/TMDataGridStringEditor";

const BUILT_IN_EDITORS: Record<
  string,
  ComponentType<TMDataGridEditorArgs>
> = {
  string: TMDataGridStringEditor,
  number: TMDataGridNumberEditor,
  boolean: TMDataGridBooleanEditor,
  date: TMDataGridDateEditor,
  select: TMDataGridSelectEditor,
  multiSelect: TMDataGridMultiSelectEditor,
};

/** How an editor closed, for the table to decide where the focus goes. */
export type TMDataGridCellEditorClose =
  | { committed: true; via: "enter" | "tab" | "shift-tab" | "pick" }
  | { committed: false; via: "escape" }
  /** Batch: the editor closed, the draft stays — Enter parks, Tab moves on. */
  | { committed: false; via: "defer" | "defer-tab" | "defer-shift-tab" };

/**
 * The host an editing cell mounts — it owns the field, the keys and the blur
 * policy; the editor inside it (a built-in picked by `meta.type`, or the
 * column's `meta.editor`) owns the input.
 *
 * The form outlives this component by design: scrolling the row away
 * unmounts the host, and the form in the engine's map keeps the draft.
 */
export function TMDataGridCellEditor({
  cell,
  row,
  takeSeedText,
  autoFocus = true,
  onClose,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  row: Row<TMDataGridFeatures, TMDataGridRowData>;
  /** Consumes the pending type-to-edit seed, when typing opened this editor. */
  takeSeedText: () => string | undefined;
  /** In row mode only the first editable cell takes the focus. */
  autoFocus?: boolean;
  /** After the editor closed itself — the table moves the focus. */
  onClose: (args: TMDataGridCellEditorClose) => void;
}) {
  const { table, edit, features, labels, controlSize } = useTMDataGridContext();
  // Row mode mounts one host per editable cell of the row; every key that
  // commits or cancels acts on the whole row's form either way, but Tab must
  // stay the browser's (it walks the row's inputs) and blur must do nothing
  // (focus moves between this row's own editors).
  const isRowMode = features.editMode === "row";
  const column = cell.column;
  const form = edit.getForm(row.id);
  const fieldName = getEditFieldName(column);
  const [seedText] = useState(() => takeSeedText());

  // One FieldApi per open editor, over the row's long-lived form. Created
  // imperatively (the documented core usage) because the form was too.
  const [field] = useState<TMDataGridEditField>(
    () =>
      new FieldApi({
        form: form as never,
        name: fieldName as never,
        validators: normalizeFieldValidate(
          column.columnDef.meta?.validate,
        ) as never,
      }) as unknown as TMDataGridEditField,
  );
  useEffect(() => field.mount(), [field]);

  // Type-to-edit: the seed replaces the value, as it does in a spreadsheet.
  // Only for the types where keystrokes are the input.
  useEffect(() => {
    if (seedText === undefined) return;
    const type = column.columnDef.meta?.type ?? "string";
    if (type === "string") {
      field.handleChange(seedText as never);
    } else if (type === "number") {
      const seeded = Number(seedText);
      if (Number.isFinite(seeded)) field.handleChange(seeded as never);
    }
    // Once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closingRef = useRef(false);

  const commitAndClose = async (
    via: "enter" | "tab" | "shift-tab" | "pick",
  ): Promise<boolean> => {
    if (closingRef.current) return false;
    const ok = await edit.commit(row.id);
    if (ok && !closingRef.current) {
      closingRef.current = true;
      onClose({ committed: true, via });
    }
    return ok;
  };

  const cancelAndClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    edit.cancel(row.id);
    onClose({ committed: false, via: "escape" });
  };

  /** Batch: the key closes the editor and leaves the draft for submitAll. */
  const deferAndClose = (via: "defer" | "defer-tab" | "defer-shift-tab") => {
    if (closingRef.current) return;
    closingRef.current = true;
    edit.deactivate();
    onClose({ committed: false, via });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isBatch = features.editMode === "batch";
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      // In row mode Enter (and Ctrl+Enter, the documented pair) saves the
      // row; in batch nothing commits until submitAll, so Enter just parks
      // the draft.
      if (isBatch) deferAndClose("defer");
      else void commitAndClose("enter");
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelAndClose();
    } else if (event.key === "Tab" && !isRowMode) {
      event.preventDefault();
      event.stopPropagation();
      if (isBatch) {
        deferAndClose(event.shiftKey ? "defer-shift-tab" : "defer-tab");
      } else {
        void commitAndClose(event.shiftKey ? "shift-tab" : "tab");
      }
    }
  };

  /**
   * Focus left the editor entirely — a click somewhere else. Under `"cell"`
   * that commits (Sheets); a commit blocked by validation keeps the form and
   * its invalid marker, with the editor closed. The confirming modes keep
   * the draft open-but-inactive, waiting for their explicit ✓.
   */
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (closingRef.current) return;
    // Row mode: the row's other editors are outside this host, and focus
    // moving between them is not leaving the edit. Blur means nothing here;
    // the lane's Save/Cancel and the keys end the edit.
    if (isRowMode) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    closingRef.current = true;
    if (features.editMode === "cell") {
      void edit.commit(row.id).then((ok) => {
        if (!ok) edit.deactivate();
      });
    } else {
      // cellConfirm: the draft stays, dirty-marked, waiting for its ✓.
      edit.deactivate();
    }
  };

  if (form === undefined || fieldName === null) return null;

  const args: TMDataGridEditorArgs = {
    field,
    form,
    cell,
    row,
    column,
    table,
    commit: () => commitAndClose("pick"),
    cancel: cancelAndClose,
    size: controlSize,
    autoFocus,
    seedText,
  };

  const Editor =
    column.columnDef.meta?.editor ??
    BUILT_IN_EDITORS[column.columnDef.meta?.type ?? "string"] ??
    TMDataGridStringEditor;

  return (
    <div
      className={classes.cellEditor}
      data-dg-cell-editor
      data-testid={`dg-editor-${row.id}-${column.id}`}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      // The cell underneath listens for selection gestures; a click inside
      // the editor is about the editor.
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Editor {...args} />
      {/* cellConfirm's chrome: the draft only commits through the ✓ (or
          Enter), so the pair sits right beside the input. */}
      {features.editMode === "cellConfirm" && (
        <div className={classes.cellEditorActions}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="green"
            aria-label={labels.confirmEdit}
            data-testid="dg-editor-confirm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void commitAndClose("pick")}
          >
            <CheckIcon size={14} stroke={2} />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            aria-label={labels.cancelEdit}
            data-testid="dg-editor-cancel"
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancelAndClose}
          >
            <CloseIcon size={14} stroke={2} />
          </ActionIcon>
        </div>
      )}
    </div>
  );
}

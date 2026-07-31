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
  | { committed: false; via: "escape" };

/**
 * The host an editing cell mounts — it owns the field, the keys and the blur
 * policy; the editor inside it (a built-in picked by `meta.type`, or the
 * column's `renderEditor`) owns the input.
 *
 * The form outlives this component by design: scrolling the row away
 * unmounts the host, and the form in the engine's map keeps the draft.
 */
export function TMDataGridCellEditor({
  cell,
  row,
  takeSeedText,
  onClose,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  row: Row<TMDataGridFeatures, TMDataGridRowData>;
  /** Consumes the pending type-to-edit seed, when typing opened this editor. */
  takeSeedText: () => string | undefined;
  /** After the editor closed itself — the table moves the focus. */
  onClose: (args: TMDataGridCellEditorClose) => void;
}) {
  const { table, edit, features, controlSize } = useTMDataGridContext();
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void commitAndClose("enter");
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelAndClose();
    } else if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      void commitAndClose(event.shiftKey ? "shift-tab" : "tab");
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
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    closingRef.current = true;
    if (features.editMode === "cell") {
      void edit.commit(row.id).then((ok) => {
        if (!ok) edit.deactivate();
      });
    } else {
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
    seedText,
  };

  const renderEditor = column.columnDef.meta?.renderEditor;
  const BuiltIn =
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
      {renderEditor ? renderEditor(args) : <BuiltIn {...args} />}
    </div>
  );
}

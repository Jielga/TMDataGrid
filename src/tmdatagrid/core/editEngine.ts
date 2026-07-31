import {
  FormApi,
  getBy,
  type AnyFieldApi,
  type AnyFormApi,
  type StandardSchemaV1,
} from "@tanstack/react-form";
import { Store } from "@tanstack/store";
import type { Cell, Column, Row, RowData } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";
import { isControlColumn } from "./columnUtils";
import type { TMDataGridColumnType } from "./filterOperators";
import type { TMDataGridSize } from "./sizes";

/**
 * How commits happen — one axis, each mode a thin policy over the same
 * engine. See `editMode` on `UseTMDataGridOptions`.
 */
export type TMDataGridEditMode = "cell" | "cellConfirm" | "row" | "batch";

/**
 * One editing row's live form. TanStack Form's `FormApi`, not a wrapper: the
 * engine is a form library, and everything mid-edit — values, dirty state,
 * errors, async validation, submit lifecycle — is form state, read off
 * `form.store` with the same selector idiom as the rest of the grid.
 *
 * The alias erases Form's validator generics the way `TMDataGridRowData`
 * erases the row type: the concrete types lived at the `useTMDataGrid` call.
 */
export type TMDataGridRowEditForm = AnyFormApi;

/** The live field a cell editor binds to — TanStack Form's own `FieldApi`. */
export type TMDataGridEditField = AnyFieldApi;

/**
 * A validator as TanStack Form takes it: a Standard Schema (Zod, Valibot,
 * ArkType…) or a plain function returning an error or nothing. Forwarded
 * untouched — the vocabulary is Form's, not a grid re-implementation.
 */
export type TMDataGridValidator =
  | StandardSchemaV1<unknown, unknown>
  | ((args: { value: never; fieldApi: never }) => unknown);

/**
 * `meta.validate` — per-column field validators. A bare schema or function is
 * shorthand for `{ onChange: it }`; the object form takes every trigger
 * TanStack Form defines, `Async` variants and debounce included.
 */
export type TMDataGridFieldValidate =
  | TMDataGridValidator
  | {
      onMount?: TMDataGridValidator;
      onChange?: TMDataGridValidator;
      onChangeAsync?: TMDataGridValidator;
      onChangeAsyncDebounceMs?: number;
      onBlur?: TMDataGridValidator;
      onBlurAsync?: TMDataGridValidator;
      onSubmit?: TMDataGridValidator;
      onSubmitAsync?: TMDataGridValidator;
    };

/**
 * `rowValidators` — form-level validators for the whole row, where
 * cross-field rules live. Passed into each row form's `validators` untouched;
 * pathed issues land on the matching fields, pathless ones on the row.
 */
export type TMDataGridRowValidators = {
  onMount?: TMDataGridValidator;
  onChange?: TMDataGridValidator;
  onChangeAsync?: TMDataGridValidator;
  onChangeAsyncDebounceMs?: number;
  onBlur?: TMDataGridValidator;
  onBlurAsync?: TMDataGridValidator;
  onSubmit?: TMDataGridValidator;
  onSubmitAsync?: TMDataGridValidator;
  onSubmitAsyncDebounceMs?: number;
};

/** One field's before/after across a commit. */
export type TMDataGridEditChange = {
  /** Column the field maps back to, for consumers thinking in columns. */
  columnId: string;
  /** The data path — `getEditFieldName` of the column. */
  field: string;
  previous: unknown;
  next: unknown;
};

export type TMDataGridEditCommitArgs<TData extends RowData> = {
  rowId: string;
  /** The whole row as edited — for the consumer who saves records. */
  value: TData;
  /** The row as it was when editing began. */
  original: TData;
  /** Per-field diff — for the consumer who PATCHes. One entry in cell mode. */
  changes: Array<TMDataGridEditChange>;
  /** Which policy committed. */
  source: TMDataGridEditMode;
};

/** What one open row's form looks like from outside — the cell markers. */
export type TMDataGridEditRowProjection = {
  /** Field names whose value differs from the original. */
  dirtyFields: ReadonlyArray<string>;
  /** Field names carrying a validation error. */
  errorFields: ReadonlyArray<string>;
  /** A row-level error — a pathless `.refine()`, or a rejected commit. */
  hasRowError: boolean;
  isSubmitting: boolean;
};

/**
 * The grid-facing index of everything mid-edit. A projection synced from the
 * open forms' stores, so body cells subscribe to this one store for their
 * dirty/error markers instead of one store per form. Only the editor host
 * reads a form's store directly — it is mounted for one cell at a time.
 */
export type TMDataGridEditState = {
  /** The cell whose editor is open; `columnId: null` is a whole row (row mode). */
  active: { rowId: string; columnId: string | null } | null;
  /** Rows with a live form. In cell mode at most one; in batch, many. */
  openRowIds: ReadonlyArray<string>;
  rows: Record<string, TMDataGridEditRowProjection>;
  /** Phase 4 — rows being created, not yet in `data`. */
  newRows: ReadonlyArray<{ tempId: string }>;
  /** Phase 4 — rows marked deleted under batch mode. */
  deletedRowIds: ReadonlyArray<string>;
};

const EMPTY_EDIT_STATE: TMDataGridEditState = {
  active: null,
  openRowIds: [],
  rows: {},
  newRows: [],
  deletedRowIds: [],
};

type ErasedRow = Row<TMDataGridFeatures, TMDataGridRowData>;
type ErasedColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;

/**
 * What a cell editor is handed — deliberately both vocabularies at once. The
 * form side is TanStack Form's real `field` API (`field.state.value`,
 * `field.state.meta.errors`, `field.handleChange`, `field.handleBlur`), so a
 * custom calendar, slider or async combobox binds to it exactly as it would
 * inside any TanStack Form. The table side is where the editor is standing.
 *
 * The built-ins are implemented against this same contract, so
 * `meta.renderEditor` is not a special case — it is the slot the defaults
 * fill, and the exported built-ins can be wrapped instead of replaced.
 */
export type TMDataGridEditorArgs = {
  /** The live TanStack Form field for this cell. */
  field: TMDataGridEditField;
  /** The whole row form, for the rare editor that reads sibling fields. */
  form: TMDataGridRowEditForm;
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  row: ErasedRow;
  column: ErasedColumn;
  table: TMDataGridTable<TMDataGridRowData>;
  /** What Enter would do — commit the edit. For the editor's own UI. */
  commit: () => Promise<boolean>;
  /** What Escape would do — drop the draft. */
  cancel: () => void;
  size: TMDataGridSize;
  /**
   * Whether this editor should take the focus on mount. True for a single
   * opened cell; in row mode only the row's first editable cell gets it.
   */
  autoFocus: boolean;
  /**
   * Set when typing opened the editor (the Sheets gesture) — the built-ins
   * replace the value with it and keep typing. A custom editor may ignore it.
   */
  seedText?: string;
};

/** `meta.renderEditor` — replaces the built-in editor for this column. */
export type TMDataGridEditorRenderer = (
  args: TMDataGridEditorArgs,
) => ReactNode;

/** What the engine reads fresh on every call — see `createEditEngine`. */
export type TMDataGridEditEngineContext = {
  table: TMDataGridTable<TMDataGridRowData>;
  editMode: TMDataGridEditMode;
  rowValidators?: TMDataGridRowValidators;
  isRowEditable?: (row: ErasedRow) => boolean;
  onEditCommit?: (
    args: TMDataGridEditCommitArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
};

/**
 * The data path a column edits, or `null` for a column that has none.
 *
 * `accessorKey` is the true path and Form addresses fields by dot-path, so
 * nested rows work for free: `accessorKey: "address.city"` edits
 * `values.address.city`. A column built on `accessorFn` has no path and is
 * not editable unless `meta.editField` names one. TanStack's default column
 * id turns dots into underscores — which is why this starts from
 * `accessorKey`, never from `id`.
 */
export function getEditFieldName(column: {
  columnDef: { meta?: { editField?: string } };
}): string | null {
  const fromMeta = column.columnDef.meta?.editField;
  if (fromMeta) return fromMeta;
  const accessorKey = (column.columnDef as Record<string, unknown>)[
    "accessorKey"
  ];
  return typeof accessorKey === "string" ? accessorKey : null;
}

/** What Delete writes into a cell — the type's honest empty value. */
export function clearedValueForType(type: TMDataGridColumnType): unknown {
  switch (type) {
    case "string":
      return "";
    case "multiSelect":
      return [];
    case "boolean":
      return false;
    default:
      return null;
  }
}

/**
 * The engine plus its store — `api.edit`.
 *
 * "One row, one form": `getForm` hands out the same `FormApi` the inline
 * editors write through, so a consumer can render it in a drawer or a detail
 * panel and share values, dirty state and errors with the cells.
 */
export type TMDataGridEditApi = {
  /** The projection store — subscribe with `useSelector(edit.store, …)`. */
  store: Store<TMDataGridEditState>;
  /** Current snapshot, for reads outside React. */
  readonly state: TMDataGridEditState;
  /** rowId → live form. The source of truth for everything mid-edit. */
  getForm: (rowId: string) => TMDataGridRowEditForm | undefined;
  /**
   * Whether this cell may open an editor: the column maps to a field, nothing
   * switched it off, and the row takes edits at all.
   */
  canEditCell: (row: ErasedRow, column: ErasedColumn) => boolean;
  /** Whether the row takes edits at all — the edit lane's pencil gate. */
  canEditRow: (row: ErasedRow) => boolean;
  /** Opens an editor. `columnId: null` opens the whole row (row mode). */
  begin: (target: { rowId: string; columnId: string | null }) => void;
  /**
   * Commits one row — `form.handleSubmit` under the hood. Resolves `true`
   * when the form is gone: validation passed and `onEditCommit` resolved, or
   * there was nothing to save. `false` keeps the form open with its errors.
   */
  commit: (rowId: string) => Promise<boolean>;
  /** Drops one row's draft. */
  cancel: (rowId: string) => void;
  /**
   * Closes the editor without touching the draft — what blur does under
   * `"cellConfirm"`, where the dirty cell keeps waiting for its ✓.
   */
  deactivate: () => void;
  /** Drops every draft. */
  cancelAll: () => void;
  /** Commits every open row — batch mode's save. `true` when all landed. */
  submitAll: () => Promise<boolean>;
  /** Writes the type's empty value into a cell and commits it — Delete. */
  clearCell: (rowId: string, columnId: string) => Promise<boolean>;
};

function clearFormSourcedFieldErrors(form: TMDataGridRowEditForm): void {
  const fieldMeta = form.state.fieldMeta as Record<
    string,
    { errorSourceMap?: Record<string, unknown> }
  >;
  for (const [name, meta] of Object.entries(fieldMeta)) {
    const staleKeys = Object.entries(meta.errorSourceMap ?? {})
      .filter(([, source]) => source === "form")
      .map(([key]) => key);
    if (staleKeys.length === 0) continue;
    form.setFieldMeta(name as never, (previous) => ({
      ...previous,
      errorMap: {
        ...previous.errorMap,
        ...Object.fromEntries(staleKeys.map((key) => [key, undefined])),
      },
    }));
  }
}

/** Arrays compare by element so a multiSelect edit-back-to-same is clean. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, i) => Object.is(entry, b[i]));
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return false;
}

function hasAnyError(errors: ReadonlyArray<unknown>): boolean {
  return errors.some((error) => error !== undefined && error !== null);
}

/**
 * Builds the edit engine. A factory over React so it is headless-testable;
 * `getContext` is read fresh on every call, which is how the engine always
 * sees the latest table, mode and consumer callbacks without being rebuilt.
 *
 * Virtualization, per the plan: nothing here is DOM. A form is a plain object
 * in a map keyed by rowId — scroll its row away and the editor unmounts, the
 * form keeps its values, meta and errors; scroll back and the editor
 * re-mounts over the same form.
 */
export function createEditEngine(
  getContext: () => TMDataGridEditEngineContext,
): TMDataGridEditApi {
  const store = new Store<TMDataGridEditState>(EMPTY_EDIT_STATE);

  type FormEntry = {
    form: TMDataGridRowEditForm;
    original: TMDataGridRowData;
    /** Set by the wrapped onSubmit when the consumer's commit resolved. */
    lastSubmitOk: boolean;
    /** A commit already running — Enter and blur race on the same edit. */
    pendingCommit: Promise<boolean> | null;
    unsubscribe: () => void;
    unmount: () => void;
  };
  const forms = new Map<string, FormEntry>();

  const editableColumns = (): Array<ErasedColumn> =>
    getContext()
      .table.getAllLeafColumns()
      .filter(
        (column) =>
          !isControlColumn(column.id) &&
          column.columnDef.meta?.editable !== false &&
          getEditFieldName(column) !== null,
      );

  const diff = (
    entry: FormEntry,
    values: TMDataGridRowData,
  ): Array<TMDataGridEditChange> => {
    const changes: Array<TMDataGridEditChange> = [];
    for (const column of editableColumns()) {
      const field = getEditFieldName(column);
      if (field === null) continue;
      const previous: unknown = getBy(entry.original, field);
      const next: unknown = getBy(values, field);
      if (!sameValue(previous, next)) {
        changes.push({ columnId: column.id, field, previous, next });
      }
    }
    return changes;
  };

  const project = (entry: FormEntry): TMDataGridEditRowProjection => {
    const state = entry.form.state;
    const errorFields = Object.entries(state.fieldMeta)
      .filter(
        ([name, meta]) =>
          // The empty path is a pathless (row-level) issue's landing spot —
          // it belongs to `hasRowError`, not to any cell's marker.
          name !== "" &&
          hasAnyError((meta as { errors: ReadonlyArray<unknown> }).errors),
      )
      .map(([name]) => name);
    return {
      dirtyFields: diff(entry, state.values as TMDataGridRowData).map(
        (change) => change.field,
      ),
      errorFields,
      hasRowError: hasAnyError(state.errors),
      isSubmitting: state.isSubmitting,
    };
  };

  const publishRow = (rowId: string) => {
    const entry = forms.get(rowId);
    store.setState((prev) => {
      const rows = { ...prev.rows };
      if (entry === undefined) delete rows[rowId];
      else rows[rowId] = project(entry);
      return { ...prev, rows, openRowIds: [...forms.keys()] };
    });
  };

  const setActive = (active: TMDataGridEditState["active"]) => {
    store.setState((prev) => ({ ...prev, active }));
  };

  const drop = (rowId: string) => {
    const entry = forms.get(rowId);
    if (entry === undefined) return;
    entry.unsubscribe();
    entry.unmount();
    forms.delete(rowId);
    store.setState((prev) => {
      const rows = { ...prev.rows };
      delete rows[rowId];
      return {
        ...prev,
        rows,
        openRowIds: [...forms.keys()],
        active: prev.active?.rowId === rowId ? null : prev.active,
      };
    });
  };

  const createForm = (rowId: string, row: ErasedRow): FormEntry => {
    const context = getContext();
    const original = row.original;
    const entry: FormEntry = {
      original,
      lastSubmitOk: false,
      pendingCommit: null,
      unsubscribe: () => {},
      unmount: () => {},
      form: new FormApi({
        defaultValues: original,
        // The consumer's vocabulary is Form's own; the cast erases the
        // validator generics the same way the row type is erased.
        validators: context.rowValidators as never,
        onSubmit: async ({ value }) => {
          const changes = diff(entry, value as TMDataGridRowData);
          try {
            await getContext().onEditCommit?.({
              rowId,
              value: value as TMDataGridRowData,
              original,
              changes,
              source: getContext().editMode,
            });
            entry.lastSubmitOk = true;
          } catch (error) {
            // A rejected save keeps the form open, the message on the row.
            entry.form.setErrorMap({
              onSubmit:
                error instanceof Error ? error.message : String(error),
            } as never);
          }
        },
      }) as TMDataGridRowEditForm,
    };
    entry.unmount = entry.form.mount();
    const subscription = entry.form.store.subscribe(() => publishRow(rowId));
    entry.unsubscribe = () => subscription.unsubscribe();
    forms.set(rowId, entry);
    publishRow(rowId);
    return entry;
  };

  const canEditRow = (row: ErasedRow): boolean => {
    if (row.getIsGrouped()) return false;
    return getContext().isRowEditable?.(row) !== false;
  };

  const canEditCell = (row: ErasedRow, column: ErasedColumn): boolean => {
    const context = getContext();
    if (row.getIsGrouped()) return false;
    if (isControlColumn(column.id)) return false;
    if (getEditFieldName(column) === null) return false;
    const editable = column.columnDef.meta?.editable;
    if (editable === false) return false;
    if (typeof editable === "function" && !editable(row)) return false;
    if (context.isRowEditable !== undefined && !context.isRowEditable(row)) {
      return false;
    }
    return true;
  };

  const getRow = (rowId: string): ErasedRow | undefined => {
    try {
      return getContext().table.getRow(rowId);
    } catch {
      // TanStack throws for an id that is not in the current row model.
      return undefined;
    }
  };

  const commit = async (rowId: string): Promise<boolean> => {
    const entry = forms.get(rowId);
    if (entry === undefined) return true;
    // Enter and blur race on the same edit; the second caller joins the
    // first's commit instead of submitting the row twice.
    if (entry.pendingCommit !== null) return entry.pendingCommit;
    // A pristine form has nothing to say — drop it without a consumer call.
    if (diff(entry, entry.form.state.values as TMDataGridRowData).length === 0) {
      drop(rowId);
      return true;
    }
    // Field errors the *form's* validator planted are cleared before the
    // submit re-runs it: a field with no mounted editor is never revalidated
    // by Form itself, so a pathed issue would otherwise outlive its fix and
    // block `canSubmit` forever. The validator puts back whatever still holds.
    clearFormSourcedFieldErrors(entry.form);
    entry.lastSubmitOk = false;
    entry.pendingCommit = (async () => {
      try {
        await entry.form.handleSubmit();
      } finally {
        entry.pendingCommit = null;
      }
      if (!entry.lastSubmitOk) return false;
      drop(rowId);
      return true;
    })();
    return entry.pendingCommit;
  };

  const beginOn = (rowId: string, columnId: string | null) => {
    const row = getRow(rowId);
    if (row === undefined) return;
    if (columnId !== null) {
      const column = getContext().table.getColumn(columnId);
      if (column === undefined || !canEditCell(row, column)) return;
    } else if (getContext().isRowEditable?.(row) === false) {
      return;
    }
    if (!forms.has(rowId)) createForm(rowId, row);
    setActive({ rowId, columnId });
  };

  const begin: TMDataGridEditApi["begin"] = ({ rowId, columnId }) => {
    const { editMode } = getContext();
    const openElsewhere = [...forms.keys()].find((id) => id !== rowId);
    // Each mode's policy about the row being left:
    //
    // | Mode | Another row open |
    // | ---- | ---------------- |
    // | cell | committed — Sheets; a failed commit keeps holding the edit |
    // | row  | dropped if pristine, otherwise the pencil is refused — a
    //          row edit saves explicitly, so leaving must not save quietly |
    // | cellConfirm, batch | accumulates; every draft waits for its ✓ |
    if (openElsewhere !== undefined) {
      if (editMode === "cell") {
        void commit(openElsewhere).then((ok) => {
          if (ok) beginOn(rowId, columnId);
        });
        return;
      }
      if (editMode === "row") {
        const entry = forms.get(openElsewhere);
        const pristine =
          entry !== undefined &&
          diff(entry, entry.form.state.values as TMDataGridRowData).length === 0;
        if (!pristine) return;
        drop(openElsewhere);
      }
    }
    beginOn(rowId, columnId);
  };

  const cancel = (rowId: string) => {
    drop(rowId);
  };

  const deactivate = () => {
    setActive(null);
  };

  const cancelAll = () => {
    for (const rowId of [...forms.keys()]) drop(rowId);
    setActive(null);
  };

  const submitAll = async (): Promise<boolean> => {
    const results = await Promise.all(
      [...forms.keys()].map((rowId) => commit(rowId)),
    );
    return results.every(Boolean);
  };

  const clearCell = async (
    rowId: string,
    columnId: string,
  ): Promise<boolean> => {
    const context = getContext();
    const row = getRow(rowId);
    const column = context.table.getColumn(columnId);
    if (row === undefined || column === undefined) return false;
    if (!canEditCell(row, column)) return false;
    const field = getEditFieldName(column);
    if (field === null) return false;
    const entry = forms.get(rowId) ?? createForm(rowId, row);
    entry.form.setFieldValue(
      field as never,
      clearedValueForType(column.columnDef.meta?.type ?? "string") as never,
    );
    return commit(rowId);
  };

  return {
    store,
    get state() {
      return store.state;
    },
    getForm: (rowId) => forms.get(rowId)?.form,
    canEditCell,
    canEditRow,
    begin,
    commit,
    cancel,
    deactivate,
    cancelAll,
    submitAll,
    clearCell,
  };
}

/**
 * `meta.validate` normalised to the object TanStack Form's `validators`
 * option takes — a bare schema or function is shorthand for `{ onChange }`.
 */
export function normalizeFieldValidate(
  validate: TMDataGridFieldValidate | undefined,
): Record<string, unknown> | undefined {
  if (validate === undefined) return undefined;
  if (typeof validate === "function" || "~standard" in validate) {
    return { onChange: validate };
  }
  return validate as Record<string, unknown>;
}

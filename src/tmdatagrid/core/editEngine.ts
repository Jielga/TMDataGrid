import {
  FormApi,
  getBy,
  type AnyFieldApi,
  type AnyFormApi,
  type StandardSchemaV1,
} from "@tanstack/react-form";
import { Store } from "@tanstack/store";
import type { Cell, Column, Row, RowData } from "@tanstack/react-table";
import type { ComponentType } from "react";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";
import {
  isColumnEditableForRow,
  isColumnEditSwitchedOff,
  isControlColumn,
} from "./columnUtils";
import type { TMDataGridColumnType } from "./filterOperators";
import type { TMDataGridSize } from "./sizes";

/**
 * How commits happen - one axis, each mode a thin policy over the same
 * engine. See `editMode` on `UseTMDataGridOptions`.
 */
export type TMDataGridEditMode = "cell" | "cellConfirm" | "row" | "draft";

/**
 * One editing row's live form. TanStack Form's `FormApi`, not a wrapper: the
 * engine is a form library, and everything mid-edit - values, dirty state,
 * errors, async validation, submit lifecycle - is form state, read off
 * `form.store` with the same selector idiom as the rest of the grid.
 *
 * The alias erases Form's validator generics the way `TMDataGridRowData`
 * erases the row type: the concrete types lived at the `useTMDataGrid` call.
 */
export type TMDataGridRowEditForm = AnyFormApi;

/** The live field a cell editor binds to - TanStack Form's own `FieldApi`. */
export type TMDataGridEditField = AnyFieldApi;

/**
 * A validator as TanStack Form takes it: a Standard Schema (Zod, Valibot,
 * ArkType…) or a plain function returning an error or nothing. Forwarded
 * untouched - the vocabulary is Form's, not a grid re-implementation.
 */
export type TMDataGridValidator =
  | StandardSchemaV1<unknown, unknown>
  | ((args: { value: never; fieldApi: never }) => unknown);

/**
 * `meta.edit.validate` - per-column field validators. A bare schema or function is
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
 * `rowValidators` - form-level validators for the whole row, where
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
  /** The data path - `getEditFieldName` of the column. */
  field: string;
  previous: unknown;
  next: unknown;
};

export type TMDataGridEditCommitArgs<TData extends RowData> = {
  rowId: string;
  /** The whole row as edited - for the consumer who saves records. */
  value: TData;
  /** The row as it was when editing began. */
  original: TData;
  /** Per-field diff - for the consumer who PATCHes. One entry in cell mode. */
  changes: Array<TMDataGridEditChange>;
  /** Which policy committed. */
  source: TMDataGridEditMode;
};

/** What one open row's form looks like from outside - the cell markers. */
export type TMDataGridEditRowProjection = {
  /** Field names whose value differs from the original. */
  dirtyFields: ReadonlyArray<string>;
  /** Field names carrying a validation error. */
  errorFields: ReadonlyArray<string>;
  /** A row-level error - a pathless `.refine()`, or a rejected commit. */
  hasRowError: boolean;
  isSubmitting: boolean;
  /**
   * The row as drafted - the form's `state.values`. Reference-stable while no
   * value changes, so a cell may subscribe to it and repaint only when its
   * row's draft actually moves.
   */
  values: TMDataGridRowData;
};

/**
 * The grid-facing index of everything mid-edit. A projection synced from the
 * open forms' stores, so body cells subscribe to this one store for their
 * dirty/error markers instead of one store per form. Only the editor host
 * reads a form's store directly - it is mounted for one cell at a time.
 */
export type TMDataGridEditState = {
  /**
   * The cell the last open gesture named - where the caret goes. In row mode
   * the whole row is editing whatever this says, so there it is only the
   * caret's cell, and `null` for the lane's pencil, which names no column.
   */
  active: { rowId: string; columnId: string | null } | null;
  /**
   * Rows with a live form. In cell mode at most one; in row, cellConfirm and
   * draft, as many as the user opened - which rows are editing.
   */
  openRowIds: ReadonlyArray<string>;
  rows: Record<string, TMDataGridEditRowProjection>;
  /**
   * Rows being created, not yet in `data`. `confirmed` is draft mode's
   * "entered, awaiting Save all": the entry row renders as a value row until
   * `begin` re-opens it. Under the immediate modes a confirm commits through
   * `onRowAdd` and the entry is dropped, so there it never turns `true`.
   */
  newRows: ReadonlyArray<{ tempId: string; confirmed: boolean }>;
  /** Rows marked deleted under draft mode. */
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
 * What a cell editor is handed - deliberately both vocabularies at once. The
 * form side is TanStack Form's real `field` API (`field.state.value`,
 * `field.state.meta.errors`, `field.handleChange`, `field.handleBlur`), so a
 * custom calendar, slider or async combobox binds to it exactly as it would
 * inside any TanStack Form. The table side is where the editor is standing.
 *
 * The built-ins are implemented against this same contract, so
 * `meta.edit.editor` is not a special case - it is the slot the defaults
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
  /** What Enter would do - commit the edit. For the editor's own UI. */
  commit: () => Promise<boolean>;
  /** What Escape would do - drop the draft. */
  cancel: () => void;
  size: TMDataGridSize;
  /**
   * Set when typing opened the editor (the Sheets gesture) - the built-ins
   * replace the value with it and keep typing. A custom editor may ignore it.
   */
  seedText?: string;
};

/**
 * `meta.edit.editor` - replaces the built-in editor for this column. Rendered
 * as JSX, never invoked as a bare function, so hooks are legal inside. Define
 * it at module scope: a new identity per render remounts the editor mid-edit.
 */
export type TMDataGridEditorComponent = ComponentType<TMDataGridEditorArgs>;

/** What `meta.edit.mapValue` is handed for one write. */
export type TMDataGridEditValueMapArgs = {
  /** The value the editor just wrote. */
  value: unknown;
  /** What the field held before this write - for length-aware masks. */
  previous: unknown;
  row: ErasedRow;
  column: ErasedColumn;
  table: TMDataGridTable<TMDataGridRowData>;
};

/**
 * `meta.edit.mapValue` - the value on its way into the draft, mapped.
 *
 * Runs on every write an editor makes, which for a text input is every
 * keystroke and for a select is every pick, so the mapped value is what the
 * user sees, what validators judge and what commits.
 */
export type TMDataGridEditValueMap = (
  args: TMDataGridEditValueMapArgs,
) => unknown;

/**
 * `meta.edit` - everything about how this column is edited, in one place,
 * mirroring the `edit.*` engine the grid exposes at runtime.
 *
 * ```tsx
 * meta: {
 *   type: "string",
 *   edit: {
 *     enabled: (row) => row.original.status !== "Locked",
 *     validate: z.string().min(2, "Too short"),
 *     mapValue: ({ value }) =>
 *       typeof value === "string" ? value.toUpperCase() : value,
 *   },
 * }
 * ```
 *
 * `meta.type` and `meta.options` stay outside this namespace on purpose: one
 * declaration of each feeds the cell editor and the filter panel alike.
 */
export type TMDataGridColumnEditOptions = {
  /**
   * Whether this column's cells take edits, once `editMode` is on. `false`
   * switches the column off outright; a predicate decides per row. Defaults
   * to editable for any column that maps to a field - see {@link field}.
   */
  enabled?:
    | boolean
    | ((row: Row<TMDataGridFeatures, TMDataGridRowData>) => boolean);
  /**
   * The data path this column edits, when it is not the `accessorKey` - the
   * only way a column built on `accessorFn` becomes editable. Dot paths reach
   * into nested records: `"address.city"`.
   */
  field?: string;
  /**
   * Replaces the built-in editor for this column. See
   * {@link TMDataGridEditorComponent}.
   */
  editor?: TMDataGridEditorComponent;
  /**
   * Field-level validators, in TanStack Form's own vocabulary. A bare Zod
   * schema (or any Standard Schema, or a plain function) means
   * `{ onChange: it }`; the object form takes every trigger Form defines.
   */
  validate?: TMDataGridFieldValidate;
  /**
   * Maps every value an editor writes before it reaches the draft - uppercase
   * a code, strip spaces from an IBAN, clamp a number into range. See
   * {@link TMDataGridEditValueMap}.
   */
  mapValue?: TMDataGridEditValueMap;
};

/** A new row being committed - `onRowAdd`, and `submitAll`'s `added`. */
export type TMDataGridRowAddArgs<TData extends RowData> = {
  /** The engine's placeholder id; the real id is the consumer's to mint. */
  tempId: string;
  value: TData;
};

/** A deletion - `onRowDelete`. */
export type TMDataGridRowDeleteArgs<TData extends RowData> = {
  rowId: string;
  row: Row<TMDataGridFeatures, TData>;
};

/** What `submitAll` hands `onEditCommitDrafts` - everything pending at once. */
export type TMDataGridEditCommitDraftsArgs<TData extends RowData> = {
  /** Every valid dirty existing row. */
  rows: Array<TMDataGridEditCommitArgs<TData>>;
  /** Every valid new row from the entry block. */
  added: Array<TMDataGridRowAddArgs<TData>>;
  /** Ids marked deleted while the drafts accumulated. */
  deleted: Array<string>;
};

/** What the engine reads fresh on every call - see `createEditEngine`. */
export type TMDataGridEditEngineContext = {
  table: TMDataGridTable<TMDataGridRowData>;
  editMode: TMDataGridEditMode;
  rowValidators?: TMDataGridRowValidators;
  isRowEditable?: (row: ErasedRow) => boolean;
  onEditCommit?: (
    args: TMDataGridEditCommitArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
  onEditCommitDrafts?: (
    args: TMDataGridEditCommitDraftsArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
  /**
   * Seed values for `addRow`, under the values it is called with. A function
   * is called per added row.
   */
  newRowDefaults?: TMDataGridRowData | (() => TMDataGridRowData);
  onRowAdd?: (
    args: TMDataGridRowAddArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
  onRowDelete?: (
    args: TMDataGridRowDeleteArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
};

/**
 * The data path a column edits, or `null` for a column that has none.
 *
 * `accessorKey` is the true path and Form addresses fields by dot-path, so
 * nested rows need no extra handling: `accessorKey: "address.city"` edits
 * `values.address.city`. A column built on `accessorFn` has no path and is not
 * editable unless `meta.edit.field` names one. TanStack's default column id
 * turns dots into underscores, which is why this starts from `accessorKey` and
 * never from `id`.
 */
export function getEditFieldName(column: {
  columnDef: { meta?: { edit?: { field?: string } } };
}): string | null {
  const fromMeta = column.columnDef.meta?.edit?.field;
  if (fromMeta) return fromMeta;
  const accessorKey = (column.columnDef as Record<string, unknown>)[
    "accessorKey"
  ];
  return typeof accessorKey === "string" ? accessorKey : null;
}

/** What Delete writes into a cell - the type's honest empty value. */
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
 * The engine plus its store - `api.edit`.
 *
 * "One row, one form": `getForm` hands out the same `FormApi` the inline
 * editors write through, so a consumer can render it in a drawer or a detail
 * panel and share values, dirty state and errors with the cells.
 */
export type TMDataGridEditApi<
  TData extends RowData = TMDataGridRowData,
> = {
  /** The projection store - subscribe with `useSelector(edit.store, …)`. */
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
  /** Whether the row takes edits at all - the edit lane's pencil gate. */
  canEditRow: (row: ErasedRow) => boolean;
  /**
   * Opens an editor. In row mode the whole row opens either way and `columnId`
   * only says which cell takes the caret; `null` (the lane's pencil) leaves it
   * to the row's first editable cell.
   */
  begin: (target: { rowId: string; columnId: string | null }) => void;
  /**
   * Commits one row - `form.handleSubmit` under the hood. Resolves `true`
   * when the form is gone: validation passed and `onEditCommit` resolved, or
   * there was nothing to save. `false` keeps the form open with its errors.
   */
  commit: (rowId: string) => Promise<boolean>;
  /** Drops one row's draft. */
  cancel: (rowId: string) => void;
  /**
   * Closes the editor without touching the draft - what blur does under
   * `"cellConfirm"`, where the dirty cell keeps waiting for its ✓.
   */
  deactivate: () => void;
  /** Drops every draft. */
  cancelAll: () => void;
  /** Commits every open row - draft mode's save. `true` when all landed. */
  submitAll: () => Promise<boolean>;
  /** Writes the type's empty value into a cell and commits it - Delete. */
  clearCell: (rowId: string, columnId: string) => Promise<boolean>;
  /**
   * Opens a new entry row (the sticky block under the header) seeded from
   * `newRowDefaults`. `values` overrides that seed key by key, so
   * `addRow()` opens a blank row and `addRow({ status: "draft" })` opens one
   * that starts filled in. Returns its temporary id - a form with no backing
   * row yet. Committing it calls `onRowAdd` (immediate modes) or joins
   * `submitAll`'s `added` (draft).
   */
  addRow: (values?: Partial<TData>) => string;
  /**
   * Deletes a row: `onRowDelete` straight away under the immediate modes;
   * under draft it toggles the id in `deletedRowIds` - the row renders
   * struck through until `submitAll` reports it. On an uncommitted entry
   * row it just discards the entry.
   */
  deleteRow: (rowId: string) => void;
  /** Whether delete chrome makes sense - the lane's trash gate. */
  canDeleteRows: () => boolean;
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
 * in a map keyed by rowId - scroll its row away and the editor unmounts, the
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
    /** An entry-block row - a form with no backing row yet. */
    isNew: boolean;
    /** Set by the wrapped onSubmit when the consumer's commit resolved. */
    lastSubmitOk: boolean;
    /**
     * Draft mode's park: this submit validates and holds the draft in the
     * grid instead of calling the consumer. Set by `commit` per attempt -
     * `true` only under draft outside `submitAll`, which is what closes the
     * per-row escape hatches (the lane's ✓, Delete-to-clear) at the engine.
     */
    parkOnly: boolean;
    /** A commit already running - Enter and blur race on the same edit. */
    pendingCommit: Promise<boolean> | null;
    unsubscribe: () => void;
    unmount: () => void;
  };
  const forms = new Map<string, FormEntry>();
  let newRowCounter = 0;
  /** Lets `commit` tell `submitAll`'s per-row loop apart from a lone call. */
  let submitAllRunning = false;

  /**
   * While `submitAll` runs with an `onEditCommitDrafts`, each row's wrapped
   * onSubmit contributes its args here instead of calling `onEditCommit` -
   * validation stays per row (Form's), the consumer call becomes one.
   */
  let draftCollector: Array<TMDataGridEditCommitArgs<TMDataGridRowData>> | null =
    null;
  let draftAddCollector: Array<TMDataGridRowAddArgs<TMDataGridRowData>> | null =
    null;

  const editableColumns = (): Array<ErasedColumn> =>
    getContext()
      .table.getAllLeafColumns()
      .filter(
        (column) =>
          !isControlColumn(column.id) &&
          !isColumnEditSwitchedOff(column) &&
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
          // The empty path is a pathless (row-level) issue's landing spot -
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
      values: state.values as TMDataGridRowData,
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

  const setNewRowConfirmed = (tempId: string, confirmed: boolean) => {
    store.setState((prev) => {
      const target = prev.newRows.find((newRow) => newRow.tempId === tempId);
      if (target === undefined || target.confirmed === confirmed) return prev;
      return {
        ...prev,
        newRows: prev.newRows.map((newRow) =>
          newRow.tempId === tempId ? { ...newRow, confirmed } : newRow,
        ),
      };
    });
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
        newRows: entry.isNew
          ? prev.newRows.filter((newRow) => newRow.tempId !== rowId)
          : prev.newRows,
        active: prev.active?.rowId === rowId ? null : prev.active,
      };
    });
  };

  const createForm = (
    rowId: string,
    original: TMDataGridRowData,
    isNew: boolean,
  ): FormEntry => {
    const context = getContext();
    const entry: FormEntry = {
      original,
      isNew,
      lastSubmitOk: false,
      parkOnly: false,
      pendingCommit: null,
      unsubscribe: () => {},
      unmount: () => {},
      form: new FormApi({
        defaultValues: original,
        // The consumer's vocabulary is Form's own; the cast erases the
        // validator generics the same way the row type is erased.
        validators: context.rowValidators as never,
        onSubmit: async ({ value }) => {
          // A new row commits whole: it is an add, not a diff against
          // anything that exists.
          if (entry.isNew) {
            const addArgs: TMDataGridRowAddArgs<TMDataGridRowData> = {
              tempId: rowId,
              value: value as TMDataGridRowData,
            };
            if (draftAddCollector !== null) {
              draftAddCollector.push(addArgs);
              entry.lastSubmitOk = true;
              return;
            }
            // Parked: validated and held for Save all - no consumer call.
            if (entry.parkOnly) {
              entry.lastSubmitOk = true;
              return;
            }
            try {
              await getContext().onRowAdd?.(addArgs);
              entry.lastSubmitOk = true;
            } catch (error) {
              entry.form.setErrorMap({
                onSubmit:
                  error instanceof Error ? error.message : String(error),
              } as never);
            }
            return;
          }
          const changes = diff(entry, value as TMDataGridRowData);
          const args: TMDataGridEditCommitArgs<TMDataGridRowData> = {
            rowId,
            value: value as TMDataGridRowData,
            original,
            changes,
            source: getContext().editMode,
          };
          if (draftCollector !== null) {
            draftCollector.push(args);
            entry.lastSubmitOk = true;
            return;
          }
          // Parked: validated and held for Save all - no consumer call.
          if (entry.parkOnly) {
            entry.lastSubmitOk = true;
            return;
          }
          try {
            await getContext().onEditCommit?.(args);
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
    if (!isColumnEditableForRow(column, row)) return false;
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
    // A pristine form has nothing to say - drop it without a consumer call.
    // Not for a new row: adding an untouched entry is still an add.
    if (
      !entry.isNew &&
      diff(entry, entry.form.state.values as TMDataGridRowData).length === 0
    ) {
      drop(rowId);
      return true;
    }
    // Field errors the *form's* validator planted are cleared before the
    // submit re-runs it: a field with no mounted editor is never revalidated
    // by Form itself, so a pathed issue would otherwise outlive its fix and
    // block `canSubmit` forever. The validator puts back whatever still holds.
    clearFormSourcedFieldErrors(entry.form);
    entry.lastSubmitOk = false;
    entry.parkOnly = getContext().editMode === "draft" && !submitAllRunning;
    entry.pendingCommit = (async () => {
      try {
        await entry.form.handleSubmit();
      } finally {
        entry.pendingCommit = null;
      }
      if (!entry.lastSubmitOk) return false;
      if (entry.parkOnly) {
        // The draft stays in the grid until Save all. An entry row becomes
        // "entered": rendered as a value row until `begin` re-opens it.
        if (entry.isNew) setNewRowConfirmed(rowId, true);
        store.setState((prev) =>
          prev.active?.rowId === rowId ? { ...prev, active: null } : prev,
        );
        return true;
      }
      drop(rowId);
      return true;
    })();
    return entry.pendingCommit;
  };

  const beginOn = (rowId: string, columnId: string | null) => {
    // An entry row has no backing row in the table; opening one re-arms its
    // editors - under draft, that is how a confirmed row is edited again.
    const entryForm = forms.get(rowId);
    if (entryForm?.isNew === true) {
      setNewRowConfirmed(rowId, false);
      setActive({ rowId, columnId });
      return;
    }
    const row = getRow(rowId);
    if (row === undefined) return;
    if (columnId !== null) {
      const column = getContext().table.getColumn(columnId);
      if (column === undefined || !canEditCell(row, column)) return;
    } else if (getContext().isRowEditable?.(row) === false) {
      return;
    }
    if (!forms.has(rowId)) createForm(rowId, row.original, false);
    setActive({ rowId, columnId });
  };

  const begin: TMDataGridEditApi["begin"] = ({ rowId, columnId }) => {
    const { editMode } = getContext();
    // Each mode's policy about a row already open elsewhere:
    //
    // | Mode | Another row open |
    // | ---- | ---------------- |
    // | cell | committed - Sheets; a failed commit keeps holding the edit |
    // | row, cellConfirm, draft | accumulates. Every draft waits for its own
    //   save, so a second row opening can neither discard the first nor be
    //   refused by it - nothing about one row's form bears on another's |
    if (editMode === "cell") {
      const openElsewhere = [...forms.keys()].find((id) => id !== rowId);
      if (openElsewhere !== undefined) {
        void commit(openElsewhere).then((ok) => {
          if (ok) beginOn(rowId, columnId);
        });
        return;
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
    store.setState((prev) => ({ ...prev, active: null, deletedRowIds: [] }));
  };

  const addRow = (values?: TMDataGridRowData): string => {
    const context = getContext();
    newRowCounter += 1;
    const tempId = `__new__${newRowCounter}`;
    const defaults =
      typeof context.newRowDefaults === "function"
        ? context.newRowDefaults()
        : (context.newRowDefaults ?? {});
    // The argument wins over the defaults key by key, so a caller can seed
    // one field and leave the rest of `newRowDefaults` standing.
    createForm(tempId, { ...defaults, ...values }, true);
    store.setState((prev) => ({
      ...prev,
      newRows: [...prev.newRows, { tempId, confirmed: false }],
    }));
    return tempId;
  };

  const deleteRow = (rowId: string) => {
    const entry = forms.get(rowId);
    // Deleting an unsaved entry row is just discarding the entry.
    if (entry?.isNew === true) {
      drop(rowId);
      return;
    }
    const context = getContext();
    if (context.editMode === "draft") {
      // A toggle: the second press unmarks - the mark is a draft too.
      store.setState((prev) => ({
        ...prev,
        deletedRowIds: prev.deletedRowIds.includes(rowId)
          ? prev.deletedRowIds.filter((id) => id !== rowId)
          : [...prev.deletedRowIds, rowId],
      }));
      return;
    }
    const row = getRow(rowId);
    if (row === undefined) return;
    // Confirmation is the consumer's business, in their onRowDelete.
    void context.onRowDelete?.({ rowId, row });
  };

  const canDeleteRows = (): boolean => {
    const context = getContext();
    if (context.editMode === "draft") {
      return (
        context.onRowDelete !== undefined ||
        context.onEditCommitDrafts !== undefined
      );
    }
    return context.onRowDelete !== undefined;
  };

  /** The pending deletions, reported and cleared by submitAll. */
  const takeDeletedRowIds = (): Array<string> => {
    const deleted = [...store.state.deletedRowIds];
    if (deleted.length > 0) {
      store.setState((prev) => ({ ...prev, deletedRowIds: [] }));
    }
    return deleted;
  };

  const submitAll = async (): Promise<boolean> => {
    // While this runs, `commit` really commits - under draft it parks
    // otherwise. Single-threaded flag, same idiom as the collectors.
    submitAllRunning = true;
    try {
      return await submitAllInner();
    } finally {
      submitAllRunning = false;
    }
  };

  const submitAllInner = async (): Promise<boolean> => {
    if (getContext().onEditCommitDrafts === undefined) {
      // The default: the per-row loop - edits through `onEditCommit`, entry
      // rows through `onRowAdd`, marked deletions through `onRowDelete`.
      const results = await Promise.all(
        [...forms.keys()].map((rowId) => commit(rowId)),
      );
      for (const rowId of takeDeletedRowIds()) {
        const row = getRow(rowId);
        if (row !== undefined) {
          await getContext().onRowDelete?.({ rowId, row });
        }
      }
      return results.every(Boolean);
    }

    // One consumer call for the lot. Validation stays Form's, per row: rows
    // that fail keep their forms and markers; the valid ones travel
    // together, and only a resolved save drops them - a rejected save keeps
    // every draft, deletions included.
    const collected: Array<TMDataGridEditCommitArgs<TMDataGridRowData>> = [];
    const added: Array<TMDataGridRowAddArgs<TMDataGridRowData>> = [];
    draftCollector = collected;
    draftAddCollector = added;
    let allValid = true;
    try {
      for (const rowId of [...forms.keys()]) {
        const entry = forms.get(rowId);
        if (entry === undefined) continue;
        if (
          !entry.isNew &&
          diff(entry, entry.form.state.values as TMDataGridRowData).length === 0
        ) {
          drop(rowId);
          continue;
        }
        entry.lastSubmitOk = false;
        await entry.form.handleSubmit();
        if (!entry.lastSubmitOk) allValid = false;
      }
    } finally {
      draftCollector = null;
      draftAddCollector = null;
    }
    const deleted = [...store.state.deletedRowIds];
    if (collected.length > 0 || added.length > 0 || deleted.length > 0) {
      try {
        await getContext().onEditCommitDrafts?.({ rows: collected, added, deleted });
      } catch {
        return false;
      }
      for (const args of collected) drop(args.rowId);
      for (const args of added) drop(args.tempId);
      if (deleted.length > 0) {
        store.setState((prev) => ({
          ...prev,
          deletedRowIds: prev.deletedRowIds.filter(
            (id) => !deleted.includes(id),
          ),
        }));
      }
    }
    return allValid;
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
    const entry = forms.get(rowId) ?? createForm(rowId, row.original, false);
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
    addRow,
    deleteRow,
    canDeleteRows,
  };
}

/**
 * `meta.edit.validate` normalised to the object TanStack Form's `validators`
 * option takes - a bare schema or function is shorthand for `{ onChange }`.
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

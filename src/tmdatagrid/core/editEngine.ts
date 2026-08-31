import {
  FormApi,
  getBy,
  type AnyFieldApi,
  type AnyFormApi,
  type StandardSchemaV1,
} from "@tanstack/react-form";
import { batch, Store } from "@tanstack/store";
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
 * What counts as a commit - one axis, each mode a thin policy over the same
 * engine. Where a commit *goes* is the other axis, `editing.draft`: out to
 * the consumer, or into the draft store. See `editing` on
 * `UseTMDataGridOptions`.
 *
 * | Mode | Enter | Tab | Focus leaves | Escape |
 * | ---- | ----- | --- | ------------ | ------ |
 * | `"cell"` | commits | commits, caret moves on | commits | cancels |
 * | `"cellConfirm"` | commits | keeps the draft, caret moves on | keeps the draft | cancels |
 * | `"row"` | commits the row | the browser's, along the row | nothing | cancels the row |
 *
 * An entry row is row-shaped in every mode - every editable cell open at
 * once, the browser's Tab between them, and an explicit ✓.
 */
export type TMDataGridEditMode = "cell" | "cellConfirm" | "row";

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

/** What `editing.tableValidators` is handed for one commit. */
export type TMDataGridTableValidateArgs<
  TData extends RowData = TMDataGridRowData,
> = {
  /** The committing row, as drafted. */
  value: TData;
  /** Its id - `addRow`'s temp id for an entry row. */
  rowId: string;
  /** Whether the row is an entry row, not yet in `data`. */
  isNew: boolean;
  /**
   * The collection as it would stand if this commit landed: every data row
   * overlaid with its draft where one is held (this row's `value` included),
   * entry rows appended, deletion-marked rows removed. Unfiltered - a rule
   * sees the whole collection whatever the view shows.
   */
  rows: ReadonlyArray<{ rowId: string; value: TData }>;
};

/**
 * `editing.tableValidators` - rules that need the other rows: no duplicate
 * keys, no overlapping ranges, allocations summing to a total. Run at every
 * commit, after the row's own validators, and again per parked row during
 * `saveDrafts` - so a draft invalidated by a later edit blocks the save.
 *
 * Return nothing to pass, a message, or Form's `{ form, fields }` shape;
 * pathed issues land on the committing row's cells, pathless ones on the row.
 * `onSubmit` runs first, and its failure stands without `onSubmitAsync`
 * running.
 */
export type TMDataGridTableValidators<
  TData extends RowData = TMDataGridRowData,
> = {
  onSubmit?: (args: TMDataGridTableValidateArgs<TData>) => unknown;
  onSubmitAsync?: (
    args: TMDataGridTableValidateArgs<TData>,
  ) => unknown | Promise<unknown>;
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
  /** Field names carrying a validation error, live or from a failed commit. */
  errorFields: ReadonlyArray<string>;
  /**
   * Those errors as text: what each cell editor is showing, plus what the
   * row's last failed commit found. The second half is the reason this
   * exists - Form clears a field's errors when its editor unmounts, so a row
   * left invalid would go back to looking like an ordinary edited row. Such
   * a message is dropped as soon as its field's value moves: the fix is what
   * clears the mark.
   */
  errorMessages: ReadonlyArray<{ field: string; message: string }>;
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
   * Rows with a live form, committed or not - every row the grid is holding
   * work for. A row is *open* (undecided form state) when it is in here and
   * not in {@link committedRowIds}.
   */
  openRowIds: ReadonlyArray<string>;
  rows: Record<string, TMDataGridEditRowProjection>;
  /**
   * The draft store's edit slice: existing rows whose form passed its submit
   * and is parked, waiting for `saveDrafts`. A subset of `openRowIds` - the
   * values stay in the row's form, this records which side of the line the
   * row is on. `begin` on one of these takes it back out, into form state.
   *
   * Only `editing.draft` parks. Without it a commit goes straight to the
   * consumer and the form is dropped, so this stays empty.
   */
  committedRowIds: ReadonlyArray<string>;
  /**
   * The draft store's values, per row - what a committed row *is* to the
   * table. Snapshotted when a row commits (existing and entry rows alike)
   * and kept across a reopen until the row commits again or is dropped, so
   * a row keeps its place in the sort while a second cell is being typed
   * into. The hook feeds these into the table's `data` in place of the
   * consumer's records, which is how sorting, filtering, grouping and
   * aggregates see a draft.
   */
  committedValues: Readonly<Record<string, TMDataGridRowData>>;
  /**
   * Rows being created, not yet in `data`. `committed` is the draft store's
   * add slice: the entry row passed its submit and renders as a value row
   * until `begin` re-opens it. Without `editing.draft` a commit adds through
   * `onRowAdd` and the entry is dropped, so it never turns `true`.
   */
  newRows: ReadonlyArray<{ tempId: string; committed: boolean }>;
  /** The draft store's delete slice: rows marked deleted, awaiting the save. */
  deletedRowIds: ReadonlyArray<string>;
};

const EMPTY_EDIT_STATE: TMDataGridEditState = {
  active: null,
  openRowIds: [],
  rows: {},
  committedRowIds: [],
  committedValues: {},
  newRows: [],
  deletedRowIds: [],
};

/**
 * The rows still *open*: holding a live form nobody has decided yet.
 *
 * Narrower than {@link TMDataGridEditState.openRowIds}, which is every row
 * with a form, the parked ones included. A row qualifies here when it is not
 * parked in the draft store and there is something to lose - an entered row
 * always counts, an existing one only once a value has moved.
 *
 * The order is the engine's: the order the forms were opened.
 */
export function getOpenRowIds(
  state: TMDataGridEditState,
): ReadonlyArray<string> {
  return state.openRowIds.filter(
    (rowId) =>
      !state.committedRowIds.includes(rowId) &&
      !state.newRows.some(
        (newRow) => newRow.tempId === rowId && newRow.committed,
      ) &&
      (state.newRows.some((newRow) => newRow.tempId === rowId) ||
        (state.rows[rowId]?.dirtyFields.length ?? 0) > 0),
  );
}

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

/** A new row being committed - `onRowAdd`, and `saveDrafts`'s `created`. */
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

/**
 * The draft store, flushed - what `saveDrafts` hands `onSaveDrafts`. Every
 * committed change at once, so a server can apply it as one transaction.
 * Rows still open (undecided form state) are not in here and stay open.
 */
export type TMDataGridSaveDraftsArgs<TData extends RowData> = {
  /** Committed edits to existing rows; each entry carries its `rowId`. */
  updated: Array<TMDataGridEditCommitArgs<TData>>;
  /** Committed new rows from the entry block; each entry carries its `tempId`. */
  created: Array<TMDataGridRowAddArgs<TData>>;
  /** Ids marked deleted while the drafts accumulated. */
  deleted: Array<string>;
  /** @deprecated Renamed to {@link updated}. Removed in a later beta. */
  rows: Array<TMDataGridEditCommitArgs<TData>>;
  /** @deprecated Renamed to {@link created}. Removed in a later beta. */
  added: Array<TMDataGridRowAddArgs<TData>>;
};

/**
 * Which entries of one bucket saved. `true`, or an id the map does not name,
 * saved and is dropped from the draft store; `false` failed and keeps its
 * draft. A bare boolean answers for the whole bucket.
 */
export type TMDataGridSaveOutcomes = boolean | Record<string, boolean>;

/**
 * What `onSaveDrafts` may return to save part of the store.
 *
 * Returning nothing saves everything, and throwing saves nothing. Between
 * those, name the ids that failed: they keep their drafts, committed and
 * ready for the next save, while the rest are dropped. The grid marks them
 * with nothing beyond the state itself - a failed edit keeps `data-draft`,
 * a failed deletion keeps `data-deleted` - so the display is the consumer's.
 */
export type TMDataGridSaveDraftsResult = {
  /** Keyed by `rowId`. */
  updated?: TMDataGridSaveOutcomes;
  /** Keyed by `tempId`. */
  created?: TMDataGridSaveOutcomes;
  /** Keyed by `rowId`. */
  deleted?: TMDataGridSaveOutcomes;
};

/** Whether one id of a bucket saved. Unnamed ids saved. */
function isSaved(
  outcomes: TMDataGridSaveOutcomes | undefined,
  id: string,
): boolean {
  if (outcomes === undefined) return true;
  if (typeof outcomes === "boolean") return outcomes;
  return outcomes[id] !== false;
}

/**
 * @deprecated Renamed to {@link TMDataGridSaveDraftsArgs} - the payload is
 * the draft store being saved, not a commit. Removed in a later beta.
 */
export type TMDataGridEditCommitDraftsArgs<TData extends RowData> =
  TMDataGridSaveDraftsArgs<TData>;

/** What the engine reads fresh on every call - see `createEditEngine`. */
export type TMDataGridEditEngineContext = {
  table: TMDataGridTable<TMDataGridRowData>;
  editMode: TMDataGridEditMode;
  /** `editing.draft` - whether a commit parks instead of reaching out. */
  draft: boolean;
  rowValidators?: TMDataGridRowValidators;
  tableValidators?: TMDataGridTableValidators;
  /**
   * `editing.columns` - the allowlist, or `undefined` for "every column that
   * maps to a field".
   */
  editableColumnIds?: ReadonlyArray<string>;
  isRowEditable?: (row: ErasedRow) => boolean;
  onEditCommit?: (
    args: TMDataGridEditCommitArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
  onSaveDrafts?: (
    args: TMDataGridSaveDraftsArgs<TMDataGridRowData>,
  ) =>
    | void
    | TMDataGridSaveDraftsResult
    | Promise<void | TMDataGridSaveDraftsResult>;
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

/** `edit.addRows` options. */
export type TMDataGridAddRowsOptions = {
  /**
   * Submit each row as it is added instead of leaving it open. Defaults to
   * `false` - the rows open as editable entry rows, as `addRow` does.
   */
  commit?: boolean;
};

/** What `edit.addRows` reports back. Every added row is in exactly one list. */
export type TMDataGridAddRowsResult = {
  /** Temp ids that committed - parked as drafts, or added outright. */
  committed: Array<string>;
  /**
   * Temp ids still open in the entry block: everything, when `commit` was
   * not asked for; the rows that failed validation, when it was.
   */
  open: Array<string>;
};

/** One row of {@link TMDataGridEditApi.getRows}. */
export type TMDataGridEditRowSnapshot<
  TData extends RowData = TMDataGridRowData,
> = {
  /** The row's id - `addRow`'s temp id for an entry row. */
  rowId: string;
  /** The row as shown: its draft where a form holds one, else `data`'s value. */
  value: TData;
  /** An entry row, not yet in `data`. */
  isNew: boolean;
  /** Marked deleted, awaiting `saveDrafts`. */
  deleted: boolean;
};

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
   * The row as shown: its draft values where a form holds one - open or
   * parked in the draft store - else what `data` says. `undefined` when no
   * such row exists. A deletion mark does not change the answer; check
   * `state.deletedRowIds` for that.
   */
  getRowValues: (rowId: string) => TData | undefined;
  /**
   * Every row as shown, nothing filtered out: data rows overlaid with their
   * drafts, entry rows appended, deletion-marked rows included and flagged.
   * Built from the core row model, so it is unfiltered, unsorted and never
   * contains group rows. Filter on `deleted` / `isNew` for the set you want.
   */
  getRows: () => ReadonlyArray<TMDataGridEditRowSnapshot<TData>>;
  /**
   * Whether this cell may open an editor: the column maps to a field, nothing
   * switched it off, and the row takes edits at all.
   */
  canEditCell: (row: ErasedRow, column: ErasedColumn) => boolean;
  /** Whether the row takes edits at all - the edit lane's pencil gate. */
  canEditRow: (row: ErasedRow) => boolean;
  /**
   * Whether the column takes edits at all, with no row in hand: it maps to a
   * field, `editing.columns` lists it if that option is set, and
   * `meta.edit.enabled` is not `false`. A per-row `enabled` predicate is the
   * row's half of the question - `canEditCell` asks both.
   */
  isColumnEditable: (column: ErasedColumn) => boolean;
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
  /** Drops every draft - open form state and the draft store alike. */
  cancelAll: () => void;
  /**
   * Submits every open row, as if each had been OK'd: a row that validates
   * commits (into the draft store with `editing.draft` on, straight to the
   * consumer without it), a row that fails stays open with its errors.
   * `true` when every row committed. Under `editing.draft` it sends nothing
   * to the consumer by itself - that is `saveDrafts`.
   */
  commitAll: () => Promise<boolean>;
  /**
   * Flushes the draft store: every committed edit, added row and deletion
   * mark reaches the consumer, through `onSaveDrafts` in one call when it is
   * set, or row by row through `onCommit` / `onRowAdd` / `onRowDelete`.
   *
   * Rows still open are left alone - they keep their form state and stay
   * open. `true` when everything landed; a rejected save keeps every draft.
   */
  saveDrafts: () => Promise<boolean>;
  /**
   * @deprecated Split into {@link commitAll} and {@link saveDrafts}, which is
   * exactly what this now does. Removed in a later beta.
   */
  submitAll: () => Promise<boolean>;
  /** Writes the type's empty value into a cell and commits it - Delete. */
  clearCell: (rowId: string, columnId: string) => Promise<boolean>;
  /**
   * Writes one cell and commits the row - a typed edit without the typing,
   * for toolbar actions and bulk fills. Under `editing.draft` the row parks
   * in the draft store exactly as a hand-made edit does, so it carries the
   * same change markers and the same per-row revert.
   *
   * The row need not be mounted; a row inside a collapsed group takes the
   * write. Resolves `false` when the cell takes no edit - no such row or
   * column, `editing.columns` excludes it, `meta.edit.enabled` is off, or the
   * row is not editable - and when validation refuses the value, which leaves
   * the row open carrying its errors.
   *
   * `value` is the stored value: no editor runs, so `meta.edit.mapValue`
   * does not either. `meta.edit.validate` does.
   */
  setCellValue: (
    rowId: string,
    columnId: string,
    value: unknown,
  ) => Promise<boolean>;
  /**
   * {@link setCellValue} for several cells of one row, in a single commit -
   * one consumer call and one draft entry rather than one per column. Keys
   * are column ids.
   *
   * All or nothing: if any named cell takes no edit, nothing is written and
   * this resolves `false`.
   */
  setRowValues: (
    rowId: string,
    values: Record<string, unknown>,
  ) => Promise<boolean>;
  /**
   * Opens a new entry row (the sticky block under the header) seeded from
   * `newRowDefaults`. `values` overrides that seed key by key, so
   * `addRow()` opens a blank row and `addRow({ status: "draft" })` opens one
   * that starts filled in. Returns its temporary id - a form with no backing
   * row yet. Committing it calls `onRowAdd`, or parks it for `saveDrafts`
   * under `editing.draft`.
   */
  addRow: (values?: Partial<TData>) => string;
  /**
   * Opens entry rows for a list of records at once - one state write for the
   * batch, where a loop over `addRow` is one per row. Each row is seeded over
   * `newRowDefaults` exactly as `addRow` does.
   *
   * `commit: true` submits each row as it lands, which is what an import
   * wants: rows that validate commit (parked in the draft store under
   * `editing.draft`, added through `onRowAdd` without it - once per row),
   * and rows that fail stay open in the entry block carrying their errors,
   * for the user to fix. The result says which went which way.
   */
  addRows: (
    rows: ReadonlyArray<Partial<TData>>,
    options?: TMDataGridAddRowsOptions,
  ) => Promise<TMDataGridAddRowsResult>;
  /**
   * Deletes a row: `onRowDelete` straight away, or under `editing.draft` a
   * mark in `deletedRowIds` - the row renders struck through until
   * `saveDrafts` reports it. Idempotent: deleting a marked row again leaves
   * it marked, and {@link restoreRow} is the undo. On an entry row,
   * committed or not, it just discards the entry; an id the grid does not
   * know is a no-op.
   */
  deleteRow: (rowId: string) => void;
  /**
   * {@link deleteRow} for several rows in one call - one notification for
   * the batch, for a bulk action over a selection. Because `deleteRow` is
   * idempotent and ignores unknown ids, the list may be passed exactly as
   * the selection stands - already-marked rows stay marked, duplicates and
   * stale ids do nothing.
   */
  deleteRows: (rowIds: ReadonlyArray<string>) => void;
  /**
   * Removes a row's deletion mark - the lane's Restore. A no-op on a row
   * that is not marked, and outside `editing.draft`, where no marks exist.
   */
  restoreRow: (rowId: string) => void;
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
 * The first error as text, whatever shape the validator produced - TanStack
 * Form keeps errors verbatim, so a Zod issue arrives as `{ message }`, a
 * plain function's return arrives as it was, and a form-level schema's
 * pathless issues arrive keyed under an empty path (`{ "": [issues] }`).
 * This digs until it finds a message.
 */
export function firstErrorText(error: unknown): string | undefined {
  if (error === null || error === undefined) return undefined;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    for (const entry of error) {
      const text = firstErrorText(entry);
      if (text !== undefined) return text;
    }
    return undefined;
  }
  if (typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    for (const value of Object.values(error)) {
      const text = firstErrorText(value);
      if (text !== undefined) return text;
    }
  }
  return undefined;
}

/**
 * The triggers a submit runs, in the order Form would: a value that fails its
 * column's `onChange` rule fails the submit too.
 */
const SUBMIT_VALIDATE_TRIGGERS = [
  "onChange",
  "onChangeAsync",
  "onSubmit",
  "onSubmitAsync",
] as const;

/** Whether a validator's return counts as an error. */
function isValidationError(result: unknown): boolean {
  return result !== undefined && result !== null && result !== false;
}

/**
 * Runs one field validator the way TanStack Form would - a Standard Schema
 * (Zod, Valibot…) or a plain function - and returns its error, or undefined.
 */
async function runFieldValidator(
  validator: unknown,
  value: unknown,
): Promise<unknown> {
  if (typeof validator === "function") {
    return await (
      validator as (args: { value: unknown; fieldApi: unknown }) => unknown
    )({ value, fieldApi: undefined });
  }
  if (
    typeof validator === "object" &&
    validator !== null &&
    "~standard" in validator
  ) {
    const schema = validator as StandardSchemaV1<unknown, unknown>;
    const result = await schema["~standard"].validate(value);
    const { issues } = result as {
      issues?: ReadonlyArray<{ message: string }>;
    };
    if (issues === undefined || issues.length === 0) return undefined;
    return issues[0]?.message ?? "Invalid";
  }
  return undefined;
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
    /**
     * In the draft store: this row's form passed its submit and is parked,
     * waiting for `saveDrafts`. Mirrored into the state's `committedRowIds`
     * (existing rows) or `newRows[].committed` (entry rows).
     */
    committed: boolean;
    /** Set by the wrapped onSubmit when the consumer's commit resolved. */
    lastSubmitOk: boolean;
    /**
     * What the last failed commit found, field by field, with the value it
     * found it on. Form clears a field's errors when its editor unmounts, so
     * without this a row that failed on the way out would keep its draft and
     * lose the reason. `project` drops an entry once its value has moved.
     */
    submitErrors: Array<{ field: string; value: unknown; message: string }>;
    /**
     * The park: this submit validates and puts the row in the draft store
     * instead of calling the consumer. Set by `commit` per attempt - `true`
     * only while `editing.draft` is on and outside `saveDrafts`, which is
     * what closes the per-row escape hatches (the lane's ✓,
     * Delete-to-clear) at the engine.
     */
    parkOnly: boolean;
    /** A commit already running - Enter and blur race on the same edit. */
    pendingCommit: Promise<boolean> | null;
    unsubscribe: () => void;
    unmount: () => void;
  };
  const forms = new Map<string, FormEntry>();
  let newRowCounter = 0;
  const NEW_ROW_ID_PREFIX = "__new__";
  /** Lets `commit` tell a `saveDrafts` flush apart from a lone commit. */
  let savingDrafts = false;

  /**
   * While `saveDrafts` runs with an `onSaveDrafts`, each row's wrapped
   * onSubmit contributes its args here instead of calling `onEditCommit` -
   * validation stays per row (Form's), the consumer call becomes one.
   */
  let draftCollector: Array<TMDataGridEditCommitArgs<TMDataGridRowData>> | null =
    null;
  let draftAddCollector: Array<TMDataGridRowAddArgs<TMDataGridRowData>> | null =
    null;

  /**
   * The column's half of the rule, with no row in hand: it is a consumer
   * column mapping to a field, `editing.columns` lists it if that is set, and
   * `meta.edit.enabled` has not switched it off outright. A per-row predicate
   * on `enabled` is the row's half and is not asked here.
   */
  const isColumnEditable = (column: ErasedColumn): boolean => {
    if (isControlColumn(column.id)) return false;
    if (getEditFieldName(column) === null) return false;
    const allowed = getContext().editableColumnIds;
    if (allowed !== undefined && !allowed.includes(column.id)) return false;
    return !isColumnEditSwitchedOff(column);
  };

  const editableColumns = (): Array<ErasedColumn> =>
    getContext().table.getAllLeafColumns().filter(isColumnEditable);

  /**
   * Every column's `meta.edit.validate`, run against a row's values.
   *
   * Field validators belong to the mounted editor, so a row committed with
   * no editors on screen - an import, a programmatic commit, a row whose
   * cells are scrolled out - would otherwise submit without them ever
   * running. This is the engine running the same rules itself, so a commit
   * validates the same wherever it comes from. The result is Form's
   * `{ fields }` shape, which plants each error on its own field.
   */
  const validateColumnFields = async (
    values: TMDataGridRowData,
    rowId: string,
    isNew: boolean,
  ): Promise<Record<string, unknown> | undefined> => {
    const row = isNew ? undefined : getRow(rowId);
    const fields: Record<string, unknown> = {};
    for (const column of editableColumns()) {
      // A column switched off for this row has no editor and takes no edit,
      // so its rule is not this row's to satisfy.
      if (row !== undefined && !isColumnEditableForRow(column, row)) continue;
      const field = getEditFieldName(column);
      if (field === null) continue;
      const normalized = normalizeFieldValidate(
        column.columnDef.meta?.edit?.validate,
      );
      if (normalized === undefined) continue;
      const value = getBy(values, field);
      for (const trigger of SUBMIT_VALIDATE_TRIGGERS) {
        const validator = normalized[trigger];
        if (validator === undefined) continue;
        const error = await runFieldValidator(validator, value);
        if (isValidationError(error)) {
          fields[field] = error;
          break;
        }
      }
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  };

  /**
   * The collection as a table validator sees it: every data row overlaid
   * with its draft where a form holds one, entry rows appended, and rows
   * marked deleted removed. The committing row contributes the values being
   * submitted, not what `data` still says. Built from the core row model, so
   * it is unfiltered and never contains group rows.
   */
  const mergedRows = (
    rowId: string,
    value: TMDataGridRowData,
    isNew: boolean,
  ): Array<{ rowId: string; value: TMDataGridRowData }> => {
    const deleted = new Set(store.state.deletedRowIds);
    const rows: Array<{ rowId: string; value: TMDataGridRowData }> = [];
    const model = getContext().table.getCoreRowModel();
    for (const row of model.flatRows) {
      if (deleted.has(row.id)) continue;
      if (row.id === rowId) {
        rows.push({ rowId, value });
        continue;
      }
      const held = forms.get(row.id);
      rows.push({
        rowId: row.id,
        value:
          held === undefined
            ? (row.original as TMDataGridRowData)
            : (held.form.state.values as TMDataGridRowData),
      });
    }
    // Entry rows the table does not hold: the open ones, and the committed
    // ones under `newRowsSticky`. A committed row in flow is in `data`
    // already, so it was listed above.
    for (const newRow of store.state.newRows) {
      if (newRow.tempId === rowId || newRow.tempId in model.rowsById) continue;
      const held = forms.get(newRow.tempId);
      if (held === undefined || deleted.has(newRow.tempId)) continue;
      rows.push({
        rowId: newRow.tempId,
        value: held.form.state.values as TMDataGridRowData,
      });
    }
    if (isNew && !(rowId in model.rowsById)) rows.push({ rowId, value });
    return rows;
  };

  /**
   * Runs `editing.tableValidators` for one commit. `onSubmit` first; its
   * failure stands and `onSubmitAsync` is not consulted, mirroring how the
   * column triggers short-circuit.
   */
  const runTableValidators = async (
    value: TMDataGridRowData,
    rowId: string,
    isNew: boolean,
  ): Promise<unknown> => {
    const validators = getContext().tableValidators;
    if (
      validators?.onSubmit === undefined &&
      validators?.onSubmitAsync === undefined
    ) {
      return undefined;
    }
    const args: TMDataGridTableValidateArgs = {
      value,
      rowId,
      isNew,
      rows: mergedRows(rowId, value, isNew),
    };
    const sync = validators.onSubmit?.(args);
    if (isValidationError(sync)) return sync;
    return await validators.onSubmitAsync?.(args);
  };

  /**
   * One submit pass's results folded into Form's error shape. A single
   * source passes through untouched (its own shape preserved); several merge
   * into `{ form, fields }`, the later source winning a field collision and
   * the form slot alike.
   */
  const mergeSubmitResults = (
    results: ReadonlyArray<unknown>,
    fields: Record<string, unknown> | undefined,
  ): unknown => {
    const errors = results.filter(isValidationError);
    if (errors.length === 0) {
      return fields === undefined ? undefined : { fields };
    }
    if (errors.length === 1) {
      const only = errors[0];
      if (fields === undefined) return only;
      if (typeof only === "object" && only !== null) {
        const shape = only as { fields?: Record<string, unknown> };
        return { ...shape, fields: { ...fields, ...(shape.fields ?? {}) } };
      }
      return { form: only, fields };
    }
    let form: unknown;
    let mergedFields: Record<string, unknown> = { ...(fields ?? {}) };
    for (const error of errors) {
      if (typeof error === "object" && error !== null) {
        const shape = error as {
          form?: unknown;
          fields?: Record<string, unknown>;
        };
        if (isValidationError(shape.form)) form = shape.form;
        mergedFields = { ...mergedFields, ...(shape.fields ?? {}) };
      } else {
        form = error;
      }
    }
    const merged: { form?: unknown; fields?: Record<string, unknown> } = {};
    if (form !== undefined) merged.form = form;
    if (Object.keys(mergedFields).length > 0) merged.fields = mergedFields;
    return merged;
  };

  /**
   * The row's `validators`, with column validation and the table rules folded
   * into the submit pass. The consumer's own `rowValidators` are passed
   * through untouched except for `onSubmitAsync`, which now also carries the
   * column rules and `editing.tableValidators` - later sources win a merge,
   * so the order is columns, then the table rules, then the row's own.
   */
  const composeValidators = (
    rowId: string,
    isNew: boolean,
  ): Record<string, unknown> => {
    const rowValidators = (getContext().rowValidators ?? {}) as Record<
      string,
      unknown
    >;
    const consumerAsync = rowValidators["onSubmitAsync"];
    return {
      ...rowValidators,
      onSubmitAsync: async (args: { value: unknown }) => {
        const value = args.value as TMDataGridRowData;
        const fromConsumer =
          consumerAsync === undefined
            ? undefined
            : await (consumerAsync as (a: unknown) => unknown)(args);
        const fromTable = await runTableValidators(value, rowId, isNew);
        const fields = await validateColumnFields(value, rowId, isNew);
        return mergeSubmitResults([fromTable, fromConsumer], fields);
      },
    };
  };

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
    const values = state.values as TMDataGridRowData;
    const live = Object.entries(state.fieldMeta).flatMap(([name, meta]) => {
      // The empty path is a pathless (row-level) issue's landing spot - it
      // belongs to `hasRowError`, not to any cell's marker.
      if (name === "") return [];
      const errors = (meta as { errors: ReadonlyArray<unknown> }).errors;
      if (!hasAnyError(errors)) return [];
      return [{ field: name, message: firstErrorText(errors) ?? "" }];
    });
    // What a closed editor left behind, minus everything the user has since
    // changed - editing the field is the answer to its message.
    const kept = entry.submitErrors.filter(
      (error) =>
        !live.some((current) => current.field === error.field) &&
        sameValue(getBy(values, error.field), error.value),
    );
    const errorMessages = [
      ...live,
      ...kept.map(({ field, message }) => ({ field, message })),
    ];
    return {
      dirtyFields: diff(entry, values).map((change) => change.field),
      errorFields: errorMessages.map((error) => error.field),
      errorMessages,
      hasRowError: hasAnyError(state.errors),
      isSubmitting: state.isSubmitting,
      values,
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

  /**
   * A commit's snapshot into `committedValues`. Refreshed on every commit,
   * not only the first - `setCellValue` on a parked row writes and commits
   * again without the row ever leaving the draft store. A reopen leaves the
   * snapshot alone: the table keeps showing the last decided values until
   * the next decision.
   */
  const snapshotCommitted = (
    prev: TMDataGridEditState,
    rowId: string,
  ): TMDataGridEditState["committedValues"] => {
    const values = forms.get(rowId)?.form.state.values as
      | TMDataGridRowData
      | undefined;
    if (values === undefined || prev.committedValues[rowId] === values) {
      return prev.committedValues;
    }
    return { ...prev.committedValues, [rowId]: values };
  };

  const setNewRowCommitted = (tempId: string, committed: boolean) => {
    store.setState((prev) => {
      const target = prev.newRows.find((newRow) => newRow.tempId === tempId);
      if (target === undefined) return prev;
      const committedValues = committed
        ? snapshotCommitted(prev, tempId)
        : prev.committedValues;
      if (
        target.committed === committed &&
        committedValues === prev.committedValues
      ) {
        return prev;
      }
      return {
        ...prev,
        committedValues,
        newRows:
          target.committed === committed
            ? prev.newRows
            : prev.newRows.map((newRow) =>
                newRow.tempId === tempId ? { ...newRow, committed } : newRow,
              ),
      };
    });
  };

  /**
   * Moves an existing row across the line between form state and the draft
   * store. The values stay in the row's form; this records which side the
   * row is on, snapshots them for the table on the way in, and the entry's
   * flag keeps the two in step.
   */
  const setCommitted = (rowId: string, committed: boolean) => {
    const entry = forms.get(rowId);
    if (entry !== undefined) entry.committed = committed;
    store.setState((prev) => {
      const has = prev.committedRowIds.includes(rowId);
      const committedValues = committed
        ? snapshotCommitted(prev, rowId)
        : prev.committedValues;
      if (has === committed && committedValues === prev.committedValues) {
        return prev;
      }
      return {
        ...prev,
        committedValues,
        committedRowIds:
          has === committed
            ? prev.committedRowIds
            : committed
              ? [...prev.committedRowIds, rowId]
              : prev.committedRowIds.filter((id) => id !== rowId),
      };
    });
  };

  const withoutCommittedValues = (
    prev: TMDataGridEditState,
    rowId: string,
  ): TMDataGridEditState["committedValues"] => {
    if (!(rowId in prev.committedValues)) return prev.committedValues;
    const { [rowId]: _dropped, ...rest } = prev.committedValues;
    return rest;
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
        committedRowIds: prev.committedRowIds.filter((id) => id !== rowId),
        committedValues: withoutCommittedValues(prev, rowId),
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
    const entry: FormEntry = {
      original,
      isNew,
      committed: false,
      lastSubmitOk: false,
      submitErrors: [],
      parkOnly: false,
      pendingCommit: null,
      unsubscribe: () => {},
      unmount: () => {},
      form: new FormApi({
        defaultValues: original,
        // The consumer's vocabulary is Form's own; the cast erases the
        // validator generics the same way the row type is erased. The column
        // rules ride along in the submit pass - see `composeValidators`.
        validators: composeValidators(rowId, isNew) as never,
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
    if (!isColumnEditable(column)) return false;
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

  /**
   * The row's field errors as they stand, with the value each was found on.
   * Read straight after a failed submit, while every editor is still mounted
   * and Form still holds what its validators said.
   */
  const takeFieldErrors = (
    entry: FormEntry,
  ): Array<{ field: string; value: unknown; message: string }> => {
    const values = entry.form.state.values as TMDataGridRowData;
    return Object.entries(entry.form.state.fieldMeta).flatMap(
      ([field, meta]) => {
        if (field === "") return [];
        const errors = (meta as { errors: ReadonlyArray<unknown> }).errors;
        const message = hasAnyError(errors) ? firstErrorText(errors) : undefined;
        if (message === undefined) return [];
        return [{ field, value: getBy(values, field), message }];
      },
    );
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
    entry.submitErrors = [];
    entry.parkOnly = getContext().draft && !savingDrafts;
    entry.pendingCommit = (async () => {
      try {
        await entry.form.handleSubmit();
      } finally {
        entry.pendingCommit = null;
      }
      // Dropped while the submit was in flight - cancel or deleteRow won the
      // race. The form is gone, so there is nothing to park or drop; marking
      // the row committed now would plant an id in `committedRowIds` that no
      // save or discard could ever clear.
      if (forms.get(rowId) !== entry) return true;
      if (!entry.lastSubmitOk) {
        // Snapshot before the caller closes the editor: the field errors go
        // with it, and the row is about to be left carrying them.
        entry.submitErrors = takeFieldErrors(entry);
        publishRow(rowId);
        return false;
      }
      if (entry.parkOnly) {
        // Into the draft store: the row's values stay in its form, and the
        // grid records that they are decided. An entry row renders as a
        // value row, an edited row as its draft - both until `begin` takes
        // the row back out into form state, or `saveDrafts` flushes it.
        entry.committed = true;
        if (entry.isNew) setNewRowCommitted(rowId, true);
        else setCommitted(rowId, true);
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
    // editors - with `editing.draft` on, that is how a parked row is edited
    // again.
    const entryForm = forms.get(rowId);
    if (entryForm?.isNew === true) {
      entryForm.committed = false;
      setNewRowCommitted(rowId, false);
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
    // Reopening a committed row takes it back out of the draft store: what
    // the user is now editing is undecided again, and `saveDrafts` must not
    // send it until it is committed afresh.
    else if (forms.get(rowId)?.committed === true) setCommitted(rowId, false);
    setActive({ rowId, columnId });
  };

  const begin: TMDataGridEditApi["begin"] = ({ rowId, columnId }) => {
    const { editMode } = getContext();
    // Each mode's policy about a row already open elsewhere:
    //
    // | Mode | Another row open |
    // | ---- | ---------------- |
    // | cell | committed - Sheets; a failed commit keeps holding the edit |
    // | row, cellConfirm | accumulates. Every draft waits for its own save,
    //   so a second row opening can neither discard the first nor be refused
    //   by it - nothing about one row's form bears on another's |
    //
    // A parked row is not "open": it has had its submit and is waiting for
    // the save, so it is skipped rather than put through a second one. An
    // entry row is skipped too - it is row-shaped in every mode, and its ✓
    // is the decision, so the sweep must not add a half-typed row.
    if (editMode === "cell") {
      const openElsewhere = [...forms.keys()].find((id) => {
        const other = forms.get(id);
        return id !== rowId && other?.committed !== true && other?.isNew !== true;
      });
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
    store.setState((prev) => ({
      ...prev,
      active: null,
      committedRowIds: [],
      committedValues: {},
      deletedRowIds: [],
    }));
  };

  const addRow = (values?: TMDataGridRowData): string => {
    newRowCounter += 1;
    const tempId = `${NEW_ROW_ID_PREFIX}${newRowCounter}`;
    createForm(tempId, seedNewRow(values), true);
    store.setState((prev) => ({
      ...prev,
      newRows: [...prev.newRows, { tempId, committed: false }],
    }));
    return tempId;
  };

  /** Seeds one entry row's values - `newRowDefaults` under `values`. */
  const seedNewRow = (values?: TMDataGridRowData): TMDataGridRowData => {
    const { newRowDefaults } = getContext();
    const defaults =
      typeof newRowDefaults === "function"
        ? newRowDefaults()
        : (newRowDefaults ?? {});
    // The argument wins over the defaults key by key, so a caller can seed
    // one field and leave the rest of `newRowDefaults` standing.
    return { ...defaults, ...values };
  };

  const addRows = async (
    rows: ReadonlyArray<TMDataGridRowData>,
    options?: TMDataGridAddRowsOptions,
  ): Promise<TMDataGridAddRowsResult> => {
    const tempIds: Array<string> = [];
    // One notification for the batch: `createForm` publishes its row as it
    // mounts, so an import of hundreds would otherwise wake every subscriber
    // once per row before the entry block has even been told they exist.
    batch(() => {
      for (const values of rows) {
        newRowCounter += 1;
        const tempId = `${NEW_ROW_ID_PREFIX}${newRowCounter}`;
        createForm(tempId, seedNewRow(values), true);
        tempIds.push(tempId);
      }
      store.setState((prev) => ({
        ...prev,
        newRows: [
          ...prev.newRows,
          ...tempIds.map((tempId) => ({ tempId, committed: false })),
        ],
      }));
    });

    if (options?.commit !== true) return { committed: [], open: tempIds };

    // In order, so a consumer's `onRowAdd` sees the rows as the file had
    // them. A row that fails validation stays open carrying its errors.
    const committed: Array<string> = [];
    const open: Array<string> = [];
    for (const tempId of tempIds) {
      const ok = await commit(tempId);
      (ok ? committed : open).push(tempId);
    }
    return { committed, open };
  };

  const deleteRow = (rowId: string) => {
    const entry = forms.get(rowId);
    // Deleting an unsaved entry row is just discarding the entry.
    if (entry?.isNew === true) {
      drop(rowId);
      return;
    }
    const context = getContext();
    if (context.draft) {
      // Idempotent: a marked row stays marked - `restoreRow` is the undo.
      store.setState((prev) => {
        if (prev.deletedRowIds.includes(rowId)) return prev;
        // Only a consumer row can be marked. A deletion mark is what
        // `saveDrafts` reports to the server, so an id it cannot act on -
        // an engine temp id, a record gone from `data`, an id the grid
        // never knew - must not live on as a mark inflating the draft
        // count. Entry rows are dropped above, never marked; the prefix
        // check also catches one already dropped that a stale selection or
        // a double-fired handler names again, while the table's data still
        // shows it for one render. The core model, so a filtered-out row
        // still takes its mark.
        if (
          rowId.startsWith(NEW_ROW_ID_PREFIX) ||
          !(rowId in context.table.getCoreRowModel().rowsById)
        ) {
          return prev;
        }
        return { ...prev, deletedRowIds: [...prev.deletedRowIds, rowId] };
      });
      return;
    }
    const row = getRow(rowId);
    if (row === undefined) return;
    // Confirmation is the consumer's business, in their onRowDelete.
    void context.onRowDelete?.({ rowId, row });
  };

  const deleteRows = (rowIds: ReadonlyArray<string>) => {
    // One notification for the batch - each id still goes through
    // `deleteRow`, so entry rows drop and everything else marks or no-ops
    // by the same rules.
    batch(() => {
      for (const rowId of rowIds) deleteRow(rowId);
    });
  };

  const restoreRow = (rowId: string) => {
    store.setState((prev) =>
      prev.deletedRowIds.includes(rowId)
        ? {
            ...prev,
            deletedRowIds: prev.deletedRowIds.filter((id) => id !== rowId),
          }
        : prev,
    );
  };

  const canDeleteRows = (): boolean => {
    const context = getContext();
    if (context.draft) {
      return (
        context.onRowDelete !== undefined ||
        context.onSaveDrafts !== undefined
      );
    }
    return context.onRowDelete !== undefined;
  };

  /** The pending deletions, reported and cleared by `saveDrafts`. */
  const takeDeletedRowIds = (): Array<string> => {
    const deleted = [...store.state.deletedRowIds];
    if (deleted.length > 0) {
      store.setState((prev) => ({ ...prev, deletedRowIds: [] }));
    }
    return deleted;
  };

  /** The draft store's rows: committed forms, in the order they landed. */
  const committedFormIds = (): Array<string> =>
    [...forms.keys()].filter((rowId) => forms.get(rowId)?.committed === true);

  const commitAll = async (): Promise<boolean> => {
    // Only the open ones - a row already in the draft store has had its
    // submit and must not be put through a second one here.
    const openIds = [...forms.keys()].filter(
      (rowId) => forms.get(rowId)?.committed !== true,
    );
    const results = await Promise.all(openIds.map((rowId) => commit(rowId)));
    return results.every(Boolean);
  };

  /**
   * The in-flight save. A second call while `onSaveDrafts` awaits would
   * re-collect the same payload and send it again - a double-clicked Save
   * would create every pending entry row twice - so concurrent calls join
   * this promise instead of starting a save of their own.
   */
  let saveInFlight: Promise<boolean> | null = null;

  const saveDrafts = (): Promise<boolean> => {
    if (saveInFlight !== null) return saveInFlight;
    // While this runs, `commit` really commits - `editing.draft` parks
    // otherwise. Single-threaded flag, same idiom as the collectors.
    savingDrafts = true;
    saveInFlight = saveDraftsInner().finally(() => {
      savingDrafts = false;
      saveInFlight = null;
    });
    return saveInFlight;
  };

  const saveDraftsInner = async (): Promise<boolean> => {
    const committedIds = committedFormIds();
    const deletedIds = [...store.state.deletedRowIds];
    // Nothing decided: open rows are not this verb's business, so a grid
    // mid-edit with an empty draft store saves cleanly and stays as it is.
    if (committedIds.length === 0 && deletedIds.length === 0) return true;

    if (getContext().onSaveDrafts === undefined) {
      // The default: the per-row loop - edits through `onEditCommit`, entry
      // rows through `onRowAdd`, marked deletions through `onRowDelete`.
      const results = await Promise.all(
        committedIds.map((rowId) => commit(rowId)),
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
      for (const rowId of committedIds) {
        const entry = forms.get(rowId);
        if (entry === undefined) continue;
        entry.lastSubmitOk = false;
        await entry.form.handleSubmit();
        if (!entry.lastSubmitOk) allValid = false;
      }
    } finally {
      draftCollector = null;
      draftAddCollector = null;
    }
    const deleted = deletedIds;
    if (collected.length > 0 || added.length > 0 || deleted.length > 0) {
      let result: void | TMDataGridSaveDraftsResult;
      try {
        result = await getContext().onSaveDrafts?.({
          updated: collected,
          created: added,
          deleted,
          // The pre-2.0 names, still filled - see TMDataGridSaveDraftsArgs.
          rows: collected,
          added,
        });
      } catch {
        return false;
      }

      // Nothing returned saves the lot. A result names what failed; those
      // keep their drafts, committed, so the next save retries them.
      const outcomes = result ?? {};
      let savedAll = true;

      for (const args of collected) {
        if (isSaved(outcomes.updated, args.rowId)) drop(args.rowId);
        else savedAll = false;
      }
      for (const args of added) {
        if (isSaved(outcomes.created, args.tempId)) drop(args.tempId);
        else savedAll = false;
      }
      const savedDeletions = deleted.filter((id) =>
        isSaved(outcomes.deleted, id),
      );
      if (savedDeletions.length > 0) {
        store.setState((prev) => ({
          ...prev,
          deletedRowIds: prev.deletedRowIds.filter(
            (id) => !savedDeletions.includes(id),
          ),
        }));
      }
      if (savedDeletions.length < deleted.length) savedAll = false;

      if (!savedAll) return false;
    }
    return allValid;
  };

  /** @deprecated The old one-shot save - `commitAll` then `saveDrafts`. */
  const submitAll = async (): Promise<boolean> => {
    const committedOk = await commitAll();
    const savedOk = await saveDrafts();
    return committedOk && savedOk;
  };

  /**
   * The write path behind `clearCell`, `setCellValue` and `setRowValues`:
   * fill the row's own form and commit it, exactly as a ✓ on an open editor
   * would. Uses the form already open on the row when there is one, so a
   * programmatic write joins an edit in progress rather than discarding it.
   *
   * No editor is involved, so `meta.edit.mapValue` does not run - the caller
   * writes the stored value itself. Validation is untouched: this is the same
   * `commit`, so `meta.edit.validate` and `editing.rowValidators` still decide
   * whether the row lands, and a failure leaves the row open carrying its
   * errors.
   */
  const writeFields = async (
    rowId: string,
    writes: ReadonlyArray<{ field: string; value: unknown }>,
  ): Promise<boolean> => {
    const row = getRow(rowId);
    if (row === undefined) return false;
    if (writes.length === 0) return true;
    const entry = forms.get(rowId) ?? createForm(rowId, row.original, false);
    for (const { field, value } of writes) {
      entry.form.setFieldValue(field as never, value as never);
    }
    return commit(rowId);
  };

  /** The field a cell writes to, or `null` when that cell takes no edit. */
  const writableField = (rowId: string, columnId: string): string | null => {
    const row = getRow(rowId);
    const column = getContext().table.getColumn(columnId);
    if (row === undefined || column === undefined) return null;
    if (!canEditCell(row, column)) return null;
    return getEditFieldName(column);
  };

  const clearCell = async (
    rowId: string,
    columnId: string,
  ): Promise<boolean> => {
    const column = getContext().table.getColumn(columnId);
    const field = writableField(rowId, columnId);
    if (field === null || column === undefined) return false;
    return writeFields(rowId, [
      {
        field,
        value: clearedValueForType(column.columnDef.meta?.type ?? "string"),
      },
    ]);
  };

  const setCellValue = async (
    rowId: string,
    columnId: string,
    value: unknown,
  ): Promise<boolean> => {
    const field = writableField(rowId, columnId);
    if (field === null) return false;
    return writeFields(rowId, [{ field, value }]);
  };

  const setRowValues = async (
    rowId: string,
    values: Record<string, unknown>,
  ): Promise<boolean> => {
    const writes: Array<{ field: string; value: unknown }> = [];
    for (const [columnId, value] of Object.entries(values)) {
      const field = writableField(rowId, columnId);
      // All or nothing: one cell that takes no edit fails the call before
      // anything is written, so a bulk action cannot half-apply unnoticed.
      if (field === null) return false;
      writes.push({ field, value });
    }
    return writeFields(rowId, writes);
  };

  const getRowValues = (rowId: string): TMDataGridRowData | undefined => {
    const held = forms.get(rowId);
    // Entry rows exist only as forms, so this covers them too.
    if (held !== undefined) return held.form.state.values as TMDataGridRowData;
    return getRow(rowId)?.original as TMDataGridRowData | undefined;
  };

  const getRows = (): ReadonlyArray<TMDataGridEditRowSnapshot> => {
    const deleted = new Set(store.state.deletedRowIds);
    const rows: Array<TMDataGridEditRowSnapshot> = [];
    const model = getContext().table.getCoreRowModel();
    for (const row of model.flatRows) {
      const held = forms.get(row.id);
      rows.push({
        rowId: row.id,
        value:
          held === undefined
            ? (row.original as TMDataGridRowData)
            : (held.form.state.values as TMDataGridRowData),
        isNew: held?.isNew === true,
        deleted: deleted.has(row.id),
      });
    }
    // Entry rows the table does not hold - see mergedRows.
    for (const newRow of store.state.newRows) {
      if (newRow.tempId in model.rowsById) continue;
      const held = forms.get(newRow.tempId);
      if (held === undefined) continue;
      rows.push({
        rowId: newRow.tempId,
        value: held.form.state.values as TMDataGridRowData,
        isNew: true,
        deleted: deleted.has(newRow.tempId),
      });
    }
    return rows;
  };

  return {
    store,
    get state() {
      return store.state;
    },
    getForm: (rowId) => forms.get(rowId)?.form,
    getRowValues,
    getRows,
    canEditCell,
    canEditRow,
    isColumnEditable,
    begin,
    commit,
    cancel,
    deactivate,
    cancelAll,
    commitAll,
    saveDrafts,
    submitAll,
    clearCell,
    setCellValue,
    setRowValues,
    addRow,
    addRows,
    deleteRow,
    deleteRows,
    restoreRow,
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

# Editing API

Reference for the `editing` skill. Everything editing owns, in one table per
kind.

## Hook options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `editMode` | `"cell" \| "cellConfirm" \| "row" \| "batch"` | off | Turns editing on and picks the commit policy. |
| `getRowId` | `(row) => string` | – | A TanStack table option, required once `editMode` is set. Drafts are keyed by it. |
| `isRowEditable` | `(row) => boolean` | – | Closes a whole row to editing, in every mode. |
| `rowValidators` | `TMDataGridRowValidators` | – | Form-level validation. Cross-field rules live here. |
| `newRowDefaults` | `TData \| (() => TData)` | – | Seeds the entry row's form. A function is called per added row. |
| `cellSelection` | `"none" \| "single" \| "range"` | `"single"` while editing | Editing turns the cell cursor on; set it explicitly to override. |

Passing any editing option without `editMode` is a compile error, and
`onEditCommitBatch` exists only in the `"batch"` branch of the type.

## Callbacks

| Name | Argument | What it does |
| --- | --- | --- |
| `onEditCommit` | `{ rowId, value, original, changes, source }` | Applies one row's change. Reject to keep the draft and show the error. |
| `onEditCommitBatch` | `{ rows, added, deleted }` | Batch only. One call for the whole save. Without it, `submitAll` loops `onEditCommit`. |
| `onRowAdd` | `{ tempId, value }` | Commits an entry row. Mint the real id here. |
| `onRowDelete` | `{ rowId, row }` | Deletes a row under the immediate modes, and puts the trash can in the edit lane. |

`changes` entries are `{ columnId, field, previous, next }`; `field` is the data
path, which may be dotted.

## Column meta

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `meta.type` | `TMDataGridColumnType` | `"string"` | Picks the built-in editor, and the filter operators. |
| `meta.options` | `TMDataGridOptionsSource` | – | Choices for `select` / `multiSelect`, shared with the filter panel. Array, `"faceted"`, or a function. |
| `meta.editable` | `boolean \| ((row) => boolean)` | editable where a field maps | Whether this column's cells edit. |
| `meta.editField` | `string` | The `accessorKey` | The data path an edit writes to. The only way an `accessorFn` column edits. |
| `meta.editor` | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. Define at module scope. |
| `meta.validate` | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema means `onChange`. |

## The `edit` engine

`grid.edit`, type `TMDataGridEditApi`.

| Member | Signature | Notes |
| --- | --- | --- |
| `begin` | `({ rowId, columnId }) => void` | `columnId: null` opens the whole row (row mode). |
| `commit` | `(rowId) => Promise<boolean>` | `false` keeps the form open with its errors. |
| `cancel` | `(rowId) => void` | Drops one draft. |
| `cancelAll` | `() => void` | Drops every draft. |
| `deactivate` | `() => void` | Closes the editor without touching the draft, as blur does under `"cellConfirm"`. |
| `submitAll` | `() => Promise<boolean>` | Batch's save. `true` when every row landed. |
| `clearCell` | `(rowId, columnId) => Promise<boolean>` | What Delete does: writes the type's empty value and commits. |
| `addRow` | `() => string` | Opens an entry row, returns its `tempId`. |
| `deleteRow` | `(rowId) => void` | `onRowDelete` under the immediate modes, a deletion mark under batch. |
| `canEditCell` | `(row, column) => boolean` | The gate the chrome uses. |
| `canEditRow` | `(row) => boolean` | The pencil's gate. |
| `canDeleteRows` | `() => boolean` | Whether delete chrome makes sense. |
| `getForm` | `(rowId) => TMDataGridRowEditForm \| undefined` | The row's live `FormApi`. |
| `state` | `TMDataGridEditState` | Snapshot, for reads outside React. |
| `store` | `Store<TMDataGridEditState>` | For `useSelector`. |

`TMDataGridEditState`:

```ts
type TMDataGridEditState = {
  active: { rowId: string; columnId: string | null } | null;
  openRowIds: ReadonlyArray<string>;
  rows: Record<
    string,
    {
      dirtyFields: ReadonlyArray<string>;
      errorFields: ReadonlyArray<string>;
      isSubmitting: boolean;
    }
  >;
  newRows: ReadonlyArray<{ tempId: string }>;
  deletedRowIds: ReadonlyArray<string>;
};
```

## Components and exports

| Name | Kind | What it is |
| --- | --- | --- |
| `TMDataGrid.EditActions` | Component | Save with the pending count, and Discard. Any mode; renders nothing while editing is off. |
| `TMDataGridEditActions` | Export | The same component, for use outside the namespace. |
| `EDIT_COLUMN_ID` | Export | `"__edit__"`, the generated edit lane's id. |
| `clearedValueForType` | Export | `(type) => unknown` - what Delete writes per column type. |
| `getEditFieldName` | Export | `(column) => string` - the data path a column's edits write to. |
| `normalizeFieldValidate` | Export | `(validate) => validators` - a bare schema into Form's shape. |
| `TMDataGridStringEditor` … `TMDataGridMultiSelectEditor` | Exports | The six built-in editors, for wrapping. |

Types: `TMDataGridEditMode`, `TMDataGridEditApi`, `TMDataGridEditState`,
`TMDataGridEditCommitArgs`, `TMDataGridEditCommitBatchArgs`,
`TMDataGridEditChange`, `TMDataGridEditorArgs`, `TMDataGridEditorComponent`,
`TMDataGridEditField`, `TMDataGridEditRowProjection`, `TMDataGridFieldValidate`,
`TMDataGridRowValidators`, `TMDataGridRowEditForm`, `TMDataGridRowAddArgs`,
`TMDataGridRowDeleteArgs`, `TMDataGridEditingOptions`.

## The edit lane

Generated, pinned right, id `EDIT_COLUMN_ID`. It appears when any of these
holds:

- `editMode: "row"` - the lane is Save and Cancel's home
- `onRowDelete` is set - the trash can has somewhere to report to
- `editMode: "batch"` **and** `onEditCommitBatch` is set

`"cell"` and `"cellConfirm"` have no lane unless `onRowDelete` asks for one.

## Styling and test hooks

| Name | Kind | What it is |
| --- | --- | --- |
| `--dg-entry-height` | CSS variable | Height of the sticky entry block. From `size`. |
| `data-deleted` | Row attribute | On a row marked for deletion under batch. |
| `data-dg-part="editor-input"` | Part | The control inside an editing cell. |
| `data-dg-part="save-row"` / `"cancel-row"` | Parts | The edit lane's buttons, with `data-row-id`. |
| `data-dg-part="save-all"` / `"discard-all"` | Parts | `EditActions`. |

See the `testing` skill for how to compose these into selectors.

# Cell editing - implementation plan

> **Status: executed 2026-07-31.** Phases 0–4 all shipped, one commit per
> phase (`9a47802`…, see git log). Kept for the rationale. Deviations worth
> noting: date's `is`/`isNot` became `equals`/`notEquals` comparing by
> calendar day (same semantics, no duplicate operators); the edit lane also
> appears outside row mode when `onRowDelete` (or a batch save) gives its
> trash somewhere to report; batch deletion marks are toggleable in place.

One editing row = one TanStack Form. The grid decides *where* and *when*;
the form decides *what*. Covers backlog items "Cell editing" and
"Column types: date, boolean, select" (that item is phase 0 here).

## Context

The grid is read-only. Cell selection landed the groundwork on purpose:
`ui.state.focusedCell` holds a `{ rowId, columnId }` pair, `resolveCellMove`
computes moves, and the key handler in `TMDataGridTable.tsx` documents
Enter/F2 as "the pair a cell editor will take over". This plan is that editor.

The engine is not hand-rolled. An edit engine is a form library - values,
dirty tracking, sync/async validation, debounce, submit lifecycle - and
TanStack Form already is that machine, Standard-Schema-native (a Zod schema
passes straight into `validators`) and built on `@tanstack/store`, the store
the grid already ships. So:

> One `FormApi` per editing row. "One row, one form" - literally.
> Edit modes are thin policies about which fields are open and when
> `handleSubmit` fires. Everything else - values, dirty, errors, async
> validation, submit state - is form state, read off `form.store` with the
> same `useSelector` idiom the grid already uses.

### Decisions

| Question | Decision |
| --- | --- |
| Engine | One `FormApi` per editing row, created imperatively (`new FormApi` - documented core usage), held in a hook-level map. `@tanstack/react-form` joins the peer family. |
| Validation | Zod (or Valibot/ArkType/plain function) via Standard Schema, passed into Form's `validators` untouched. |
| Commit styles | `editMode: "cell" \| "cellConfirm" \| "row" \| "batch"` - one axis; each mode a policy over the same engine. |
| Virtualization | Forms live outside the DOM, keyed by rowId. Editors unmount freely; the form does not. No sticky rows for edits, no virtualizer changes. |
| Column types | Widen `meta.type`; one shared `meta.options` feeds the filter panel *and* the editors. |
| Custom editors | `meta.renderEditor` receives the live Form `field` API plus the table context - the built-ins fill the same slot. |
| Scope | Phases 0–4: types, cell, confirm+row, batch, then add/delete rows with a sticky entry block. |

### Virtualization, up front

Nothing is kept mounted to protect an edit. A `FormApi` is a plain object in a
map keyed by `rowId` - the same reasoning `cellNavigation.ts` gives for ids
over positions. Scroll the editing row away: the editor component unmounts,
the form keeps its values, meta and errors. Scroll back: the editor re-mounts
over the same form. The cell's dirty marker (from the projected summary,
below) stays visible the whole time. The body's `paddingTop`/`paddingBottom`
spacers are untouched.

Sticky rows appear only in phase 4, for their own reason: a **new** row that
scrolls away has nothing to scroll back to. Existing rows never need it.

---

## Architecture

### 1. The engine - `core/editEngine.ts`

A factory, not a component, so it is headless-testable through the
`renderGrid` harness like every other core module:

```ts
export type TMDataGridEditEngine<TData> = {
  /** rowId → live form. The source of truth for everything mid-edit. */
  getForm: (rowId: string) => RowEditForm<TData> | undefined;
  begin: (target: { rowId: string; columnId: string | null }) => void;
  commit: (rowId: string) => Promise<boolean>;   // form.handleSubmit under the hood
  cancel: (rowId: string) => void;               // form.reset + drop
  cancelAll: () => void;
  submitAll: () => Promise<boolean>;             // batch mode
};
```

`RowEditForm<TData>` is a `FormApi` with `defaultValues: row.original`,
per-field validators from `meta.validate`, form-level validators from the
consumer's `rowValidators`, and an `onSubmit` the grid wraps: it calls the
consumer's `onEditCommit`, and only when that **resolves** does the engine
drop the form - a slow save shows the draft with a busy marker, never a
flicker back to the old value. A rejection keeps the form open with the error
on it.

Beside the engine, `api.edit` - a small `@tanstack/store` Store like `ui`,
the grid-facing index:

```ts
export type TMDataGridEditState = {
  /** The cell whose editor is open; columnId null = whole row (row mode). */
  active: { rowId: string; columnId: string | null } | null;
  /** Rows with a live form. In cell mode at most one; in batch, many. */
  openRowIds: ReadonlyArray<string>;
  /**
   * Projection of each open form's state, synced by the engine from
   * form.store subscriptions - so body cells subscribe to ONE store for
   * dirty/error markers instead of one per form.
   */
  rows: Record<string, {
    dirtyFields: ReadonlyArray<string>;
    errorFields: ReadonlyArray<string>;
    hasRowError: boolean;    // pathless .refine() - belongs to the row
    isSubmitting: boolean;
  }>;
  /** Phase 4. */
  newRows: ReadonlyArray<{ tempId: string }>;
  deletedRowIds: ReadonlyArray<string>;
};
```

Only the editor host reads a form's store directly (live value, live errors);
it is mounted only while its cell is editing, so the subscription count stays
at one form.

Consumer callbacks are held in refs (the `onHighlightedRowChangeRef` pattern
already in `useTMDataGrid.tsx`), so forms created at `begin()` always call
the latest `onEditCommit`.

**`getRowId` is required when editing is on** - the index fallback points at
a different record after any sort. Dev-mode `console.error` on mount.

### 2. Field names - how a column maps into the form

`getEditFieldName(column) = meta.editField ?? accessorKey ?? column.id`.

`accessorKey` is the true data path and Form addresses fields by dot-path, so
**nested rows work for free**: `accessorKey: "address.city"` edits
`values.address.city`, and a nested Zod schema's issues land on the right
column. A column built on `accessorFn` has no path and is not editable unless
`meta.editField` names one. TanStack Table's default id turns dots into
underscores, which is why the mapping starts from `accessorKey`, not `id`.

### 3. Data flow - the grid never mutates `data`

```
begin(cell) ─→ new FormApi({ defaultValues: row.original, validators })
type        ─→ field.handleChange(v)      - validation, debounce: Form's
commit      ─→ form.handleSubmit()
                 └→ onEditCommit({ rowId, value, changes, original, source })
                       resolve → engine drops the form; consumer's new data
                                 arrives back through `data` as always
                       reject  → form stays open, error on the row
```

`changes: Array<{ columnId, field, previous, next }>` - diffed per editable
column's path against `defaultValues`. In cell mode it has one entry; the
consumer who wants per-cell PATCHes reads it, the one who wants the whole row
takes `value`. One callback shape for every mode; batch adds an optional
`onEditCommitBatch({ rows, added, deleted })` that defaults to the per-row
loop.

Server-side rejection: `rowValidators.onSubmitAsync` may return Form's native
`{ form: "...", fields: { "details.email": "..." } }` shape - no grid
machinery involved.

### 4. Column types and the shared options source - `core/columnOptions.ts`

Phase 0, independently valuable (this is backlog item 1).

`meta.type` widens to `"string" | "number" | "boolean" | "date" | "select" |
"multiSelect"`, and one declaration feeds both the filter panel's value
control and the cell editor:

```ts
export type TMDataGridOption = {
  value: string;
  label?: string;
  color?: string;      // badge colour for select cells
  disabled?: boolean;
  group?: string;
};

export type TMDataGridOptionsSource<TData> =
  | ReadonlyArray<TMDataGridOption | string>
  | "faceted"                                    // ← getFacetedUniqueValues,
  | ((args: { table; column; row? }) =>          //   registered since day one,
      ReadonlyArray<TMDataGridOption | string>); //   used at last
```

`resolveColumnOptions({ table, column, row })` normalises all three forms;
`row` is present when an editor asks, absent for the filter panel - which is
what row-dependent options (city given country) key off. `"faceted"` is for
low-cardinality columns; Mantine's `Select` does not virtualize its dropdown,
so large sets want the function form.

Filter operators grow with the types: `boolean` equals/notEquals; `date` is,
isNot, before, after, onOrBefore, onOrAfter; `select`/`multiSelect` isAnyOf,
isNoneOf. One breaking type change: `TMDataGridFilterValue.value` widens from
`string` to `string | ReadonlyArray<string>` so `isAnyOf` can carry a set -
still plain JSON for `manualFiltering` forwarding (dates travel as ISO
strings). Minor version + changeset.

No `@mantine/dates`: date filter/editor inputs are `TextInput type="date"`;
a consumer wanting a real picker uses `renderEditor`.

### 5. Validation - Zod in, nothing invented

```tsx
// Per column - field-level validators, verbatim TanStack Form vocabulary.
columnHelper.accessor("firstName", {
  meta: { validate: { onChange: z.string().min(2, "Too short") } },
});
// Shorthand: a bare schema/function means { onChange: it }.

// Per row - form-level validators. Cross-field rules live here.
useTMDataGrid({
  editMode: "row",
  rowValidators: {
    onSubmit: z.object({ salary: z.number().positive(), status: z.enum([…]) })
      .refine((r) => r.status !== "Terminated" || r.salary === 0, {
        message: "A terminated employee has no salary",
      }),
  },
  onEditCommit: async ({ value, changes }) => api.save(value),
});
```

Both are forwarded into the form untouched - `onChange`, `onBlur`,
`onSubmit`, their `Async` variants and `onChangeAsyncDebounceMs` all work
because they are Form's own options, not a grid re-implementation. Issue
routing is Form's: pathed issues onto fields, pathless onto the form
(→ `hasRowError`, rendered on the row). The one documented requirement:
row-schema keys line up with field paths (§2).

### 6. Editors - `components/editors/` + `TMDataGridCellEditor.tsx`

The host mounts when a cell is `active`, replacing `renderCellContent` output
inside the existing `TMDataGridBodyCell`. It resolves the cell's field on the
row form, then renders `meta.renderEditor` if the column has one, else the
built-in for `meta.type` - **the built-ins are implemented against the same
contract, so `renderEditor` is not a special case, it is the same slot the
defaults fill.** The six are exported (`TMDataGridStringEditor` …) so a
custom editor can wrap one instead of starting over.

The contract deliberately mixes the two vocabularies - form on one side,
table on the other:

```tsx
export type TMDataGridEditorArgs<TData, TValue> = {
  /** Form side - the live TanStack Form field API for this cell:
      field.state.value, field.state.meta.errors / isDirty / isValidating,
      field.handleChange, field.handleBlur. The real thing, not a wrapper -
      a custom date-calendar, slider or async combobox binds to it exactly
      as it would inside any TanStack Form. */
  field: RowEditField<TData, TValue>;
  /** The whole row form, for the rare editor that reads sibling fields. */
  form: RowEditForm<TData>;

  /** Table side - where this editor is standing. */
  cell: Cell<…>; row: Row<…>; column: Column<…>; table: TMDataGridTable<TData>;

  /** Edit controls - what Enter/Escape would do, for the editor's own UI. */
  commit: () => Promise<boolean>;
  cancel: () => void;

  /** Chrome. `seedText` is set when typing opened the editor (Sheets-style)
      - the built-ins replace-and-append; a custom editor may ignore it. */
  size: TMDataGridSize;
  seedText?: string;
};

meta: {
  renderEditor: ({ field, commit, cancel, size }) => (
    <MyCalendarInput
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors[0]?.message}
      onPick={commit}
    />
  ),
}
```

Built-in behaviour (all six): autofocus on open, select-all on F2/Enter, seed
and append when opened by typing, first field error as the Mantine input's
`error`, commit on Enter, cancel on Escape.

| `meta.type` | Editor |
| --- | --- |
| `string` | `TextInput` |
| `number` | `NumberInput` |
| `boolean` | `Checkbox` |
| `date` | `TextInput type="date"` |
| `select` | `Select`, searchable, from `resolveColumnOptions` |
| `multiSelect` | `MultiSelect`, same source |

### 7. Keyboard - extending `handleGridKeyDown`

New branches land ahead of the existing ones in `TMDataGridTable.tsx`:

| Key | Focused editable cell | Editor open |
| --- | --- | --- |
| `Enter` / `F2` | Open editor (existing "step into cell" stays as fallback for non-editable cells) | Commit, move down |
| Printable char | Open editor seeded with it - the Sheets behaviour | - |
| `Delete`/`Backspace` | Clear value and commit | - |
| `Escape` | - | Cancel cell draft, focus back on the cell - must intercept *before* the existing escape-out branch |
| `Tab` / `Shift+Tab` | - | Commit, move to next **editable** cell, wrapping to the next row |
| `Ctrl+Enter` | - | Row mode: save the whole row |

`getNextEditableCell` joins `resolveCellMove` in `core/cellNavigation.ts` -
deliberately wrapping where arrows deliberately clamp (spreadsheet
convention; worth a comment, since that file argues the clamping case at
length).

### 8. Modes - four policies, one engine

| `editMode` | `begin` opens | Commit | Cancel | Chrome |
| --- | --- | --- | --- | --- |
| `"cell"` | One cell | Enter, Tab, blur | Escape | None - Sheets |
| `"cellConfirm"` | One cell | ✓ or Enter only; **blur keeps the form open**, cell renders dirty | ✕ or Escape | ✓ / ✕ beside the input |
| `"row"` | Every editable cell of the row | Save in the edit lane, or Ctrl+Enter | Cancel, or Escape | Generated edit lane |
| `"batch"` | Cells; forms accumulate, nothing auto-closes | `edit.submitAll()` | `edit.cancelAll()` | `TMDataGrid.EditActions` in the toolbar |

The engine does not branch on mode beyond `begin` scope and commit trigger -
each mode is a policy table entry, not a code path. Gating:
`meta.editable?: boolean | ((row) => boolean)`, table-level `isRowEditable`,
generated lanes never editable.

"One row one form" beyond the grid: `edit.getForm(rowId)` is public, so a
consumer can render the *same* row form in a `renderDetails` panel, a drawer,
or a side panel - inline cells and the external form share values, dirty
state and errors, because they are the same `FormApi`.

### 9. Chrome

- **Edit lane** (`components/TMDataGridEditColumn.tsx`, `EDIT_COLUMN_ID =
  "__edit__"`, phase 2): built like `createSelectColumn` /
  `createDetailsColumn` but **pinned right** - the left-pinning block in
  `useTMDataGrid` gains its mirror. Added to `isControlColumn`. Contents by
  row state: pencil (idle, row mode) → ✓ Save / ✕ Cancel (editing - the save
  button at the end of the row) → `Loader` (isSubmitting) → red tooltip
  listing errors including row-level ones.
- **`TMDataGrid.EditActions`** (phase 3): toolbar Save/Discard with dirty
  count, greyed while nothing is dirty - all read from `edit.state`.
- **Cell markers**: `data-editing`, `data-dirty`, `data-invalid` on
  `TMDataGridBodyCell`, styled beside the existing `data-focused` ring.

### 10. New rows, deletion, and the sticky entry block - phase 4

**Deletion** is the easy half. `edit.deleteRow(rowId)`: under the immediate
modes (`cell`, `cellConfirm`, `row`) it calls `onRowDelete({ rowId, row })`
straight away - confirmation is the consumer's business. Under `"batch"` it
records the id in `edit.state.deletedRowIds`; the row renders struck-through
and inert (`data-deleted`), and `submitAll` reports it in `deleted`. The edit
lane shows a trash icon whenever `onRowDelete` is set.

**Adding is the hard half, and the plan's biggest risk.** A new record is not
in `data`, so TanStack has no `Row` for it - and the cheap fix (have the
consumer prepend a blank record to `data`) is wrong: that row is then subject
to filtering and sorting, so the line being typed into can vanish
mid-keystroke. Instead:

- **A second, tiny table instance** over `edit.state.newRows` - same
  `columns`, its own `useTable`, no sorting/filtering exercised. Real `Cell`
  objects, so the editor host, `meta.type` editors and validators all apply
  unchanged. Mounted only while a new row exists.
- Each new row is just a `FormApi` with `defaultValues` from the consumer's
  `newRowDefaults` - the engine does not distinguish it until commit, which
  calls `onRowAdd({ value })` (immediate modes) or joins `submitAll`'s
  payload (batch). A new row is a form with no backing row yet.
- The block renders **sticky under the header**
  (`components/TMDataGridPinnedRows.tsx`) - the one place stickiness is
  genuinely required. Purpose-built for entry rows this pass; a general
  `pinnedRows` API (arbitrary rows pinned top/bottom) is a possible later
  extension of the same block, not part of this plan.

Two structural bits the block needs:

- **Header height** - never measured today (`position: sticky; top: 0`). A
  `ResizeObserver` on the header row publishes `--dg-header-height`, mounted
  only while the block is in use - the same discipline `renderDetails`
  applies to `measureElement`.
- **A stated z-index ladder** replacing today's hardcoded `2`/`3`:

  | Layer | z |
  | --- | --- |
  | Body cell | 0 |
  | Pinned column | 2 |
  | Pinned row | 4 |
  | Pinned row × pinned column | 5 |
  | Header | 6 |
  | Header × pinned column | 7 |

---

## Dependencies

`@tanstack/react-form` (^1.x) as **peerDependency + devDependency** - it
brings `@tanstack/form-core`, and itself rides on `@tanstack/react-store`,
already a peer. `zod` as a **devDependency only** (tests + example);
consumers bring their own Standard Schema library or none.

---

## Phases

Each ends green: tests, docs, brief changeset, committed to main.

| # | Ships | Size |
| --- | --- | --- |
| 0 | Widened `meta.type`, `meta.options`, `resolveColumnOptions`, new filter operators, filter panel renders Select/MultiSelect/date/boolean value controls | Medium - self-contained, valuable alone (backlog item 1) |
| 1 | Engine + `"cell"` mode: `editMode`, form-per-row, built-in editors, `meta.renderEditor` with the `field` contract, `meta.validate`, `meta.editable`, keyboard, dirty/error markers, `onEditCommit`; the example page (grid A) | Large - the core |
| 2 | `"cellConfirm"` + `"row"`, edit lane, `rowValidators`, row-level errors | Medium - policies + one lane over phase 1 |
| 3 | `"batch"`: `submitAll`/`cancelAll`, `TMDataGrid.EditActions`, `onEditCommitBatch` | Small - the engine already accumulates |
| 4 | Add/delete: `edit.addRow`/`deleteRow`, `onRowAdd`/`onRowDelete`, `newRowDefaults`, the second table instance, sticky entry block, header measurement, z-index ladder, `data-deleted` | Large - the riskiest; the second table instance and the sticky block are new ground |

Phases 0–3 are a complete, shippable editing story on their own; 4 is
additive and lands last on purpose.

## Files

**New:** `core/editEngine.ts` (engine + edit store + diff; the pure heart),
`core/columnOptions.ts`, `components/TMDataGridCellEditor.tsx`,
`components/editors/*.tsx` (six), `components/TMDataGridEditColumn.tsx`,
`components/TMDataGridEditActions.tsx`, `components/TMDataGridPinnedRows.tsx`
(phase 4 sticky entry block), `src/docs/editing.md` (registered in
`docsPages.ts`), `src/examples/EditableGridExample.tsx`.

**Modified:** `useTMDataGrid.tsx` (options, engine wiring, right-pin block,
`TMDataGridColumnMeta`); `core/capabilities.ts` (`editing`, `editMode`,
`canEdit`); `core/filterOperators.ts` (types, operators, widened value);
`core/cellNavigation.ts` (`getNextEditableCell`); `core/columnUtils.ts`
(`EDIT_COLUMN_ID` in `isControlColumn`); `components/TMDataGridTable.tsx`
(editor rendering, key branches, cell attributes);
`TMDataGridFilterPanel.tsx` (typed value controls); module CSS; `index.ts`;
`router.tsx` + `AppLayout.tsx` (route and nav link for the new example);
docs pages. `examples/DataGridExample.tsx` stays as it is - editing gets its
own page.

### The editable example - `examples/EditableGridExample.tsx`

Its own route (`/editable-grid`) and nav entry, deliberately *not* piled onto
the existing example - that page already demos selection modes, grouping,
details and persistence, and an editing demo drowning in other chrome shows
nothing. The editable page keeps the rest of the grid near-default and groups
the edit features by what can share a grid without interfering:

| Grid | Demos | Why together |
| --- | --- | --- |
| **A - inline editing**, with a `SegmentedControl` switching `editMode: "cell" \| "cellConfirm"` | All six built-in editors across typed columns, per-column Zod `meta.validate`, `options: "faceted"` on a select column, dirty markers, keyboard entry | The two cell modes differ only in commit trigger - same columns, same validators, one option flips. Switching modes cancels open forms (worth demoing in itself). Selection/grouping left off: group rows aren't editable and only add noise. |
| **B - row editing** (`editMode: "row"`) | The edit lane (pencil → save/cancel), `rowValidators` with a cross-field `.refine()` landing on the row, and a **custom `renderEditor`** - a salary editor with a slider, or a custom date input - showing the `field` API in consumer hands | Row mode is where cross-field validation means something, and where a custom editor sits naturally beside built-ins in the same row. |
| **C - batch + rows in/out** (`editMode: "batch"`, phase 3–4) | `TMDataGrid.EditActions` with dirty count, drafts across a filter change, add-row entry block, delete with strike-through, one `submitAll` payload logged | Batch chrome and add/delete share the "nothing commits until you say so" story; mixing them into A or B would blur which gesture commits. Pagination optionally on, to show dirty rows surviving a page flip. |

What never shares a grid: two `editMode`s at once (one axis), and
grouping+editing (group rows sit out editing; a demo would mostly show cells
refusing to open).

**Noticed, not in scope:** `features.md` documents `rowSelectionMode` /
`highlightSelectedRows` where the code says `selectionMode` /
`showSelectedBackground` - separate one-line fix.

---

## Verification

**Unit (`npm test`)** - pure core first, per house style:

- `editEngine.test.ts` - form survives the row unmounting (assert on
  `edit.state` + `getForm` after a simulated scroll: the virtualization
  claim, tested directly); begin/commit/cancel lifecycles per mode; diff
  computation incl. nested paths; commit blocked by field and by row errors;
  reject keeps the form open; a real Zod schema end-to-end (zod as devDep).
- `columnOptions.test.ts` - three source forms, string normalisation,
  faceted, row-dependent options.
- `cellNavigation.test.ts` - Tab wrap + skipping non-editable columns.
- `filterOperators.test.ts` - new operators, array-valued filters.

**Component (RTL via `renderWithMantine`)** - F2 opens, Escape reverts, Tab
commits and lands on the next editable cell, invalid input blocks commit and
shows the message, `"cellConfirm"` keeps the draft on blur, row mode commits
every cell at once.

**Manual (`npm run dev`)** - the drill: draft survives a 500-row scroll
round-trip; keyboard-only pass (Tab in, arrows, F2, edit, Tab across, Escape
out); cross-field `.refine()` lands on the row; faceted select shows the same
list in filter panel and editor; batch saves a dozen rows in one call;
sort/filter/group/pin with a draft open; add a row, type into it, scroll -
the entry block stays put under the header; delete a row in batch - struck
through until `submitAll` reports it.

**Lint** - `npm run lint` before each commit.

# Plan: committed rows as data, not forms

Branch `feat/draft-store-as-data`, based on `claude/batch-row-commit-perf-ymwakd`
(commit `f2d4fae`, "fix: import thousands of rows into the draft store in one
publish"). Written 2026-09-17 as a hand-over: the thread that produced it
cannot be resumed, so everything needed is here. Delete this file in the PR
that lands the work; the outcome goes into `BACKLOG.md` under Done.

Realistic target: 10 000 - 20 000 rows in the draft store. Not 500k - at that
size TanStack Table's client-side row model is the ceiling, not the engine.

## 1. Where things stand

`packages/tmdatagrid/src/core/editEngine.ts` is the edit engine. After the
performance branch:

- The engine keeps its state in a private `working` object (maps and sets)
  and materializes it into `store` (a `@tanstack/store` `Store`) through
  `publish()`, rebuilding only the slices marked in `dirty`. `held(body)` /
  `heldSync(body)` hold the publish across a batch, so `addRows`,
  `commitAll`, `saveDrafts`, `cancelAll` and `deleteRows` render the grid
  once. `staleRows` collects forms whose projection (`project(entry)`) must
  be rebuilt at the next publish; `publishRow(rowId)` is what a form's store
  subscription calls.
- Forms are no longer `mount()`ed (that was TanStack Form devtools wiring:
  three `window` listeners per form). `createForm` runs
  `form.validateSync("mount")` itself when `rowValidators.onMount` is set.
- A parked (= committed, see below) batch validates concurrently:
  `addRows` under `draft` uses `Promise.all` over `commit(tempId)`;
  `saveDraftsInner` uses `Promise.all` over `form.handleSubmit()` and then
  puts the payload back into `committedIds` order. TanStack Form runs a
  submit's async validators off `setTimeout`, so a sequential loop was a
  timer per row (browsers clamp nested timers to 4 ms).
- Measured in jsdom with the whole grid rendered, 10k rows:
  import+commit 1.2 s (was ~10 min), `saveDrafts` 0.9 s (was 12.4 s),
  `cancelAll` 0.25 s.
- Every row in the draft store still holds a live TanStack `FormApi`,
  measured at ~8.3 kB each for a 12-field row: ~80 MB at 10k rows.

Vocabulary: the code says **park** / `parkOnly` for what the docs and the
stakeholder call **committed** - the row passed validation, the user left it,
it waits in the draft store for Save. Same state. Prefer "committed" in
anything new; leave existing identifiers alone unless touched anyway.

## 2. The change

**Invariant: committed => validated.** A form is editor state for an *open*
row. A committed row is data. Errors exist only on open rows.

| Event | Today | After |
| --- | --- | --- |
| Commit passes | form kept in `forms`, `entry.committed = true`, values snapshotted into `working.committedValues` | snapshot `{ original, values, dirtyFields, isNew }`; **drop the form** (`unsubscribe`, `forms.delete`) |
| Commit fails | row stays open, errors on its form | unchanged |
| Save | `form.handleSubmit()` per committed form: re-runs column + row + table validators, the wrapped `onSubmit` pushes into `draftCollector` / `draftAddCollector` | run **only `editing.tableValidators`** over the stored values (`runTableValidators(values, rowId, isNew)`); no table validators configured => no validation at all. Build the payload from the snapshots. A row that fails is **demoted**: create a form from the snapshot, plant the error, mark it open |
| `rowValidators` | run by the form at commit and at Save | run by the form at commit only. Never at Save - values cannot have changed, so the answer cannot. No transient forms needed |
| Reopen: `begin` on a committed row, `setCellValue` / `setRowValues` / `clearCell` on one, `edit.getForm` | reuses the kept form | `createForm(rowId, original, isNew)` from the snapshot, then set the values so the form is dirty; the row leaves the committed set. `getForm` returns `undefined` for a committed row |
| Server refusal (`onSaveDrafts` result names an id `false`) | row stays committed | unchanged - retried from the snapshot |
| Entry rows | the entry block reads `edit.getForm(tempId)?.state.values` for committed sticky rows | read `state.committedValues[tempId]` |

Why Save re-validates only table rules: column rules (`meta.edit.validate`)
and row rules (`rowValidators`) see the same values at Save as at commit.
Table rules see *other* rows, which may have been committed since - "no
duplicate names", "allocations sum to 100 %" - and re-checking every committed
row at each commit would be O(N) per commit. One pass at Save is the cheap
contract, and `docs/editing.md` already documents it that way ("run at every
commit, and again per parked row during `saveDrafts`").

Wins: ~80 MB -> a few MB at 10k rows; the draft store becomes plain data,
which is what a later "keep unsaved drafts across a reload" feature needs;
Save with no table validators is a pure copy; one clear model.

## 3. Engine work, in order

All in `editEngine.ts` unless said otherwise. Names refer to the `const`s
inside `createEditEngine`.

1. **Snapshot type.** Add to the engine's private state:
   ```ts
   type Committed = {
     original: TMDataGridRowData;   // the data row, or the entry row's seed
     values: TMDataGridRowData;     // what `committedValues[rowId]` holds
     dirtyFields: Array<string>;    // diff(original, values) at commit time
     isNew: boolean;
   };
   const committed = new Map<string, Committed>();
   ```
   `working.committedValues` can stay as the published view, or be derived
   from `committed` at publish; keep `working.committedRowIds` (existing
   rows) and `working.newRows` (entry rows: `tempId -> committed flag`) as
   they are - the public state shape does not change.
2. **`diff`** currently takes a `FormEntry`; change it to
   `diff(original, values)` so it works on snapshots. Same for anything
   else that only needs `entry.original`.
3. **`commit`**, in the `entry.parkOnly` branch after a successful
   `handleSubmit`: build the snapshot from `entry.form.state.values` and
   `entry.original`, store it, set the committed flag as today
   (`setNewRowCommitted` / `setCommitted` - both call `snapshotCommitted`,
   which now reads the snapshot instead of the form), clear `active` if it
   is this row, then **drop the form** without touching the committed
   flags: today `drop()` also removes the row from `committedRowIds` /
   `newRows` / `committedValues`, so either split `drop` into
   "release the form" and "forget the row", or add a `releaseForm(rowId)`
   used here. `openRowIds` keeps listing committed rows (public doc:
   "every row the grid is holding work for") - it is built from
   `forms.keys()` today, so build it from `forms.keys()` plus the committed
   ids, in a stable order (the order the rows entered).
4. **`project`** is form-based. Committed rows need an entry in
   `state.rows` too - cells and the edit lane read `state.rows[rowId]` for
   the dirty corner and `data-dirty`. Add `projectCommitted(snapshot)`:
   `{ dirtyFields, errorFields: [], errorMessages: [], hasRowError: false,
   isSubmitting: false, values }`. Publish it when the snapshot is
   created; it never goes stale.
5. **`saveDraftsInner`**, the `onSaveDrafts` path: replace the
   `handleSubmit` loop with, per committed id: `runTableValidators(values,
   rowId, isNew)`; on a validation error, demote (step 7) and set
   `allValid = false`; otherwise push
   `{ rowId, value: values, original, changes: diff(original, values),
   source: getContext().editMode }` into `collected` for an existing row,
   `{ tempId, value: values }` into `added` for an entry row. The
   `draftCollector` / `draftAddCollector` globals and the collector branch
   in the wrapped `onSubmit` become dead - remove them. Order is
   `committedFormIds()` order; rename that to `committedIds()` and have
   it read the snapshot map.
   The default path (no `onSaveDrafts`, per-row `onEditCommit` /
   `onRowAdd` loop) today re-commits each form with `savingDrafts = true`;
   rewrite it to call the consumer callbacks straight from the snapshots,
   same validation rule, then forget the row on success.
6. **Dropping saved rows** after a resolved save: today `drop(rowId)`; now
   forget the snapshot and its flags (no form to release).
7. **Demote(rowId, error)** - new helper for a committed row that fails at
   Save: `createForm(rowId, snapshot.original, snapshot.isNew)`, set each
   field of `snapshot.values` (`form.setFieldValue`), remove the row from
   the committed set (`setCommitted(rowId, false)` /
   `setNewRowCommitted(tempId, false)` - note these keep
   `committedValues`, which is intentional: the table keeps showing the
   last decided values until the next decision), then plant the error:
   pathed issues via `entry.submitErrors` (the shape `takeFieldErrors`
   produces, kept by `project`), a pathless one via
   `form.setErrorMap({ onSubmit: message })`. Mirror `mergeSubmitResults` /
   Form's `{ form, fields }` shape when reading the table validator's
   result.
8. **`beginOn`** on a committed row (existing or entry): create the form
   from the snapshot as in step 7 but with no error, then `setActive`.
   Today the entry-row branch flips `entryForm.committed = false`; the
   form no longer exists, so the branch keys off `committed.has(rowId)`.
9. **`writeFields`** (`setCellValue`, `setRowValues`, `clearCell`): today
   `forms.get(rowId) ?? createForm(rowId, row.original, false)`. For a
   committed row, build the form from the snapshot instead (values, not
   `row.original` - `row.original` *is* the snapshot's values under the
   hook's overlay, but `original` must stay the data row so `changes` is
   right).
10. **Reads**: `getRowValues`, `getRows`, `mergedRows` - form first, then
    snapshot, then the table row. `mergedRows` is what table validators
    see; it must include committed entry rows from the snapshot map.
11. **`cancel(rowId)`** on a committed row: forget it (today `drop`).
    **`cancelAll`**: clear the snapshot map too. **`deleteRow`** on a
    committed entry row: forget it (today `drop`, guarded by
    `entry?.isNew`). **`commitAll`** is unchanged - it only touches open
    forms.
12. **`getForm`**: `forms.get(rowId)?.form` - already `undefined` for a
    row with no form; nothing to change, but it is now the visible API
    change (section 5).

## 4. Component work

- `packages/tmdatagrid/src/components/TMDataGridEntryRows.tsx`: the `data`
  memo reads `edit.getForm(tempId)?.state.values` for committed rows and
  `options.defaultValues` for open ones. Committed -> `state.committedValues[tempId]`
  (select it alongside `newRows`). Open rows keep reading the form.
- `packages/tmdatagrid/src/components/TMDataGridEditColumn.tsx` ~line 115
  reads `edit.getForm(rowId)?.state.errors` for the lane tooltip. Only
  meaningful on an open row; a committed row has no errors by the
  invariant, so `undefined` is fine - check the fallback text.
- `packages/tmdatagrid/src/components/TMDataGridCellEditor.tsx` reads the
  form for the cell it edits - always an open row. No change.
- `TMDataGridDraftActions.tsx`: `isSubmitting` is
  `openRowIds.some(id => rows[id]?.isSubmitting)`. Committed projections
  say `false`; during `onSaveDrafts` it was already `false` today
  (`handleSubmit` resolved before the consumer call), so no visible change.
  `saveInFlight` guards the double click.

## 5. Public API impact

| Surface | Change |
| --- | --- |
| `edit.getForm(rowId)` | `undefined` for a committed row (was the form). A drawer over a parked row calls `begin` first. Breaking; 2.0 is in changesets pre mode (beta), so a `minor` changeset with a "breaking" line |
| Save re-validation failure | the row becomes open again with the error (was: stayed committed with errors on its form). Only `tableValidators` can cause it now |
| `rowValidators` | contract unchanged; simply not run at Save |
| `state.rows[id].isSubmitting`, form meta (`isTouched`) surviving a reopen | gone for committed rows; nothing reads them |
| `state` shape, `getOpenRowIds`, `openRowIds` semantics | unchanged |

Docs to edit: `packages/tmdatagrid/docs/editing.md` - the engine table row
for `getForm` (~line 496), the "render it in a drawer" paragraph (~line
505), the draft-store section where re-validation at Save is described
(~lines 101-140 and the `tableValidators` paragraph), and the "Importing
rows" paragraph added on the perf branch (the "budget about 8 kB of heap per
row" sentence goes). `packages/tmdatagrid/docs/editors.md` ~line 173 reads
`edit.getForm(rowId)?.state.errors`. `SKILL.md` files cite these pages by
path - no path changes, so no `sources:` edits. Changeset under
`.changeset/`, `"@jielga/tmdatagrid": minor`, short.

## 6. Tests

`packages/tmdatagrid/src/core/editEngine.test.ts` (105 tests, 86
`getForm(` calls). Most `getForm` calls are on open rows and stay. Expect
15-25 tests that read a committed row's form to need rewriting - search
for `getForm` near `commit(`, `saveDrafts`, `committedRowIds`. Component
suites: `TMDataGrid.editing.test.tsx`, `TMDataGrid.editModes.test.tsx`,
`TMDataGridCellEditor.test.tsx`. Then add:

- commit drops the form: `getForm` is `undefined`, `committedValues` and
  `state.rows[id].dirtyFields` are right, `openRowIds` still lists the row.
- reopen restores an editable form seeded with the committed values, and
  `changes` at the next commit diffs against the data row, not the draft.
- Save with no `tableValidators` runs no validator (spy on a column
  schema's `~standard.validate` or a `rowValidators.onSubmit` mock: not
  called at Save).
- Save with a table rule that a later commit broke demotes the earlier row:
  it is open, `hasRowError` / `errorFields` set, Save resolves `false`, the
  valid rows were sent.
- the draft store is serializable: `JSON.stringify(edit.state)` round-trips
  `committedValues`, `newRows`, `deletedRowIds`.
- `setCellValue` on a committed row reopens, writes and commits it again,
  ending with no form.
- the three perf tests from the branch still pass unchanged ("one publish
  for the whole import", "saveDrafts sends an import in the order it
  committed", "a table validator during an import sees the rows imported
  with it").
- `apps/docs/src/examples/demos.test.tsx` mounts every demo - run it.

## 7. Verification

From the repo root: `bun install`, then `bun run lint`, `bun run typecheck`,
`bun run check:skills`, `bun run test`, `bun run build:lib` - the pre-commit
hook runs all of these plus the changeset check. Run intent through
`node scripts/intent.mjs`, never `npx intent`. Load the local skill first:
`node scripts/intent.mjs load @jielga/tmdatagrid#editing`.

Benchmark harness (deleted from the branch; recreate under
`packages/tmdatagrid/src/core/` as a `*.test.tsx`, delete before commit):
render `<TMDataGrid>` with `TMDataGrid.DraftActions` and `TMDataGrid.Table`
over `makeRows(5000)` from `test/gridHarness.tsx`, `editing: { mode: "row",
draft: true, onSaveDrafts: () => {}, newRowDefaults }`, then inside
`act(async () => …)` time `edit.addRows(10_000 rows, { commit: true })`,
`edit.saveDrafts()`, `edit.cancelAll()`; write timings with
`process.stderr.write` (vitest swallows `console.log`). Reference numbers on
the base branch: 1.2 s / 0.9 s / 0.25 s. Memory: a plain node script that
creates 10k `FormApi`s with `--expose-gc` and `process.memoryUsage()` gave
8.3 kB/form; after this change measure `edit.state` instead and expect a
few MB. jsdom facts: no layout, so assert on `aria-rowcount` /
`gridRowCount()`, never on rendered row count; render inside
`MantineProvider env="test"` (the harness does).

## 8. Open decisions

1. `getForm` on a committed row: `undefined` (this plan) versus a form
   built on demand. `undefined` keeps the invariant honest; on-demand would
   silently reopen the row or hand out a form nothing tracks. Recommend
   `undefined`.
2. Demotion is a visible UX change at Save. Recommend keeping it: a row a
   later edit invalidated is exactly what the user has to fix, and leaving
   it "committed with errors" was the state this plan removes.
3. Whether to keep `original` for entry rows as the seed
   (`newRowDefaults` merged with the `addRow` values). The `created`
   payload is `{ tempId, value }` only, so it is used for the dirty corner
   alone. Keeping it costs nothing.

## 9. Not in scope

- Persisting drafts across a reload. This change makes it possible
  (`edit.state` becomes JSON); it is its own feature with its own API.
- 500k rows. TanStack Table's row model, sorting and filtering are O(N)
  per state change; the practical client-side ceiling is ~100k. Beyond
  that: `manualPagination` / `manualSorting` / `manualFiltering` and a
  server-side import.
- Making `committedValues` / `rows` cheaper to publish than an O(N)
  `Record` rebuild. Fine at 20k (a few ms); would need a public state
  shape change beyond.

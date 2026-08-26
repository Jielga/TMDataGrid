# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. This file is the tracker: what is planned, held, done and
iceboxed.

## Planned

**Held** - the only work with a decision still outstanding. Nothing here
starts without the stakeholder's go.

- H3 - bad-UX warning framework. One dev-only idiom for "legal, but probably
  not what you want", replacing today's ad-hoc warnings: a rule carries a
  message and a docs link, and `acknowledgeUx?: ReadonlyArray<string>`
  silences one by key, keys being permanent once published. Opinions only - a
  misconfiguration such as `editMode` without `getRowId` stays a hard error.
  Folds in the existing `onReachEnd`-with-pagination warning and the
  frozen-controlled-slice one added for #39; the first new rules are
  `detailsTrigger: "rowClick"` against a selection mode where a row click
  already acts, and unstable `data` identity, which the v9 beta's
  `autoResetExpanded` turns into a render loop.
- H4 - details ergonomics (`detailsTrigger`, `detailsMode`). Wants H3 shipped
  first for its rule.
- H7 - warning severity for validation. Raised 2026-08-27 (tariff desk):
  validation is binary today, so "unusual, are you sure" - the second class
  every pricing or budget grid has - is rebuilt by hand per consumer without
  the corner marker, tooltip or store projection. A `severity: "error" |
  "warning"` on an issue reuses the whole pipeline: amber corner, same
  tooltip, `warningFields` beside `errorFields`. Related to H3 in name only -
  H3 is dev-time misconfiguration, this is end-user data.

**Parked** - U1, container-based column visibility (`meta.hideBelow`). Called
past 1.0.0 on 2026-08-01.

## To explore later

- Loading vocabulary (skeleton rows, toolbar progress, `isSaving` spinners) -
  needs hands-on play before speccing.
- Cell-level styling (`meta.cellStyle`, `meta.cellClassName`) - the cell
  counterpart of `rowStyle` / `rowClassName`, applied to the cell element
  rather than to what a `cell` renderer puts inside it. Raised by a test
  consumer 2026-08-26: colouring a value today means a wrapper component
  repeated in `cell`, `aggregatedCell` and `footer`, and it colours the glyphs,
  so it cannot reach the cell's background layers the way `rowStyle` does. AG
  Grid's `cellClassRules` is the reference. Wants the same CSS-variable
  vocabulary as the row hooks so it composes with the draft and selection
  layers rather than fighting them.
- Paste into a cell range - raised by a test consumer 2026-08-27 (depot
  maintenance board). Cell selection has a range, Ctrl+C and CSV export;
  paste is the missing half. `edit.setCellValue` already validates and parks
  a programmatic write, so this is composition rather than new machinery.
- Multi-row `edit.setValues` - the batched sibling of `setRowValues`: one
  store write and one flush for N rows, results per row as `addRows` reports
  them. A loop of `setCellValue` works today; this is the scaling question.
- Pinning ergonomics - a column cannot declare its own initial pin, and
  `initialState.columnPinning` takes TanStack's full `ColumnPinningState`,
  so the partial `{ left: [...] }` a consumer tries first does not compile
  while `initialState: { grouping: [...] }` teaches that partials are fine.
  Raised 2026-08-27.
- Type the `meta.options` function form - `row.original` arrives as
  `unknown` although the callback sits on a `TData`-bound column helper, so
  the docs show a cast. Making the callback generic removes it. Raised
  2026-08-27.
- `meta.edit.enabled` reads `data`, not the pending draft - a gate that
  depends on a field being edited runs a render behind. Predicted by a test
  consumer 2026-08-27, not hit. Also untyped: `row.original` arrives as
  `unknown` although the helper is `TData`-bound, same fix as the
  `meta.options` item above.
- Tree lane width - the generated group column is a fixed ~250px, pinned
  left, and no option or CSS variable narrows it. Raised by two test
  consumers 2026-08-27; one dropped `columnPinning` because the lane had
  spent the width. `--dg-group-column-width`, or `groupColumn: { size }`.
- `table.options.meta` as a consumer-extensible channel - columns are module
  scope, so a cell renderer has no supported way to read page state; `meta`
  is the natural channel but the docs only name `loading`, `totalRowCount`
  and `rowHeight`, and whether consumers may add keys (and how to type them)
  is uncommitted. Raised 2026-08-27. Deciding yes is one docs paragraph plus
  declaration merging.
- Draft-aware aggregates - `aggregatedCell` and `footer` read `data`, so a
  grouped total cannot show the pending split while a batch is held. An
  `aggregateColumn`-style helper overlaying `edit.store`'s values would let a
  consumer render the pending total anywhere. Raised 2026-08-27; what would
  make a `tableValidators` group rule visible on the group row.
- `edit.commitAll()` resolving `{ committed, open }` the way `addRows` does -
  today one boolean for the batch, so "3 approved, 1 blocked" needs a
  hand-rolled loop over `commit(rowId)`. Raised 2026-08-27.
- `edit` (or its store) in `TMDataGridEditorArgs` - a custom editor showing
  "the total this flag would land on" can only reach saved siblings through
  `table`, so its hint is stale while a sibling row is drafted. Raised
  2026-08-27.
- Pathless row-error text in the store projection - the lane's tooltip shows
  it, but `edit.store` only carries `hasRowError: boolean`, so a custom error
  surface has to reach into `getForm(rowId).state.errors`. A `rowError:
  string | null` beside `errorMessages` keeps the store the single read
  surface. Raised 2026-08-27.
- `SummaryCount` counts group rows in the numerator (`48 / 42` under six
  groups) while the denominator counts records. Flagged by two test
  consumers 2026-08-27; documented as-is for now. Decide: exclude group rows,
  or keep and leave the docs sentence.
- A range column type - `meta.type: "dateRange"` (and a numeric sibling).
  The editor is small; the filter operators (overlaps, contains, within) are
  the part nobody wants to write twice, and `meta.type` already couples
  editor, control and operators. Raised 2026-08-27.
- A header-group edit gate - locking a locale/group means repeating the same
  `meta.edit.enabled` predicate per leaf column. A gate on
  `columnHelper.group`, or a documented pattern. Raised 2026-08-27.
- An unfiltered `aggregateColumn` - the summary row follows the filters by
  design, but a desk often wants both "filtered sums to 34%" and "the book
  sums to 100%"; the second is computed outside the grid today. An
  `unfiltered: true` option. Raised 2026-08-27.

## Done

**Cross-row validation (H6)** - **done 2026-08-27**.
Raised independently by two test consumers (traffic split, tariff desk).
`editing.tableValidators` takes `onSubmit` / `onSubmitAsync`, each handed
`{ value, rowId, isNew, rows }` where `rows` is the collection as it would
stand if the commit landed: every draft overlaid, entry rows appended,
deletion-marked rows removed - the scaffolding both consumers had hand-rolled.
Same result vocabulary as `rowValidators`; errors land on the committing row.
Folded into the composed submit pass, so it runs at every commit and re-runs
per parked row during `saveDrafts` - the save gate came free. Scope cut from
the sketch: no `groupValidators` sugar (a `rows.filter()` is the group rule)
and no group-row marking, which wants draft-aware aggregates (To explore).

**Density (H5)** - **done 2026-08-27**. Closed as recipe, not feature: the
size scale and its recipe are on [styling.md](src/docs/styling.md) and
`getting-started/DensityAndLayout.tsx` is the runtime toggle, both shipped
with the docs restructure. The last piece landed 2026-08-27: a live `size`
change now calls the virtualizer's `measure()`, with a test pinning that the
row-height estimates follow - they did not before, since TanStack Virtual's
measurement cache does not list `estimateSize` among its dependencies.

**Programmatic edits and a column allowlist** - **done 2026-08-26**.
From a test consumer's report on building a rebalancing desk from the skills
alone. `edit.setCellValue` / `edit.setRowValues` write through the engine, so a
toolbar action lands in the draft store as a typed edit does; the three-call
`begin` + `getForm(…)?.setFieldValue` + `commit` sequence it replaces was never
reliable, since `begin` defers in `"cell"` mode when another row is open.
`editing.columns` names the editable columns instead of switching every other
one off. `edit.isColumnEditable` answers the column's half of the rule.
Alongside: `aggregateColumn` reads `flatRows` so a `getSubRows` tree totals its
children, and the `number` editor no longer writes `NaN` for partial input.

**DraftActions scroll to row** - **done 2026-08-26**.
Closes [#46](https://github.com/Jielga/TMDataGrid/issues/46). `renderActions`
gains `state.openRowIds`, `actions.scrollToRow` and
`actions.scrollToFirstOpenRow(align?)`, so a toolbar can return the user to a
row left undecided on a grid too long to find it by scrolling. `openRowIds` is
the engine's order and the scroll is display order, resolved at the click:
ordering only matters then, and pinning it to the state would have put a
`table.store` subscription on chrome that otherwise only watches edit state.
`Controls.OpenRowsNote` stays a label. Fixed along the way: the slot-args table
in the docs was two features behind, and `scrollerRef` was documented as the
scroll container element, which it has never been.

**Partial draft saves** - **done 2026-08-26**.
Closes [#33](https://github.com/Jielga/TMDataGrid/issues/33). `onSaveDrafts`
returns a result naming the ids that failed; they keep their drafts, committed,
and the rest are cleared. The payload keys are renamed to `updated` / `created`
/ `deleted`, with the old `rows` / `added` still filled and deprecated. Rows
carry `data-draft` while parked in the store; the grid paints nothing, so
highlighting is `rowStyle` or the attribute.

**Controlled `state` passthrough** - **done 2026-08-25**.
Closes [#39](https://github.com/Jielga/TMDataGrid/issues/39). TanStack compares
`options.state` slices by identity on every render, so a slice object built in
the render body caused an infinite render loop. The grid now forwards the
previous render's value for unchanged slices, warns in development about a
controlled slice without its `onXChange`, ignores `undefined`-valued keys, and
keeps the generated columns and the tree column's entry out of a controlled
`columnVisibility`.

**Draft store and the commit/save split (2.0)** - **done 2026-08-25**, breaking.
Closes [#35](https://github.com/Jielga/TMDataGrid/issues/35). Draft mode now
holds a real draft store, so a row is *open* (undecided form state) until it is
committed and only committed rows are saved. `edit.commitAll()` submits every
open row, `edit.saveDrafts()` sends the store, and `edit.submitAll()` is the
deprecated pair of the two; `onCommitDrafts` became `onSaveDrafts` and
`newRows[].confirmed` became `committed`. `edit.addRow(values)` seeds one entry
row and `edit.addRows(rows, { commit })` adds a batch, committing each as it
lands - the import case the issue asked for. Fixed along the way, and the
reason the import case needed it: `meta.edit.validate` only ran on a mounted
editor, so a commit with nothing on screen wrote past the column rules; the
engine now runs them itself.

**Draft mode (2.0)** - **done 2026-08-24**, breaking. `editMode: "batch"`
became `editing.mode: "draft"`, reworked: held drafts render their values
through the cell renderers, entered new rows stay as value rows (scrolling by
default, `newRowsSticky` pins them), the edit lane carries a per-row state
icon and revert/restore/remove, and nothing reaches a callback before Save
all. `onCommitBatch` became `onCommitDrafts`; the rename table is in the
changeset. Fixed along the way: Restore on a deletion-marked row was
unclickable in real browsers.

**Versioned documentation** - **done 2026-08-21**, corrected the same day.
The docs site publishes several complete builds under one Pages root, held on a `gh-pages` branch: the newest release at the root, the tip of main at `next/`, one directory per minor line at `v1.1/`, and previews at `b/<branch>/` while a pull request carries the `docs-preview` label.
The header's version badge became the menu that moves between them, carrying the page you are on across.
What a run publishes is decided against the branch's own state rather than against git history, so a run is idempotent and a missed line is picked up by the next push.
Copies built before the menu existed get a standalone one injected, which is what keeps an older release reachable when that is what the root serves.

The first deploy left the site's entry point answering 404.
Mirroring to the root required a stable release, the 2.0 prerelease wave produces none, and the manual seeding run meant to cover the gap was never made, so `next/` and `v2.0/` were the only copies and nothing served the root.
An empty root now takes whatever a run is publishing, the decision moved into `scripts/docs-plan.mjs` as a pure function with tests, and the two deploy scripts share one prerelease-aware comparison so a stable release can take the root from the prerelease it led up to.

Two steps are left, both wanting repository access rather than a commit: `v1.0` and `v1.1` have never been published and want a `workflow_dispatch` each, and pull request previews cannot deploy until the `github-pages` environment allows branches other than `main`.

**Editing options namespace (2.0)** - **done 2026-08-22**, breaking. The flat
editing options of `useTMDataGrid` moved under one `editing` object:
`editMode` became `editing.mode`, `onEditCommit`/`onEditCommitBatch` became
`editing.onCommit`/`editing.onCommitBatch`, and the rest moved in unchanged.
The two cross-option rules - `getRowId` required with `editing`, and
`onCommitBatch` batch-only - stay compile errors, now local to the object
instead of a three-branch union across the whole options bag. The docs'
"What requires what" matrix reduced to two sentences.

**Column meta namespaces (2.0)** - **done 2026-08-20**, breaking. `meta.edit`
and `meta.filter` group the fields belonging to those stages, leaving `label`,
`type`, `options`, `flex`, `align`, `autoSize` and `enableOrdering` at the top
level; `type` and `options` stay shared because both stages read them. Shipped
with `meta.edit.mapValue`, which maps a value per write on its way into the
draft, and with the removal of the deprecated `TMDataGridEditorArgs.autoFocus`.
The rename table is in the changeset for the release. Entry rows gained the
caret placement body rows got in 1.1.1, which the `autoFocus` path had only ever
given the built-in editors.

**The 1.0 wave** - competitor-scan adoption, decisions settled 2026-08-01.
Batches A–D landed 2026-08-01 and H1 on 2026-08-09, on `feature/next`,
released as **1.0.0**.

- Batch A - docs repair, Changesets pre-mode, persistence version marker and
  slice realignment, Reset layout, CSS layer packaging. The `keyof T` typing
  check closed void.
- Batch B - per-row styling (`rowStyle`, `rowClassName`, `striped`), cell
  click handlers, row numbers lane.
- Batch C - `?: never` prop unions, scroll-edge shadows with the
  `onScrollTo*` callbacks, empty-state slot.
- Batch D - row pinning; fuzzy quick search as the default, with filter match
  highlighting.
- H1 - custom filter controls by direct component reference, plus the four
  built-in ones; no registry.

**Docs restructure** - **done 2026-08-16**, released with **1.0.2**. One page
per touchpoint: the docs and examples trees became one tree of 25 pages, each
demo living inside the page that explains it behind a ` ```demo ` fence, with
heading ids, a table-of-contents rail, `Ctrl+K` search and a `/docs` card
index. Every old `/examples/*` route redirects. The styling contract page
landed as part of it, as [styling.md](src/docs/styling.md).

**Intent skills** - **done 2026-08-17**, released with **1.0.2**. Twelve
skills, one per docs topic, replacing the six that mirrored the old docs
shape.

**API coherence (H2)** - **done 2026-08-18**, breaking. Every render surface is
a `render*` prop over one typed args object; the Footer's pager and
`EditActions` became slots over `{ state, actions, Controls }`; the column and
row context menus hand back the grid's own items through `internalItems`. The
complete rename table is in the changeset for the release.

**Showcase pass** - **done 2026-08-10**, ahead of the rest of the wave. 24
topic pages and 35 focused demos, each with its own source; the kitchen sink
survives as `/playground`. The topic pages were folded into the docs tree by
the restructure above; the demos stayed. From here a user-facing feature ships
with its demo, the way it ships with a changeset.

**Shipped 2026-07-31**, one commit per step (see git log):

- **Cell editing** - phases 0–4: column types boolean/date/select/multiSelect
  with typed filter operators and one shared
  `meta.options` source; the edit engine (one TanStack Form per editing row,
  drafts surviving virtualization); `editMode: "cell" | "cellConfirm" |
  "row" | "batch"`; built-in editors per type plus `meta.renderEditor`
  (since renamed `meta.editor`, a component);
  `meta.validate` / `rowValidators` via Standard Schema (Zod); the generated
  edit lane pinned right; `TMDataGrid.EditActions`; `edit.addRow`/`deleteRow`
  with the sticky entry block. `@tanstack/react-form` joined the peer family;
  docs in `editing.md` and `editors.md`.

- **Localization** - `labels` option merged over `TMDATAGRID_LABELS_EN`;
  every string and `aria-label` localizable; complete Swedish preset
  `TMDATAGRID_LABELS_SV` typed so a missing key is a compile error.
- **Toolbar slot + `TMDataGrid.LoadingIndicator`** - composition documented;
  a small spinner for refetches that keep rows on screen.
- **Global quick search** - `TMDataGrid.Search`, debounced into
  `globalFilter`; `canSearch` capability; hidden under
  `enableGlobalFilter: false`.
- **Multi-column sorting** - Shift+click appends (TanStack's
  `isMultiSortEvent`); priority badges beside the arrows.
- **Full-grid export** - `buildGridCellMatrix` / `exportGridToCsv` over every
  filtered row, all pages; no built-in button, recipe in the docs.
- **Summary row** - column `footer` definitions render as a sticky bottom
  row; `aggregateColumn` helper; stacking ladder stated as CSS variables in
  `TMDataGrid.module.css`.
- **Column autosizing** - double-click the divider, "Autosize column" menu
  item, `meta.autoSize`, exported `autosizeColumn`.
- **Infinite scroll** - `onReachEnd` on the Table, latched per row count;
  docs in server-side.md.

## Icebox

Known gaps, no decision to build:

- Column virtualization (all cells of a row mount today).
- Value-change flash (`meta.flashOnChange`, a `--dg-cell-flash-bg` variable) -
  a brief tint on a cell whose value moved. Raised by a test consumer
  2026-08-26 as the trading grid's most-asked-for feature, and the reason it is
  here rather than left to consumers: it needs previous-value tracking inside
  the row model, which nothing outside the grid can hold.
- Undo across the draft store. `revert-row` reverts one row and `discard-all`
  clears every draft; there is nothing between them, so a bulk write that
  touched five rows takes five reverts. Wants a real undo stack, which the
  engine has no notion of today.
- Row drag-reordering.
- Multi-range cell selection (explicitly scoped out in docs).
- Tree data from hierarchical source (`getSubRows` passthrough undocumented).
- RTL.

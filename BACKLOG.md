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
  Folds in the existing `onReachEnd`-with-pagination warning, the
  frozen-controlled-slice one added for #39 and the faceted-options-under-
  manual-mode one added 2026-08-31; the first new rules are
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
- H8 - cell-level styling (`meta.cellStyle`, `meta.cellClassName`). The cell
  counterpart of `rowStyle` / `rowClassName`, applied to the cell element
  rather than to what a `cell` renderer puts inside it. Raised by a test
  consumer 2026-08-26: colouring a value today means a wrapper component
  repeated in `cell`, `aggregatedCell` and `footer`, and it colours the glyphs,
  so it cannot reach the cell's background layers the way `rowStyle` does. AG
  Grid's `cellClassRules` is the reference. Wants the same CSS-variable
  vocabulary as the row hooks so it composes with the draft and selection
  layers rather than fighting them. Raised again 2026-08-28 by a third test
  consumer (portfolio rebalancer), where it was the largest gap in both the
  docs and the library, and the workaround - a tinted `<span>` inside `cell` -
  cannot reach the cell's edges.

**Parked** - U1, container-based column visibility (`meta.hideBelow`). Called
past 1.0.0 on 2026-08-01.

## To explore later

- Controlled state through `options.atoms` - the intended end state for the
  render-phase publish workaround shipped 2026-08-31: `controlledStateSync.ts`
  patches `table.store.subscribe` and defers notifications raised during
  `useTable`'s `options.state` sync. Owning each controlled slice as an atom
  removes that render-time sync entirely; when it lands - or when table-core
  fixes the publish timing upstream - the patch and the begin/end calls around
  `useTable` are deleted. The publish test in `controlledState.test.tsx` pins
  the beta.21 internals the patch leans on; it goes with the patch, not before.
- Docs structure decisions raised by the 2026-08-31 review pass and left for the stakeholder.
  Five items, each a reorganisation rather than a fix: put the sidebar on one axis (it mixes grid anatomy with concern today, so no rule can be inferred from the tree); split `editing.md`, at 562 lines seven times the median page; give the column menu its own page, since the surface a user touches most has no sidebar entry and lives under "Visibility, pinning, ordering and size"; move whole-grid CSV export out from under Cell selection, where a grid with cell selection off will never look; rewrite the 31 index-card descriptions in the voice of the pages.
  All five rename pages or move anchors, which ripples into the `sources:` of every skill citing them.
- Documenting the rest of the public surface - 72 of 201 exports in `index.ts` appear in no docs page, `TMDataGridProps`, `TMDataGridColumnMeta` and `tmDataGridEditMode` among them.
  Raised 2026-08-31. An API index built from the types rather than from prose tables waits on this: machinery to search for names with nothing to point at only moves the dead end.
- The prose measure - `.article` is 1280px, roughly 150 characters a line against a normal 45 to 90.
  The width is what makes the per-page reference tables readable, so narrowing the prose means letting tables and code blocks break out of it. Raised 2026-08-31; a decision, not a defect.
- Prose spells "colour" on eight pages while the API spells `color`.
  Raised 2026-08-31; en-US throughout would match the API, en-GB throughout is also consistent. Either, not both.

- The column header menu's own items (sort, filter, group, pin, move, autosize, hide) as `TMDataGrid.Menu.*` components taking a `column` prop, with a `columnMenu` element on `TMDataGrid.Table` in place of the `renderColumnMenuItems` array handback.
  The grid menu (2026-08-29) left the namespace room for them.
  Raised 2026-08-29; held until a consumer asks.
- Editing navigation style - `editing.navigation: "spreadsheet" | "row"`.
  `"spreadsheet"` is today's behaviour: Enter commits and moves down, Tab
  commits and moves right. `"row"` treats the row as the record: Enter and
  Tab both move to the next editable cell to the right and wrap to the next
  row's first, Shift+Enter mirrors Shift+Tab. ✓ confirms and stays under
  both. A table-level choice, never per column. Raised 2026-08-28 while
  settling the tab order; held until a consumer asks.
- Loading vocabulary (skeleton rows, toolbar progress, `isSaving` spinners) -
  needs hands-on play before speccing.
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
  Raised 2026-08-27. Confirmed by a third consumer 2026-08-28, who also hit
  the mount-time width, documented under column-layout.
- Type the `meta.options` function form - `row.original` arrives as
  `unknown` although the callback sits on a `TData`-bound column helper, so
  the docs show a cast. Making the callback generic removes it. Raised
  2026-08-27.
- `meta.edit.enabled` is untyped: `row.original` arrives as `unknown` although
  the helper is `TData`-bound, same fix as the `meta.options` item above.
  Raised 2026-08-27. The other half of that item - the gate reading `data`
  rather than the pending draft - is closed by **Drafts as shown** (Done).
- Tree lane width - the generated group column is a fixed ~250px, pinned
  left, and no option or CSS variable narrows it. Raised by two test
  consumers 2026-08-27; one dropped `columnPinning` because the lane had
  spent the width. `--dg-group-column-width`, or `groupColumn: { size }`. A
  third consumer 2026-08-28 measured it at 260px in a 713px container with
  three columns pinned right, leaving the centre about 115px.
- `table.options.meta` as a consumer-extensible channel - columns are module
  scope, so a cell renderer has no supported way to read page state; `meta`
  is the natural channel but the docs only name `loading`, `totalRowCount`
  and `rowHeight`, and whether consumers may add keys (and how to type them)
  is uncommitted. Raised 2026-08-27. Deciding yes is one docs paragraph plus
  declaration merging.
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
  or keep and leave the docs sentence. Sibling problem, raised by the
  2026-08-31 code review: the footer's `Range` and `PageNumber` fall back to
  `groupedAllRows(getFilteredRowModel().rows.length)` while a grouping
  suspends paging, and under `manualFiltering` that model is one page
  presented as "all rows". Hard to reach - grouping is normally off
  server-side - and pre-existing in `Range`; settle both counts together.
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

**Filter surfaces** - **done 2026-08-31**.
The filter panel's place is a `filters` option: `surface: "popup"` (the default, the floating panel), `"sidebar"` (beside the rows, inside the grid frame, open by default, with `sidebarSide` / `sidebarWidth`), or `"none"` (no panel and no `FilterButton`, so a hand-placed `TMDataGrid.FilterPanel` is the only one) - plus `inHeader`, a header row of per-column value controls that composes with all three.
`TMDataGrid.FilterPanel` became a plain block of controls with a `layout: "row" | "stacked"` prop; click-away, Escape and close-on-empty moved to the popup, and the title with its close button to the popup and the sidebar.
`openColumnFilter` focuses the header control under `inHeader` rather than opening a panel; the panel and the header row watch separate ui slots (`filterPanelColumnId`, `headerFilterColumnId`) so the two never race for the caret, and `meta.filter.control` receives `layout`.
Reviewed by three fresh-eyes agents before merge - docs, API surface and code - which is where the `"none"` naming, the sidebar's open-by-default, and the popup-over-header-filters overlap came from.
Two pre-existing header bugs came out with it: a group header did not span the columns under it, and stacked header rows all pinned to the top edge.

**Server-side ergonomics** - **done 2026-08-31.**
From the build report on the server-backed search recipe, which named ten
findings; the seven that were library work are here, the two that were not are
in the same pull request and one was already closed by *chore: drop the
house-style check*.
The first-page reset (`resetPageOnQueryChange`, on by default under
`manualPagination`) rides on the query slice's own change callback rather than
on an effect, so the page and the query move in one event and one request goes
out; a filter row seeded empty is not a query change.
`activeColumnFilters` removes the cast every mapping layer opened with,
`Controls.PageNumber` is the label a server-paged footer wants, and
`SummaryCount` drops the denominator rather than showing the page size as the
total.
Two bugs closed with them: the controlled-state sync published the table store
from inside the consumer's render, which React reported against the consumer's
own component on the first sort or filter of any grid owning a state slice;
and the last column's resize divider hung 5px past the last track, so a grid
whose columns fit still carried a horizontal scrollbar.
The demo suite now clicks a sortable header on every demo, which is what
catches the first of those.
**Docs feedback pass** - **done 2026-08-31**, docs and demo site only.
Acted on four review files (structure, prose rendering, an outside developer's read, a documentation battletest); nothing under `src/tmdatagrid/` changed, so no changeset.
Search: prose is indexed, keyed to the heading above each passage, and a result shows the line it matched; the fuzzy leg is gated at ACRONYM, so a query the docs cannot answer reaches an empty state instead of ten scattered-character hits; a title answering the whole query drops the half-matches under it; symbols are identifier-shaped only; `searchAliases.ts` holds the words a reader arrives with (`freeze`, `excel`, `localstorage`, `conditional formatting`, `master detail`), with a test pinning every target to a real page and heading.
One name per page: the sidebar label, the h1 and the search title agree on all 32 pages, guarded by a test.
Accuracy: editing had "four modes" against three in two places, `data-draft` was missing from the editing reference, `cellExport`'s default disagreed between two pages, the first-grid snippet declared different columns than the demo beside it, and the front page printed its tagline twice.
Duplication: `components.md` owns the `TMDataGrid` and `TMDataGrid.Table` prop tables, with the deep links `anatomy.md` had and it lacked folded in; `anatomy.md` keeps the parts map and points at it.
Content gaps closed in a paragraph each: dark mode is supported and "Themed" says what it means, cell-level styling says what to do instead, paste is not handled, columns are not virtualized, `getSubRows` renders but the grid adds no expander for it.
Rendering: a link labelled in code keeps the anchor colour, a blockquote is a note rather than a filled pull-quote at 18px, a fence carries its own vertical margin, and inline code scales with the text around it.
Chrome: per-page tab titles, and the sidebar sections ship open.

**Grid menu** - **done 2026-08-29**, breaking.
`TMDataGrid.Menu` is the toolbar burger: a Mantine `Menu` whose children are the dropdown, so an app's own items sit beside the built-in ones.
The column chooser is menu items now, `TMDataGrid.Menu.Columns` with `.ColumnToggles`, `.ShowHideAll` and `.ResetLayout` as its pieces, built on Mantine 9.4's `Menu.Search` and `Menu.Sub` with `Checkbox.Indicator` toggles, so it goes into any Mantine menu inside the grid; the header menu's "Manage columns" is a submenu of the same items.
`TMDataGrid.ColumnsButton` and the `columnsPanelOpen` ui state are gone; `TMDataGrid.ColumnsPanel` stays for hosts that are not a menu.

**Drafts as shown** - **done 2026-08-28**.
Under `editing.draft` a committed draft is the table's row: it stands in for the consumer's record in the table's `data`, so sorting, filtering, quick search, grouping, aggregates, facets, export, selection, the row counts, `edit.getRows()` and `tableValidators` all read it, and the row callbacks receive it as `row.original`.
A committed entry row is one of them too - an ordinary body row marked `data-new`, sorted and filtered with the rest, in place of the in-flow block it used to render in; `editing.newRowsSticky` keeps committed rows in the entry block instead, out of the body's sort and out of the row count.
`TMDataGridEditState.committedValues` is what the table reads: the draft store's values per row, snapshotted at every commit and kept across a reopen, so a row edited again holds its place until it commits or is cancelled.
`data` itself is never modified, and only top-level rows are overlaid - `getSubRows` children keep their `data` values.
Closes two To-explore items for committed rows: draft-aware aggregates, and `meta.edit.enabled` reading `data` rather than the draft. An open row's undecided values are still its own; only a decision moves the collection.

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
and no group-row marking, which wants draft-aware aggregates (**Drafts as
shown**, Done).

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
Entered rows moved again on 2026-08-28: a committed one is a body row, sorted
in with the rest rather than scrolling above them - see **Drafts as shown**.

**Versioned documentation** - **done 2026-08-21**, corrected the same day.
The docs site publishes several complete builds under one Pages root, held on a `gh-pages` branch: the newest release at the root, the tip of main at `next/`, one directory per minor line at `v1.1/`, and a branch published by hand at `b/<name>/`.
The header's version badge became the menu that moves between them, carrying the page you are on across.
What a run publishes is decided against the branch's own state rather than against git history, so a run is idempotent and a missed line is picked up by the next push.
Copies built before the menu existed get a standalone one injected, which is what keeps an older release reachable when that is what the root serves.

The first deploy left the site's entry point answering 404.
Mirroring to the root required a stable release, the 2.0 prerelease wave produces none, and the manual seeding run meant to cover the gap was never made, so `next/` and `v2.0/` were the only copies and nothing served the root.
An empty root now takes whatever a run is publishing, the decision moved into `scripts/docs-plan.mjs` as a pure function with tests, and the two deploy scripts share one prerelease-aware comparison so a stable release can take the root from the prerelease it led up to.

The back lines were seeded by hand afterwards: `v1.0`, `v1.1`, `v2.0` and `next` are all live, and `v1.1` serves the root.

**A release that cannot be skipped** - **done 2026-08-28.**
`2.0.0-beta.6` was versioned, changelogged and never published, with a green Release run and no way to tell from the outside.
`changesets/action` is a single switch: when any changeset on main is still unconsumed it runs `version` and returns, never reaching its publish script.
Merging the version pull request seconds after two feature pull requests left exactly that, so the version the merge was meant to release was lost and the next one, `beta.7`, shipped its code under someone else's release notes.
Publishing now happens in a step of its own, before the action rather than through it - the action's version step switches the checkout to the release branch, so afterwards `package.json` holds the *next* version.
The rule is that every push to main publishes what main's `package.json` says whenever the registry does not have it, so merge order stops mattering and a skipped version is picked up by the next push.
That step tags and writes the GitHub release too, from the changelog section `scripts/changelog-entry.mjs` extracts.
`npm run test` now gates the job; it never did, and CI's own run does not gate this workflow.
`beta.6` is left unpublished: its code is in `beta.7`.

**Skill validation that runs before CI** - **done 2026-08-28.**
The skills check failed in CI on things that take a millisecond to catch locally, and nothing local caught them.
Two causes.
`@tanstack/intent` and `@tanstack/devtools-event-client` both declare a bin called `intent`, so `npx intent` runs whichever won the name and crashes; and CI installed the CLI globally at `latest` while the repository pins it, so the two never validated with the same version.
`scripts/intent.mjs` is now the one place that resolves the pinned CLI by path, the pre-commit hook validates through it, and both jobs in `check-skills.yml` use the repository's own copy.
That workflow diverges from the upstream template as a result, and `intent setup` would undo it.

**Docs previews on pull requests** - **dropped 2026-08-28.**
The deploy ran on `pull_request` to publish a labelled branch at `b/<branch>/` and to take the copy down again when the label or the pull request went away.
It never once worked, and it turned every merge into a red run: a `pull_request` run's ref is `refs/pull/<n>/merge`, which is not a branch, so it matches no deployment branch policy on the `github-pages` environment - not the `main` entry and not the `*` entry either.
The job was rejected at the environment gate before its first step, so the teardown path failed even when its plan was empty.
Relaxing the environment was the earlier reading of this and is not a fix; the constraint is that a pull request ref cannot deploy to Pages under the artifact flow at all.
The trigger is gone, and a branch is published with a `workflow_dispatch` into a `b/<name>` slug instead.

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

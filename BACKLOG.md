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
- H5 - density. Closed as recipe, not feature: the size scale and its recipe
  are on [styling.md](src/docs/styling.md) and
  `getting-started/DensityAndLayout.tsx` is the runtime toggle, both shipped
  with the docs restructure. What is left is a test pinning that a live
  `size` change re-estimates virtualized row heights.

**Parked** - U1, container-based column visibility (`meta.hideBelow`). Called
past 1.0.0 on 2026-08-01.

## To explore later

- Loading vocabulary (skeleton rows, toolbar progress, `isSaving` spinners) -
  needs hands-on play before speccing.

## Done

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
- Row drag-reordering.
- Multi-range cell selection (explicitly scoped out in docs).
- Tree data from hierarchical source (`getSubRows` passthrough undocumented).
- RTL.

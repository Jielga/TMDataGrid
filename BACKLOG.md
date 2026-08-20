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
  Folds in the existing `onReachEnd`-with-pagination warning; the first new
  rules are `detailsTrigger: "rowClick"` against a selection mode where a row
  click already acts, and unstable `data` identity, which the v9 beta's
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

# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. The implementation order, cross-item dependencies and
demo assignments live in [plans/backlog-plan.md](plans/backlog-plan.md);
cell editing has its own plan in [plans/cell-editing.md](plans/cell-editing.md).

## Planned

**Held on approval** - the only work with a decision still outstanding.
[plans/scan-adoption.md](plans/scan-adoption.md) is the tracker: per-item
status and what waits on whom. The proposals themselves are in
[plans/proposals.md](plans/proposals.md); nothing here starts before its
proposal is approved.

- H2 - API coherence refactor and slot reshapes. Held on P2, which has a
  second gate: its rename table returns for yes/no before execution.
- H3 - bad-UX warning framework. Held on P3.
- H4 - details ergonomics (`detailsTrigger`, `detailsMode`). Held on P3, and
  wants H3 shipped first for its rule.
- H5 - density recipe and demo toggle. Held on P4.

**Parked** - U1, container-based column visibility (`meta.hideBelow`). Called
past 1.0.0 on 2026-08-01.

## To explore later

- Loading vocabulary (skeleton rows, toolbar progress, `isSaving` spinners) -
  needs hands-on play before speccing; see scan notes.

## Done

**The 1.0 wave** - competitor-scan adoption, decisions Q1–Q7 settled
2026-08-01. Batches A–D landed 2026-08-01 and H1 on 2026-08-09, on
`feature/next`, released as **1.0.0**. Raw findings in
[plans/competitor-scan.md](plans/competitor-scan.md), per-item status in
[plans/scan-adoption.md](plans/scan-adoption.md).

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
  built-in ones. P1 approved as amended: no registry.

**Docs restructure** - **done 2026-08-16**, released with **1.0.2**. One page
per touchpoint: the docs and examples trees became one tree of 25 pages, each
demo living inside the page that explains it behind a ` ```demo ` fence, with
heading ids, a table-of-contents rail, `Ctrl+K` search and a `/docs` card
index. Every old `/examples/*` route redirects. Plan and rationale:
[plans/docs-restructure.md](plans/docs-restructure.md). F1, the styling
contract page, landed as part of it as
[styling.md](src/docs/styling.md).

**Intent skills** - **done 2026-08-17**, released with **1.0.2**. Twelve
skills, one per docs topic, replacing the six that mirrored the old docs
shape.

**Showcase pass** - **done 2026-08-10**, ahead of the rest of the wave. 24
topic pages and 35 focused demos, each with its own source; the kitchen sink
survives as `/playground`. Plan and what it cost:
[plans/examples-showcase.md](plans/examples-showcase.md). The topic pages were
folded into the docs tree by the restructure above; the demos stayed. From
here a user-facing feature ships with its demo, the way it ships with a
changeset.

**Shipped 2026-07-31**, one commit per step (see git log):

- **Cell editing** - the full plan in
  [plans/cell-editing.md](plans/cell-editing.md), phases 0–4: column types
  boolean/date/select/multiSelect with typed filter operators and one shared
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

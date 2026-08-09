# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. The implementation order, cross-item dependencies and
example-page assignments live in [plans/backlog-plan.md](plans/backlog-plan.md);
cell editing has its own plan in [plans/cell-editing.md](plans/cell-editing.md).

## Planned

**The 1.0 wave** — competitor-scan adoption, decisions Q1–Q7 settled
2026-08-01. [plans/scan-adoption.md](plans/scan-adoption.md) is the tracker:
per-item status, the running order, and what waits on whom. Proposals in
[plans/proposals.md](plans/proposals.md), raw findings in
[plans/competitor-scan.md](plans/competitor-scan.md). Read the tracker
before starting anything below — this list is a pointer, not a second order.

As of 2026-08-01 nothing has started. Branch `feature/next`;
`1.0.0-beta.1` is the wave's first release.

- Batch A `ready` — docs repair, Changesets pre-mode, persistence version
  marker + realignment, Reset layout, CSS layer packaging, `keyof T` check.
- Batch B `ready` — per-row styling, cell click handlers, row numbers lane.
- Batch C `ready` — `?: never` unions, scroll-edge shadows, empty-state slot.
- Batch D `ready` — row pinning; fuzzy search default + filter highlighting.
- Held on approval — control registry + filter controls (P1), API coherence
  refactor (P2), bad-UX framework (P3) and details ergonomics after it,
  density recipe (P4).
- Unassigned — container-based column visibility (`meta.hideBelow`): needs a
  batch call.
- Final — styling contract docs page, once the surface stops moving.

## To explore later

- Loading vocabulary (skeleton rows, toolbar progress, `isSaving` spinners) —
  needs hands-on play before speccing; see scan notes.
- Showcase pass (noted 2026-08-01): docs and example pages that demonstrate
  every feature properly — beyond the reference docs and the three demo
  pages. Scope after the 1.0 wave lands, alongside or after F1.

## Done

Shipped 2026-07-31, one commit per step (see git log):

- **Cell editing** — the full plan in
  [plans/cell-editing.md](plans/cell-editing.md), phases 0–4: column types
  boolean/date/select/multiSelect with typed filter operators and one shared
  `meta.options` source; the edit engine (one TanStack Form per editing row,
  drafts surviving virtualization); `editMode: "cell" | "cellConfirm" |
  "row" | "batch"`; built-in editors per type plus `meta.renderEditor`
  (since renamed `meta.editor`, a component);
  `meta.validate` / `rowValidators` via Standard Schema (Zod); the generated
  edit lane pinned right; `TMDataGrid.EditActions`; `edit.addRow`/`deleteRow`
  with the sticky entry block. `@tanstack/react-form` joined the peer family;
  `/editable-grid` demos all of it; docs in `editing.md`.

- **Localization** — `labels` option merged over `TMDATAGRID_LABELS_EN`;
  every string and `aria-label` localizable; complete Swedish preset
  `TMDATAGRID_LABELS_SV` typed so a missing key is a compile error. EN/SV
  switcher on the demo's main page.
- **Toolbar slot + `TMDataGrid.LoadingIndicator`** — composition documented;
  a small spinner for refetches that keep rows on screen.
- **Global quick search** — `TMDataGrid.Search`, debounced into
  `globalFilter`; `canSearch` capability; hidden under
  `enableGlobalFilter: false`.
- **Multi-column sorting** — Shift+click appends (TanStack's
  `isMultiSortEvent`); priority badges beside the arrows.
- **Full-grid export** — `buildGridCellMatrix` / `exportGridToCsv` over every
  filtered row, all pages; no built-in button, recipe in the docs and an
  Export button on the demo.
- **Summary row** — column `footer` definitions render as a sticky bottom
  row; `aggregateColumn` helper; stacking ladder stated as CSS variables in
  `TMDataGrid.module.css`.
- **Column autosizing** — double-click the divider, "Autosize column" menu
  item, `meta.autoSize`, exported `autosizeColumn`.
- **Infinite scroll** — `onReachEnd` on the Table, latched per row count;
  `/infinite-scroll` example page; docs in server-side.md.

## Icebox

Known gaps, no decision to build:

- Column virtualization (all cells of a row mount today).
- Row drag-reordering.
- Multi-range cell selection (explicitly scoped out in docs).
- Tree data from hierarchical source (`getSubRows` passthrough undocumented).
- RTL.

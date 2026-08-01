# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. The implementation order, cross-item dependencies and
example-page assignments live in [plans/backlog-plan.md](plans/backlog-plan.md);
cell editing has its own plan in [plans/cell-editing.md](plans/cell-editing.md).

## Planned

Competitor-scan adoption (decisions 2026-08-01) — sequencing and design
sketches in [plans/scan-adoption.md](plans/scan-adoption.md), raw findings in
[plans/competitor-scan.md](plans/competitor-scan.md):

- Phase 0: proposals for approval — control/editor registration API, slot
  shapes, bad-UX warning framework, density decision — plus seven
  stakeholder questions from the PM review.
- Phase 1: selection-docs repair, persistence version marker + slice
  realignment, bad-UX warning framework, reset saved layout, per-row styling
  hooks, cell click handlers, `keyof T` typing (feasibility-gated), CSS
  layer packaging.
- Phase 2: scroll-edge shadows + callbacks, empty-state slot, `?: never`
  option unions.
- Phase 3: container-based column visibility, row numbers lane.
- Phase 4: fuzzy ranked quick search, filter match highlighting.
- Phase 5: filter controls + registration (after proposal approval).
- Phase 6: row pinning, details ergonomics.
- Phase 7: documented styling contract (last — after the surface settles).

## To explore later

- Loading vocabulary (skeleton rows, toolbar progress, `isSaving` spinners) —
  needs hands-on play before speccing; see scan notes.

## Done

Shipped 2026-07-31, one commit per step (see git log):

- **Cell editing** — the full plan in
  [plans/cell-editing.md](plans/cell-editing.md), phases 0–4: column types
  boolean/date/select/multiSelect with typed filter operators and one shared
  `meta.options` source; the edit engine (one TanStack Form per editing row,
  drafts surviving virtualization); `editMode: "cell" | "cellConfirm" |
  "row" | "batch"`; built-in editors per type plus `meta.renderEditor`;
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

# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. The implementation order, cross-item dependencies and
example-page assignments live in [plans/backlog-plan.md](plans/backlog-plan.md);
cell editing has its own plan in [plans/cell-editing.md](plans/cell-editing.md).

## Planned

Nothing — everything decided has shipped.

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

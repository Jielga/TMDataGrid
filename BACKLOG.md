# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. The implementation order, cross-item dependencies and
example-page assignments live in [plans/backlog-plan.md](plans/backlog-plan.md);
cell editing has its own plan in [plans/cell-editing.md](plans/cell-editing.md).

## Planned

### 0. Cell editing (plan complete)

**Decision:** planned in full — see [plans/cell-editing.md](plans/cell-editing.md).

One TanStack Form per editing row ("one row, one form"); the grid decides
where and when, the form decides what. `editMode: "cell" | "cellConfirm" |
"row" | "batch"` as one axis; Zod via Standard Schema straight into
`validators`; drafts survive virtualization because forms live in a store
keyed by rowId, not in the DOM. Adds `@tanstack/react-form` as a peer.
Five phases — column types/options first (item 1 below), then cell mode,
confirm+row, batch, and finally add/delete rows with a sticky entry block.
Ships with its own example page, `/editable-grid`.

Sync points with the shipped work: new operator labels go into the labels
dictionary (EN **and** SV in the same commit), `formatExportValue` needs an
array case for `multiSelect`, editing chrome strings come from `labels`, and
the phase-4 entry block adopts the z-index ladder now stated in
`TMDataGrid.module.css`.

### 1. Column types: date, boolean, select

**Decision:** absorbed into the cell-editing plan as phase 0 — see
[plans/cell-editing.md](plans/cell-editing.md) §4. Resolved choices, for the
record:

- `TMDataGridColumnType` widens to `"boolean"`, `"date"`, `"select"` and
  `"multiSelect"`, each with its own operator set (date: is/isNot/before/
  after/onOrBefore/onOrAfter; boolean: equals/notEquals; select: isAnyOf/
  isNoneOf).
- Filter values stay plain serialisable JSON: dates travel as ISO strings,
  is-any-of as a string array (`TMDataGridFilterValue.value` widens to
  `string | ReadonlyArray<string>` — breaking type change, minor version).
- Native `<input type="date">` styled by Mantine — no `@mantine/dates` peer
  dependency; a consumer wanting a real picker uses `renderEditor`.
- One shared `meta.options` source (static array, function, or `"faceted"`
  via `getFacetedUniqueValues()`) feeds the filter panel and the cell
  editors alike — the coordination this item asked for.

## Done

Shipped 2026-07-31, one commit per step (see git log):

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

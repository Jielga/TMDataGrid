# Scan adoption plan

Sequencing the accepted items from [competitor-scan.md](competitor-scan.md)
(stakeholder decisions 2026-08-01, PM review same day). Reference
implementations live in the local clones: `C:\s\temp\mantine-datatable` and
`C:\s\temp\mantine-react-table` — cited below as `[md]` and `[mrt]`.

Ordering rationale: robustness and small API additions first (no design
risk, immediate value), visual polish second, then the items that need an
approved API proposal, the two features with real interaction design (row
pinning, details ergonomics), and the styling contract last — published only
once the phases before it have stopped adding surface.

Costs are complexity, not hours: S (contained, one commit), M (touches a few
subsystems), L (new subsystem or real design surface).

## Stakeholder decisions (questions resolved 2026-08-01)

- **Q1 Custom editors:** both doors stay. The registry (`meta.editor:
  "name"`) is the register-once reuse path; `meta.renderEditor` stays as the
  inline one-off and, being the more specific statement, wins when both are
  set on a column.
- **Q2 Slots:** not a point fix — a whole-API coherence refactor under the
  1.0.0-beta umbrella so the render/slot/override conventions "come
  together". Proposal 2 reframed accordingly; the Footer `pagination` render
  prop breaks as part of it.
- **Q3 Persisted state:** version field ships first; unversioned ≤0.4.0
  payloads are dropped once (stakeholder accepts the one-time layout loss).
- **Q4 Quick search:** fuzzy is the default; contains stays as a mode.
- **Q5 Versioning:** this wave IS the 1.0 line — Changesets pre-mode
  (`changeset pre enter beta`), first release `1.0.0-beta.1`. Breaking
  changes are free until `1.0.0`; each still gets named in its changeset.
- **Q6 Styling contract:** documented-but-provisional during beta, frozen at
  `1.0.0`.
- **Q7 Reset UX (delegated):** the ColumnsPanel's visibility-only Reset is
  replaced by a single **Reset layout** that clears every settings slice
  (visibility, order, widths, pinning), with the scope stated in its
  tooltip. One button, honest scope, no second menu invented.

## Phase 0 — proposals (documents, no code)

Four short proposals for stakeholder approval, each a section in a single
`plans/proposals.md`. Nothing downstream of them starts until approved.

1. **Filter-control & editor registration API** (unblocks phase 5).
   Sketch: a table-level registry plus a per-column pointer —
   `controls: { salaryRange: (args) => <MySlider {...args} /> }` and
   `meta.filterControl: "salaryRange"` / `meta.editor: "salaryRange"` — so a
   consumer registers a special input once (with its validation pattern) and
   reuses it across columns and grids. Inspiration: TanStack Form's
   pre-bound field components. Must define the args contract (value,
   onChange, operator, column, commit/cancel for editors), how built-ins
   (range slider, date-range, autocomplete, tri-state boolean) register
   through the same door, and — per Q1 — precedence against the shipped
   `meta.renderEditor`. The args contract is the widest blast radius in this
   plan (every consumer-registered control binds to it); over-review here.
2. **API coherence refactor (1.0.0-beta)** — per Q2, wider than slot
   shapes: inventory every render/override surface (Footer `pagination`,
   `renderDetails`, `rowContextMenu`, `renderEditor`, toolbar slots, …) and
   unify them under one convention — single typed args object everywhere,
   `state`/`actions`/`Controls` for composable slots
   (`[md] package/types/DataTablePaginationRenderContext.tsx`,
   `DataTablePagination.tsx:76-124`), `internalItems` handback for menus
   (`[mrt] src/components/menus/MRT_ColumnActionMenu.tsx:272-282`).
   Deliverable: the rename/reshape table, old → new, each row a named break
   in the beta changesets.
3. **Bad-UX warning framework** (built in phase 1). Dev-only detector:
   known-bad option combinations log one `console.info` with a docs link and
   the silencing key; silencing is explicit config — working name
   `acknowledgeUx: [...]`. Keys are forever (renaming un-silences), so name
   them once. Must fold in the two ad-hoc dev warnings that already ship —
   `onReachEnd`+pagination (TMDataGridTable) and `editMode` without
   `getRowId` (useTMDataGrid) — so the library has one warning idiom, not
   three. First new rule (lands with phase 6): row-click details expansion
   combined with the selection modes where a row click already means
   something — under `selectionMode: "highlight"` / `"checkboxAndHighlight"`
   a click sets the highlighted row, which is the likelier collision than
   row-select. Complements the `?: never` type-level guards: types catch
   invalid combos, this catches legal-but-unwise ones.
4. **Density** — pending stakeholder decision (runtime compact/comfortable
   row-height toggle; we currently size via the `size` prop at build time).
   Include a recommendation either way.

## Phase 1 — robustness & small APIs (all S)

Internal order matters: version marker → realignment → reset (reset must know
the payload shape it clears; the marker must precede anything rewriting
stored data).

- **Docs repair** — three docs pages (features.md, use-tm-data-grid.md,
  components.md) still document the removed `rowSelectionMode` /
  `highlightSelectedRows` options; the code ships `selectionMode:
  "checkbox" | "row" | "checkboxAndHighlight" | "highlight"` +
  `showSelectedBackground`. Standing bug, fix first.
- **Persistence: version marker + slice realignment** — re-scoped by PM
  review: sanitizing reads (SLICE_GUARDS in core/persistence.ts) and
  drag-time write throttling (PERSIST_DEBOUNCE_MS trailing flush) already
  ship, and cross-tab sync was deliberately rejected (two tabs would
  overwrite each other's layout — documented in use-tm-data-grid.md). The
  genuinely new work: (a) a version field in the payload — one-way door,
  ships before anything else touches storage; (b) realigning stored slices
  when the column set changes between deploys (drop removed ids, append new
  — in an effect, never during render). Q3 decides the ≤0.4.0 payload story.
  Reference: `[md] package/hooks/useDataTableColumns.ts` aligned-memo
  pattern.
- **Bad-UX warning framework** (pulled forward from phase 6 on PM advice) —
  smaller than several phase 1 items, and two existing warnings are waiting
  to be folded in. Phase 6 then adds a rule, not a subsystem.
- **Reset saved layout** — `resetSettings({ table })` (or per-slice
  variants) clearing persisted slices back to definition defaults; per Q7
  the ColumnsPanel's Reset becomes a single **Reset layout** covering all
  settings slices, scope in the tooltip. No menu consolidation yet.
- **Per-row styling hooks** — `rowClassName`/`rowStyle` as
  `T | ((row) => T)` on the Table component, `striped` option, one resolver
  helper (`[mrt] parseFromValuesOrFunc`). Constraints from the codebase:
  row colours must land in the `--row-bg` ladder (base < hover < grouped <
  context-menu < selected < highlighted), because sticky pinned cells and
  the cell-range `color-mix` tint read `--row-bg` — a raw `background`
  bypass breaks both. `striped` computes from the row index, not
  `:nth-child` — mounted rows are a moving window under virtualization.
- **Cell click handlers** — `onCellClick/onCellDoubleClick/onCellContextMenu`
  with `{ cell, row, column, event }`. Policy up front (the `onRowClick`
  precedent): handlers compose, never suppress — double-click still edits,
  right-click still opens `rowContextMenu` and still moves the cell range
  selection; consumer handlers run in addition.
- **`keyof T | (string & {})` typing** — verify feasibility first:
  `TMDataGridColumnMeta` registers through a non-generic
  `metaHelper<TMDataGridColumnMeta>()`, so `keyof TData` cannot reach
  `editField` without a different registration strategy. If infeasible for
  meta and no other accessor-shaped option exists, the item is void — close
  it with a note rather than forcing it.
- **CSS layer packaging** — ship `styles.layer.css`
  (`@import './styles.css' layer(tmdatagrid);`) alongside the plain file.
  The layer name is a one-way door (consumers write it into their own
  `@layer` order) — `tmdatagrid`, chosen deliberately, never renamed.
  Reference: `[md] package.json` exports map + `app/styling/examples/`.

## Phase 2 — surface polish

- **Scroll-edge shadows + callbacks** (M) — shadow under the sticky header
  (and optionally the other three edges) driven by scroll position through
  CSS custom properties, no re-renders; `onScrollToTop/Left/Right` firing on
  edge transitions only. Check whether `animation-timeline: scroll()` (used
  for our pinned-lane gradients) covers the header shadow with no JS —
  prefer that. Naming: `--dg-edge-*` currently means cell-range outline
  edges; the scroll-edge variables must not collide (resolve before the
  styling contract freezes anything).
  Reference: `[md] package/hooks/useDataTableInjectCssVariables.ts`.
- **Empty-state slot** (M) — `renderEmptyState({ hasActiveFilters })`
  ReactNode overlay. Design the state matrix first: loading with no rows vs
  empty data vs filters-removed-everything vs entry rows present — exactly
  one message wins, and the matrix is documented. Builds on the existing
  `.messageRow`.
- **`?: never` prop unions** (M, gated on Q5) — one pass over existing
  option combos: `editMode: "batch"` requires `onEditCommitBatch`;
  `manualPagination` requires `rowCount`; others surfaced while auditing.
  Reference: `[md] package/types/DataTablePaginationProps.ts` and
  `DataTableSelectionProps.ts` for the union shape.

## Phase 3 — layout & lanes

- **Container-based column visibility** (M, the riskiest M in the plan) —
  `meta.hideBelow?: number`: the column renders only while the grid
  container is at least that wide. Container-driven, not viewport media
  queries — a grid inside a resizing panel adapts. Requirements hardened by
  PM review: the ResizeObserver mounts only when some column declares
  `hideBelow` (the no-observers-by-default promise in features.md holds);
  hiding is a derived render-time layer, NOT written into `columnVisibility`
  — persisted user visibility and responsive hiding must never fight, and a
  narrow-then-wide round trip restores exactly what the user had. The
  derived layer must be applied identically at every visible-columns call
  site (headers, cells, grid tracks, export, autosize, cell navigation,
  ColumnsPanel, filter panel) — the codebase already carries a workaround
  for header/cell visibility desync; do not add a second source of it.
  Decide and document: ColumnsPanel presentation of a responsively hidden
  column, and `minSize` interaction with the container threshold.
- **Row numbers column** (S) — opt-in generated lane, static index over the
  current sorted/filtered view. Our control-lane machinery makes this small.

Full-screen mode moved to "Deliberately parked" — PM review rates it the
weakest value-to-risk item (sticky z-ladder, portalled menus, measured
details panels), which fails the stakeholder's own "if it's easy" condition.
Revisit on demand.

## Phase 4 — search

- **Fuzzy ranked quick search** (M, default gated on Q4) — match-sorter-
  style fuzzy matching as a configurable `Search` mode; while ranking is
  active and the user has no explicit sort, rows order by match quality.
  Specify before building: interaction with grouping (grouping runs before
  sorting), with the persisted `sorting` slice, with `aria-sort` and the
  multi-sort priority badges.
  Reference: `[mrt] src/fns/sortingFns.ts` (`rankGlobalFuzzy`),
  `src/hooks/useMRT_Effects.ts` (sort suspension — do it declaratively, not
  their stash-and-restore effect).
- **Filter match highlighting** (M) — opt-in: matched substrings in cells
  highlighted while a text filter or quick search is active. Only for plain
  string renders (a custom `cell` renderer opts out by existing). Define
  what highlighting means under fuzzy (non-contiguous matches) — plausibly
  highlight only under contains-style matching and skip fuzzy. Perf gate:
  no measurable cost while off, bounded while on.

## Phase 5 — filter controls & registration (L, needs proposal 1 + Q1)

Built-in richer filter controls (range slider seeded from faceted min/max,
date-range, autocomplete, tri-state boolean checkbox) implemented as
pre-registered entries in the new control registry, proving the same API
consumers use. Filter panel picks the control by column type/operator as it
does today; `meta.filterControl` overrides. The editor half of the registry
lands here too, with the Q1 precedence against `meta.renderEditor`.

## Phase 6 — rows & interaction design

- **Row pinning** (L) — user-pinned rows sticky under the header / above the
  summary row, reusing the entry-block CSS mechanics (single sticky block,
  nested subgrid). Use TanStack's rowPinning state if the v9 feature exists
  in our beta; otherwise a thin slice in our edit-store style. Pin via
  context menu (+ lane icon where the edit lane already exists).
  Interactions to design: virtualization (pinned rows leave the virtual
  flow), selection, grouping (likely pin data rows only), persistence
  (probably a data slice, not settings), and — added by PM review — the
  sticky ladder: entry block and pinned rows both sticky under the header
  (ordering between them; `--dg-z-pinned-row: 4` currently serves both
  roles), and pinned-bottom rows vs the summary row at equal z. Note the
  file name collision: `TMDataGridPinnedRows.tsx` today exports the entry
  block (`TMDataGridEntryRows`) — rename before this phase to keep names
  honest.
- **Details ergonomics** (M) — `detailsTrigger: "chevron" | "rowClick"` and
  `detailsMode: "multiple" | "single"` (accordion). Adds the phase's bad-UX
  rule (framework already shipped in phase 1): row-click expansion under the
  selection modes where a row click already acts (`"row"`, `"highlight"`,
  `"checkboxAndHighlight"`).

## Phase 7 — styling contract (S, docs; after the surface settles)

A `styling.md` docs page listing every `--dg-*` variable and `data-*`
attribute with the stability promise per Q6, plus the layer story from
phase 1. Deliberately last: phases 2-6 each add surface (scroll-edge vars,
row-numbers lane, `hideBelow`, pinned rows), and publishing earlier means a
stale page or re-issued promises. The `--dg-edge-*` naming clash must be
resolved by then (phase 2).

## Deliberately parked

- **Loading vocabulary** (skeletons, progress bars, isSaving) — explore
  later; BACKLOG holds it. Needs hands-on play, not a spec.
- **Full-screen mode** — weakest value-to-risk (PM); revisit on demand.
- **Density toggle** — pending stakeholder decision (proposal 4).
- **Menu consolidation** (one grid menu vs today's buttons) — open question,
  no design yet; reset-layout deliberately avoids forcing it.
- **Per-locale subpath packages** — when we grow past EN/SV.
- **Click-to-copy** — rejected: cell selection already covers copy.
- **Row drag-reordering** — rejected: DnD is for small lists/trees.

## Versioning

This wave is the 1.0 line (Q5). Before phase 1 lands: `changeset pre enter
beta`, a major changeset opens `1.0.0-beta.1`, and every breaking change —
API refactor renames, `?: never` type breaks, the persisted-payload drop —
is named in its changeset. `changeset pre exit` when the wave is done and
`1.0.0` ships with the styling contract frozen (Q6).

Each phase lands green as its own commit(s) with tests, docs and a changeset
per user-facing change, same discipline as the cell-editing plan. This wave
builds on the `feature/next` branch, merged to main when 1.0.0 ships.

# Scan adoption plan

Sequencing the accepted items from [competitor-scan.md](competitor-scan.md)
(stakeholder decisions 2026-08-01). Reference implementations live in the
local clones: `C:\s\temp\mantine-datatable` and
`C:\s\temp\mantine-react-table` — cited below as `[md]` and `[mrt]`.

Ordering rationale: robustness and small API additions first (no design
risk, immediate value), visual polish second, then the items that need an
approved API proposal, and last the two features with real interaction
design (row pinning, details ergonomics). Proposals are written early —
phase 0 — so approvals can happen while the quick wins land.

Costs are complexity, not hours: S (contained, one commit), M (touches a few
subsystems), L (new subsystem or real design surface).

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
   onChange, operator, column, commit/cancel for editors) and how built-ins
   (range slider, date-range, autocomplete, tri-state boolean) register
   through the same door — built-ins are just pre-registered controls.
2. **Slot shapes** (unblocks the Footer pager rework and future EditActions).
   Concrete before/after for `state`/`actions`/`Controls`
   (`[md] package/types/DataTablePaginationRenderContext.tsx`,
   `DataTablePagination.tsx:76-124`) and the `internalXxx` handback for our
   column menu and context menu
   (`[mrt] src/components/menus/MRT_ColumnActionMenu.tsx:272-282`).
3. **Bad-UX warning framework** (ships with phase 6 but the shape matters
   earlier). Dev-only detector: known-bad option combinations (first case:
   row-click selection + row-click details expansion) log one `console.info`
   with a link to docs and the silencing key. Silencing is explicit config —
   working name `acknowledgeUx: ["row-click-select-and-expand"]`. Complements
   the `?: never` type-level guards: types catch invalid combos, the
   framework catches legal-but-unwise ones.
4. **Density** — pending stakeholder decision (runtime compact/comfortable
   row-height toggle; we currently size via the `size` prop at build time).
   Include a recommendation either way.

## Phase 1 — robustness & small APIs (all S)

- **Persistence hardening** — sanitize every localStorage read (cross-tab
  `storage` events can deliver malformed values), realign stored slices when
  the column set changes between deploys (drop removed ids, append new — in
  an effect, never during render), throttle writes during a resize drag.
  Reference: `[md] package/utils.ts#sanitizeStoredArray`,
  `package/hooks/useDataTableColumnResize.ts:136-141` (dirtyRef skip-while-
  dragging), the `alignedColumnsX` memos in the sibling hooks.
- **Reset saved layout** — `resetSettings({ table })` (or per-slice variants)
  clearing the persisted slices back to definition defaults, plus a "Reset
  layout" item on the existing columns menu. Menu stays the beaten track —
  a button with a Mantine dropdown; no menu consolidation yet.
- **Per-row styling hooks** — `rowClassName`/`rowStyle` as
  `T | ((row) => T)` on the Table component, `striped` option, resolved with
  one small helper (`[mrt] parseFromValuesOrFunc`). Values land as
  class/style on `.bodyRow`; document alongside the existing `data-*` attrs.
- **Cell click handlers** — `onCellClick/onCellDoubleClick/onCellContextMenu`
  with `{ cell, row, column, event }`. Light: BodyCell already owns
  double-click for editing; these compose, they don't replace. Skip if they
  turn out to fight the editing/selection handlers — flag instead of forcing.
- **`keyof T | (string & {})` typing** — apply to `editField` and any other
  accessor-shaped string options.
- **CSS layer packaging** — ship `styles.layer.css`
  (`@import './styles.css' layer(tmdatagrid);`) alongside the plain file.
  Reference: `[md] package.json` exports map + `app/styling/examples/`.

## Phase 2 — surface polish

- **Scroll-edge shadows + callbacks** (M) — shadow under the sticky header
  (and optionally the other three edges) driven by scroll position through
  CSS custom properties, no re-renders; `onScrollToTop/Left/Right` firing on
  edge transitions only. We already own the container and a ResizeObserver;
  check whether `animation-timeline: scroll()` (used for our pinned-lane
  gradients) covers the header shadow without any JS at all — prefer that.
  Reference: `[md] package/hooks/useDataTableInjectCssVariables.ts`.
- **Empty-state slot** (M) — `renderEmptyState({ hasActiveFilters })`
  ReactNode overlay. Design the state matrix first: loading with no rows vs
  empty data vs filters-removed-everything vs entry rows present — exactly
  one message wins, and the matrix is documented. Builds on the existing
  `.messageRow`.
- **`?: never` prop unions** (M) — one pass over existing option combos:
  `editMode: "batch"` requires `onEditCommitBatch`; `manualPagination`
  requires `rowCount`; others surfaced while auditing. Reference:
  `[md] package/types/DataTablePaginationProps.ts` and
  `DataTableSelectionProps.ts` for the union shape.
- **Documented styling contract** (S, docs) — a `styling.md` docs page
  listing every `--dg-*` variable and `data-*` attribute as stable API, with
  the layer story from phase 1. Written after the two items above so the new
  surfaces are included.

## Phase 3 — layout & lanes

- **Container-based column visibility** (M) — `meta.hideBelow?: number`:
  the column renders only while the grid container is at least that wide.
  Container-driven, not viewport media queries — a grid inside a resizing
  panel adapts. One ResizeObserver on the scroll container feeding a width
  store value; hiding is a derived render-time layer, NOT written into
  `columnVisibility` — persisted user visibility and responsive hiding must
  never fight, and a narrow-then-wide round trip restores exactly what the
  user had.
- **Row numbers column** (S) — opt-in generated lane, static index over the
  current sorted/filtered view. Our control-lane machinery makes this small.
- **Full-screen mode** (M) — toolbar toggle; the grid root goes fixed
  full-viewport; restore page scroll on exit. Keep it simple — if it needs
  body-style surgery beyond overflow, reconsider.
  Reference (including what to avoid): `[mrt] src/hooks/useMRT_Effects.ts`.

## Phase 4 — search

- **Fuzzy ranked quick search** (M) — match-sorter-style fuzzy matching as a
  configurable `Search` mode; while ranking is active and the user has no
  explicit sort, rows order by match quality. Opinionated default to be
  settled in review (fuzzy-on vs contains-default).
  Reference: `[mrt] src/fns/sortingFns.ts` (`rankGlobalFuzzy`),
  `src/hooks/useMRT_Effects.ts` (sort suspension — do this declaratively
  instead of their stash-and-restore effect).
- **Filter match highlighting** (M) — opt-in: matched substrings in cells
  highlighted while a text filter or quick search is active. Only for plain
  string renders (a custom `cell` renderer opts out by existing). Perf gate:
  no measurable cost while off, bounded while on.

## Phase 5 — filter controls & registration (L, needs proposal 1 approved)

Built-in richer filter controls (range slider seeded from faceted min/max,
date-range, autocomplete, tri-state boolean checkbox) implemented as
pre-registered entries in the new control registry, proving the same API
consumers use. Filter panel picks the control by column type/operator as it
does today; `meta.filterControl` overrides. The editor half of the registry
lands here too if the proposal unifies them (it should — one registration,
two contexts).

## Phase 6 — rows & interaction design

- **Row pinning** (L) — user-pinned rows sticky under the header / above the
  summary row, reusing the entry-block CSS mechanics (single sticky block,
  nested subgrid). Use TanStack's rowPinning state if the v9 feature exists
  in our beta; otherwise a thin slice in our edit-store style. Pin via
  context menu (+ lane icon where the edit lane already exists).
  Interactions to design: virtualization (pinned rows leave the virtual
  flow), selection, grouping (likely pin data rows only), persistence
  (probably a data slice, not settings).
  Reference: `[mrt] rowPinningDisplayMode` docs/examples for scope —
  we ship sticky mode only.
- **Details ergonomics + bad-UX framework** (M) — `detailsTrigger:
  "chevron" | "rowClick"` and `detailsMode: "multiple" | "single"`
  (accordion). Ships together with the warning framework from proposal 3,
  whose first rule guards exactly this: row-click expansion combined with
  row-click selection.

## Deliberately parked

- **Loading vocabulary** (skeletons, progress bars, isSaving) — explore
  later; BACKLOG holds it. Needs hands-on play, not a spec.
- **Density toggle** — pending stakeholder decision (proposal 4).
- **Menu consolidation** (one grid menu vs today's buttons) — open question,
  no design yet; reset-layout deliberately avoids forcing it.
- **Per-locale subpath packages** — when we grow past EN/SV.
- **Click-to-copy** — rejected: cell selection already covers copy.
- **Row drag-reordering** — rejected: DnD is for small lists/trees.

Each phase lands green on main as its own commit(s) with tests, docs and a
changeset per user-facing change, same discipline as the cell-editing plan.

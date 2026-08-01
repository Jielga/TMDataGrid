# Scan adoption plan — the 1.0 wave

> **Status: batch A in progress** (go given 2026-08-01, remaining calls
> delegated). Decisions Q1–Q7 settled 2026-08-01. Proposals P1–P4 still
> awaiting stakeholder approval — the H items stay held. U1 and full-screen
> parked by delegated call. Work lands on branch `feature/next`, merged to
> `main` when `1.0.0` ships.

**This file is the tracker for the wave.** The [execution
tracker](#execution-tracker) is the running order *and the only place item
status is recorded* — the sections below it carry design notes, one per
item, and no second ordering. Raw findings live in
[competitor-scan.md](competitor-scan.md); the gating proposals in
[proposals.md](proposals.md). Reference implementations are the local
clones `C:\s\temp\mantine-datatable` and `C:\s\temp\mantine-react-table`,
cited as `[md]` and `[mrt]`.

Costs are complexity, not hours: S (contained, one commit), M (touches a
few subsystems), L (new subsystem or real design surface).

## Current status — 2026-08-01

| What | Where it stands |
| --- | --- |
| Decisions Q1–Q7 | **Settled** 2026-08-01, recorded [below](#stakeholder-decisions--q1q7-settled-2026-08-01). Not reopened without new evidence. |
| Proposals P1–P4 | **Written, pending stakeholder approval** — [proposals.md](proposals.md). P2 has a second gate: its rename table returns for yes/no before execution. |
| Batches A–D | **Running** — go given 2026-08-01. A executes in order; B–D follow. |
| Held items | **Blocked on approval** — see [Held](#held--waiting-on-approval). |
| Implementation | **None.** No code from this wave has landed. |
| Branch | `feature/next`. Merged to `main` at `1.0.0`. |
| Release | Changesets pre-mode `beta`; first release `1.0.0-beta.1` (A2 opens it). Breaks are free until `1.0.0`, each named in its changeset. |

**Waiting on the stakeholder** — nothing else is waiting on anybody:

1. Approve P1–P4 — [proposals.md](proposals.md). Unblocks H1–H5. (P2's
   rename table returns for a second yes/no.)

## Execution tracker

Status vocabulary: `ready` (cleared, not started) · `in progress` ·
`done <date>` · `held <what it waits on>` · `unassigned` (no batch yet,
needs a call) · `parked`.

Batch A runs in the numbered order — each step depends on the one before
it in the ways noted. Batches B, C and D are internally free; D's two
tracks are freely reorderable. Run the batches in order A → B → C → D.

| # | Item | Size | Status | Gate / depends on |
| --- | --- | --- | --- | --- |
| **A** | **Trivial & foundation — strict order** | | | |
| A1 | Docs repair: stale selection options | S | `done 2026-08-01` | — |
| A2 | Changesets pre-mode beta + major changeset | S | `done 2026-08-01` | Q5 |
| A3 | Persistence version marker → slice realignment → one-time drop | M | `done 2026-08-01` | Q3; after A2 (the drop is a named break) |
| A4 | Reset layout | S | `done 2026-08-01` | A3 |
| A5 | CSS layer packaging | S | `done 2026-08-01` | — |
| A6 | `keyof T` typing feasibility check | S | `done 2026-08-01 — closed void` | — |
| **B** | **Small features — order free** | | | |
| B1 | Per-row styling hooks (`rowClassName`/`rowStyle`/`striped`) | S | `done 2026-08-01` | — |
| B2 | Cell click handlers | S | `done 2026-08-01` | — |
| B3 | Row numbers lane | S | `ready` | — |
| **C** | **Medium, conflict-free — order free** | | | |
| C1 | `?: never` prop unions | M | `ready` | Q5 |
| C2 | Scroll-edge shadows + `onScrollTo*` callbacks | M | `ready` | — |
| C3 | Empty-state slot | M | `ready` | state matrix written first |
| **D** | **Big, independent — order free** | | | |
| D1 | Row pinning | L | `ready` | — |
| D2 | Fuzzy quick search (default) | M | `ready` | Q4 |
| D3 | Filter match highlighting | M | `ready` | D2 |
| **H** | **Held — waiting on approval** | | | |
| H1 | Control registry + built-in filter controls | L | `held P1` | P1 approved |
| H2 | API coherence refactor + slot reshapes | L | `held P2` | P2 approved **and** rename table approved |
| H3 | Bad-UX warning framework | M | `held P3` | P3 approved |
| H4 | Details ergonomics (`detailsTrigger`, `detailsMode`) | M | `held P3` | H3 shipped (wants the framework for its rule) |
| H5 | Density recipe + demo toggle | S | `held P4` | P4 approved |
| **—** | **Unassigned / final** | | | |
| U1 | Container-based column visibility (`meta.hideBelow`) | M | `parked` | past 1.0.0 (called 2026-08-01, delegated) |
| F1 | Styling contract docs page | S | `ready after A–D + H` | Q6; publish once the surface stops moving |

**Why C before the held refactor:** C's items touch the option types and
chrome the P2 coherence refactor also touches. Landing them first means
the refactor rebases over finished work instead of the two colliding
mid-flight.

**When an item ships:** set its Status cell to `done <date>`, and add a
one-line `> Shipped <date> — <commit>. <deviations>` blockquote to its
section below, the way [cell-editing.md](cell-editing.md) records its
deviations. Status lives in the table and nowhere else.

## Stakeholder decisions — Q1–Q7, settled 2026-08-01

- **Q1 Custom editors:** both doors stay. The registry (`meta.editor:
  "name"`) is the register-once reuse path; `meta.renderEditor` stays as the
  inline one-off and, being the more specific statement, wins when both are
  set on a column.
- **Q2 Slots:** not a point fix — a whole-API coherence refactor under the
  1.0.0-beta umbrella so the render/slot/override conventions come
  together. P2 is that proposal; the Footer `pagination` render prop breaks
  as part of it.
- **Q3 Persisted state:** the version field ships first; unversioned ≤0.4.0
  payloads are dropped once — stakeholder accepts the one-time layout loss.
- **Q4 Quick search:** fuzzy is the default; contains stays as a mode.
- **Q5 Versioning:** this wave *is* the 1.0 line. Changesets pre-mode
  (`changeset pre enter beta`), first release `1.0.0-beta.1`. Breaking
  changes are free until `1.0.0`; each is still named in its changeset.
- **Q6 Styling contract:** documented-but-provisional during the beta,
  frozen at `1.0.0`.
- **Q7 Reset UX:** the ColumnsPanel's visibility-only Reset is replaced by a
  single **Reset layout** clearing every settings slice (visibility, order,
  widths, pinning), scope stated in its tooltip. One button, honest scope,
  no second menu invented.

Ordering rationale for the wave as a whole: independent no-conflict work
first (nothing to rebase), small features next, the medium items that share
ground with the pending refactor before that refactor starts, the two big
independent features last, and the styling contract last of all — published
only once the phases before it stop adding surface.

## Batch A — trivial & foundation

Strict order. A3's marker must precede anything that rewrites stored data,
and A4 must know the payload shape it clears.

### A1 — Docs repair

Three docs pages (`features.md`, `use-tm-data-grid.md`, `components.md`)
still document the removed `rowSelectionMode` / `highlightSelectedRows`
options; the code ships `selectionMode: "checkbox" | "row" |
"checkboxAndHighlight" | "highlight"` plus `showSelectedBackground`.
Standing bug, and every later item's docs build on these pages — fix first.

### A2 — Changesets pre-mode

`changeset pre enter beta`, then a major changeset opening `1.0.0-beta.1`
(Q5). Everything after this point names its breaks in its own changeset.
`changeset pre exit` happens when the wave ends and `1.0.0` ships.

### A3 — Persistence: version marker, then realignment

Re-scoped by PM review: sanitizing reads (`SLICE_GUARDS` in
`core/persistence.ts`) and drag-time write throttling
(`PERSIST_DEBOUNCE_MS`, trailing flush) already ship, and cross-tab sync was
deliberately rejected — two tabs would overwrite each other's layout,
documented in `use-tm-data-grid.md`. What is genuinely new, in this order:

1. A version field in the stored payload. One-way door: v0.4.0 payloads are
   already on users' machines unversioned, so this ships before anything
   else touches storage.
2. Unversioned payloads are dropped once (Q3) — one-time layout loss,
   accepted, named in the changeset.
3. Realigning stored slices when the column set changes between deploys
   (drop removed ids, append new — in an effect, never during render).
   Reference: `[md] package/hooks/useDataTableColumns.ts` aligned-memo.

### A4 — Reset layout

`resetSettings({ table })` (or per-slice variants) clearing the persisted
settings slices back to definition defaults. Per Q7 the ColumnsPanel's
Reset becomes a single **Reset layout** covering all settings slices, scope
in the tooltip. No menu consolidation — that stays parked.

### A5 — CSS layer packaging

Ship `styles.layer.css` (`@import './styles.css' layer(tmdatagrid);`)
alongside the plain file; additive exports-map entry. The layer name is a
one-way door — consumers write it into their own `@layer` order — so
`tmdatagrid` is chosen deliberately and never renamed.
Reference: `[md] package.json` exports map + `app/styling/examples/`.

### A6 — `keyof T | (string & {})` typing

> Closed void 2026-08-01. Confirmed: `TMDataGridColumnMeta` registers via
> the module-scope `metaHelper<TMDataGridColumnMeta>()` in the shared v9
> feature registry (consumed by the main *and* entry-row tables), so `keyof
> TData` cannot reach `editField` without building the registry per grid —
> the shared registry and its stable identity are worth more than
> autocomplete on one field. No other accessor-shaped option exists: helper
> `columnId` params take column ids, which are not row keys (dots become
> underscores in TanStack's derivation).

## Batch B — small features

Order free.

### B1 — Per-row styling hooks

`rowClassName` / `rowStyle` as `T | ((row) => T)` on the Table component,
plus a `striped` option, resolved by one helper
(`[mrt] parseFromValuesOrFunc`). Two constraints from the codebase:

- Row colours land in the `--row-bg` ladder (base < hover < grouped <
  context-menu < selected < highlighted). Sticky pinned cells need an opaque
  background and the cell-range tint `color-mix`es over `--row-bg`, so a raw
  `background` bypass breaks both.
- `striped` computes from the row index, never `:nth-child` — mounted rows
  are a moving window under virtualization. The reference library has no
  virtualization, so its approach does not port.

### B2 — Cell click handlers

`onCellClick` / `onCellDoubleClick` / `onCellContextMenu` with
`{ cell, row, column, event }`. Policy stated up front, following the
`onRowClick` precedent: handlers **compose, never suppress** — double-click
still edits, right-click still opens `rowContextMenu` and still moves the
cell-range selection; consumer handlers run in addition.

### B3 — Row numbers lane

Opt-in generated lane, static index over the current sorted/filtered view.
The control-lane machinery makes this small.

## Batch C — medium, conflict-free

Order free. These land before the P2 refactor so it rebases over finished
work.

### C1 — `?: never` prop unions

One pass over existing option combos: `editMode: "batch"` requires
`onEditCommitBatch`; `manualPagination` requires `rowCount`; others surface
while auditing. Turns currently-compiling consumer code into type errors —
allowed by Q5, named in the changeset. Each later item adds its own union
rather than deferring to a second pass.
Reference: `[md] package/types/DataTablePaginationProps.ts`,
`DataTableSelectionProps.ts`.

### C2 — Scroll-edge shadows + callbacks

Shadow under the sticky header (optionally the other three edges) driven by
scroll position through CSS custom properties, no re-renders;
`onScrollToTop` / `onScrollToLeft` / `onScrollToRight` firing on edge
transitions only. Check whether `animation-timeline: scroll()` — already
used for the pinned-lane gradients — covers the header shadow with no JS at
all; prefer that. **Naming:** `--dg-edge-*` already means cell-range outline
edges. The scroll-edge variables must not collide, and the clash is resolved
here, before F1 documents anything.
Reference: `[md] package/hooks/useDataTableInjectCssVariables.ts`.

### C3 — Empty-state slot

`renderEmptyState({ hasActiveFilters })` ReactNode overlay. Write the state
matrix first — loading with no rows vs empty data vs filters-removed-
everything vs entry rows present — so exactly one message wins, and document
it. Builds on the existing `.messageRow`.

## Batch D — big, independent

Freely reorderable; D3 wants D2 first.

### D1 — Row pinning

User-pinned rows sticky under the header / above the summary row, reusing
the entry-block CSS mechanics (single sticky block, nested subgrid). Use
TanStack's rowPinning state if the v9 feature exists in our beta; otherwise
a thin slice in the edit-store style. Pin via context menu, plus a lane icon
where the edit lane already exists. Interactions to design:

- Virtualization — pinned rows leave the virtual flow.
- Selection, and grouping (likely pin data rows only).
- Persistence — probably a data slice, not settings.
- The sticky ladder: the entry block and pinned rows are both sticky under
  the header (ordering between them; `--dg-z-pinned-row: 4` currently serves
  both roles), and pinned-bottom rows meet the summary row at equal z.
- File-name collision: `TMDataGridPinnedRows.tsx` today exports the entry
  block (`TMDataGridEntryRows`). Rename before this lands.

Scope: sticky mode only (`[mrt] rowPinningDisplayMode` for what we are *not*
shipping).

### D2 — Fuzzy quick search

Match-sorter-style fuzzy matching as the **default** `Search` mode (Q4),
with contains kept as a mode. While ranking is active and the user has no
explicit sort, rows order by match quality. Specify before building:
interaction with grouping (grouping runs before sorting), with the persisted
`sorting` slice, with `aria-sort`, and with the multi-sort priority badges.
Reference: `[mrt] src/fns/sortingFns.ts` (`rankGlobalFuzzy`),
`src/hooks/useMRT_Effects.ts` (sort suspension — do it declaratively, not
their stash-and-restore effect).

### D3 — Filter match highlighting

Opt-in: matched substrings highlighted while a text filter or quick search
is active. Plain string renders only — a custom `cell` renderer opts out by
existing. Define what highlighting means under fuzzy matching (matches are
non-contiguous); plausibly highlight only under contains-style matching and
skip fuzzy. Perf gate: no measurable cost while off, bounded while on.

## Held — waiting on approval

Nothing here starts until its proposal is approved. Details live in
[proposals.md](proposals.md); only the build-side scope is repeated here.

### H1 — Control registry + built-in filter controls (needs P1)

Built-in richer controls — range slider seeded from faceted min/max,
date-range, autocomplete, tri-state boolean — implemented as pre-registered
entries in the new registry, proving the same API consumers use. The filter
panel picks by column type/operator as today; `meta.filterControl`
overrides. The editor half lands here too, with the Q1 precedence against
`meta.renderEditor`.

### H2 — API coherence refactor (needs P2 + rename table)

Two gates: P2's conventions, then the rename/reshape table back for yes/no
before execution. Executed as one commit series, each break named in a beta
changeset.

### H3 — Bad-UX warning framework (needs P3)

Dev-only detector, one idiom for legal-but-unwise option combinations, plus
folding in the ad-hoc `onReachEnd`+pagination warning. Silencing keys are
forever. H4's rule is its first new consumer.

### H4 — Details ergonomics (needs P3, then H3)

`detailsTrigger: "chevron" | "rowClick"` and `detailsMode: "multiple" |
"single"` (accordion). Ships with the bad-UX rule for row-click expansion
under the selection modes where a row click already acts (`"row"`,
`"highlight"`, `"checkboxAndHighlight"` — the highlight modes are the
likelier collision, since a click there already drives a detail panel).

### H5 — Density recipe (needs P4)

P4 recommends no built-in density: a docs recipe plus a size toggle on the
demo page, and a test pinning that a runtime `size` change re-estimates
virtualized row heights.

## Unassigned — needs a call

### U1 — Container-based column visibility (`meta.hideBelow`)

> **Called 2026-08-01 (delegated): parked past 1.0.0.** Riskiest M in the
> wave, touches the visibility subsystem with a known desync history, and is
> purely additive — it loses nothing by shipping in 1.1.

Accepted in the scan, reshaped to container-driven rather than media
queries. Requirements already hardened, whenever it runs:

- The ResizeObserver mounts only when some column declares `hideBelow`, so
  the no-observers-by-default promise in `features.md` holds.
- Hiding is a derived render-time layer, **not** written into
  `columnVisibility`: persisted user visibility and responsive hiding must
  never fight, and a narrow-then-wide round trip restores exactly what the
  user had.
- The derived layer must be applied identically at every visible-columns
  call site — headers, cells, grid tracks, export, autosize, cell
  navigation, ColumnsPanel, filter panel. The codebase already carries a
  workaround for header/cell visibility desync; do not add a second source
  of it.
- Decide and document: how the ColumnsPanel presents a responsively hidden
  column, and how `minSize` interacts with the container threshold.


## Final gate

### F1 — Styling contract

A `styling.md` docs page listing every `--dg-*` variable and `data-*`
attribute, with the stability promise per Q6: provisional during the beta,
frozen at `1.0.0`. Includes the layer story from A5. Deliberately last —
batches C and D each add surface (scroll-edge vars, row-numbers lane, pinned
rows), and publishing earlier means a stale page or a re-issued promise. The
`--dg-edge-*` naming clash must be resolved by C2 before this page exists.

## Deliberately parked

- **Loading vocabulary** (skeletons, progress bars, `isSaving`) — needs
  hands-on play, not a spec. BACKLOG holds it.
- **Full-screen mode** — *park confirmed 2026-08-01 (delegated).* The
  scan acceptance was conditional on "if it stays easy"; PM review showed
  it isn't (sticky z-ladder, portalled menus, measured details panels), so
  the condition fails. Revisit on real demand.
- **Menu consolidation** (one grid menu vs today's buttons) — open question,
  no design; A4 deliberately avoids forcing it.
- **Per-locale subpath packages** — when we grow past EN/SV.
- **Click-to-copy** — rejected: cell selection already covers copy.
- **Row drag-reordering** — rejected: DnD is for small lists and trees.

## Release mechanics

Branch `feature/next` for the whole wave; merged to `main` when `1.0.0`
ships. A2 enters Changesets pre-mode `beta` and opens `1.0.0-beta.1`; every
breaking change — refactor renames, the `?: never` type breaks, the
persisted-payload drop — is named in its changeset. `changeset pre exit`
when the wave is done, and `1.0.0` ships with the styling contract frozen
(Q6).

Each item lands green by itself: tests, docs, a changeset per user-facing
change, lint, commit — the same discipline as the cell-editing plan.

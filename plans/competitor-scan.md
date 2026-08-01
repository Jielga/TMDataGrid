# Competitor scan — working note

Scanning other data table/grid libraries for feature gaps and architecture
ideas. One section per repo. Statuses: **accepted** (stakeholder said yes —
sequenced in [scan-adoption.md](scan-adoption.md)), **pending** (needs a
concrete proposal or decision first), **rejected** (sunset, with why),
**explore later** / **icebox** / **noted**.

Stakeholder decisions taken 2026-08-01; the plan and open questions live in
[plans/scan-adoption.md](scan-adoption.md).

## mantine-datatable (icflorescu, v9.4.0) — scanned 2026-08-01

`<table>`-based, controlled-everything (consumer does the actual
sorting/filtering/paging), no virtualization, no editing, no tests. We are
ahead on the heavy machinery; the items below are what stood out.

### Feature ideas

| Idea | Status | Notes |
| --- | --- | --- |
| Row drag-reordering | **rejected** | DnD is for small lists or trees; we aim at bigger data loads. Their slot-based integration (`rowFactory` + `tableWrapper` + width-copying draggable row) noted for reference only. |
| Reset for persisted layout | **accepted** | Every persisted slice has a `resetColumnsX()`; consumers build "Reset layout" buttons. Ours: reset API + a menu item on the existing columns menu — keep the menu itself light (beaten track: button + Mantine dropdown); the bigger "one menu vs many buttons" question is deliberately open. |
| Per-row styling hooks | **accepted** | `rowColor(record)`, `rowClassName`/`rowStyle` as functions; `striped`. |
| Scroll-edge shadows + callbacks | **accepted** | Header shadow when scrolled; `onScrollToTop/Left/Right`. ResizeObserver→CSS-var, zero re-renders. |
| Per-column responsive visibility | **accepted, reshaped** | NOT media queries — container-size driven: observe the grid container's width (we already own a ResizeObserver) so a grid inside a resizing panel adapts too. API on the column definition. |
| Empty-state slot | **accepted** | ReactNode overlay; must be carefully combined with loading overlay / skeleton / no-results-from-filters states — design the state matrix first. |
| Details-panel ergonomics | **accepted** | Row-click-to-expand + accordion mode as options. Must compose with row-click selection — ships together with the bad-UX warning framework (see plan). |
| Cell-level click handlers | **accepted** | `onCellClick/DoubleClick/ContextMenu` — only if it stays light on our end. |
| RTL | icebox (already) | Their implementation is the reference: `position` vs `logicalSide` in the pinned map, inverted resize deltas, per-browser RTL `scrollLeft` math. |
| Minor: humanized titles, `verticalAlign`, `textSelectionDisabled`, `hiddenContent`, loader blur, `{light,dark}` color pairs, right-click column toggle | skip | Low value or already covered by our approach. |

### Architecture steals

| Idea | Status | Notes |
| --- | --- | --- |
| `state`/`actions`/`Controls` render-slot shape | **pending proposal** | Stakeholder wants the concrete shape on the table before approving. Draft it for our Footer pager first. |
| `?: never` mutually-exclusive prop unions | **accepted** | Compile error instead of dev warning — `editMode: "batch"` + `onEditCommitBatch`, `manualPagination` + `rowCount`. Complements (not replaces) the runtime bad-UX warnings, which cover what types can't. |
| Persistence hardening | **accepted** | `sanitizeStoredArray` on every localStorage read (cross-tab `storage` events deliver malformed values); realign stored state when the column set changes (drop removed, append new — in an effect); throttle writes during resize drag. |
| Documented styling contract | **accepted** | Publish our `--dg-*` vars + data attributes as a stable, documented API. |
| `keyof T \| (string & NonNullable<unknown>)` accessor typing | **accepted** | For `editField` and friends. |
| CSS layer packaging | **accepted** | Ship `styles.layer.css` alongside `styles.css`. |

### Where they are weaker (confidence, no action)

No virtualization, no editing, filter UI only (consumer filters), no keyboard
cell navigation, no `aria-sort`, coarse 5-part `classNames`, zero automated
tests.

## mantine-react-table (KevinVandy, 2.0.0-beta.9) — scanned 2026-08-01

**Legacy**: Mantine 7 + TanStack Table v8, stalled at beta, CI deleted, zero
automated tests (Storybook + docs examples only). By the TanStack Table
author's collaborator circle, so the TanStack wiring is the interesting part —
but all of it predates v9's feature registry, which we already sit on.
Inspiration only; nothing to adopt wholesale.

### Feature ideas

| Idea | Status | Notes |
| --- | --- | --- |
| Filter variants: range-slider, date-range, autocomplete, tri-state checkbox | **accepted, with extension API** | Built-ins are welcome but the headline requirement is consumer-supplied filter controls: register custom inputs once, reuse per column — TanStack-Form-style pre-bound components as the inspiration. API proposal needed before build; stakeholder's use cases lean on special inputs with special validation. |
| Filter match highlighting | **accepted** | Opt-in, only if performance stays clean. Matched substrings via Mantine `Highlight`. |
| Fuzzy global filter with ranked results | **accepted** | Be opinionated: fuzzy as a configurable mode. Sorting suspends while ranking is active (their trick). |
| Density toggle | **pending decision** | Explained to stakeholder (runtime compact/comfortable row-height toggle); awaiting call. |
| Full-screen mode | **accepted** | If it stays easy: fixed-position Paper, restore scroll on exit. |
| Click-to-copy cells | **rejected** | Covered by cell selection: Ctrl+C and the right-click copy/export menu. |
| Loading skeletons + progress bars | **explore later** | Needs hands-on testing to see what we actually want; parked in BACKLOG. |
| Row pinning (user-pinned sticky rows) | **accepted** | Wanted. Sticky mode reusing the entry-block CSS mechanics. |
| Row numbers column | **accepted** | Optional lane. |
| Column virtualization | icebox (already) | Their wiring is the reference: pinned-column indexes force-included in the `rangeExtractor`, spacer cells sized from virtual start/end deltas, dragged column kept mounted. |
| Cell hover reveal | skip | Niche; measures scrollWidth per hover. |
| Toolbar drop zone (drag header to group) | skip | We group via the column menu. |
| Modal edit/create modes | skip | Our four modes + entry block cover it; theirs has no validation and buffers in `row._valuesCache`. |
| Alert banner (`head-overlay` selection banner) | skip | Our toolbar count covers it. |

### Architecture notes

| Idea | Status | Notes |
| --- | --- | --- |
| `internalXxx` handback in render overrides | **pending proposal** | Overrides receive built-in content to append/wrap (`renderColumnActionsMenuItems({ internalColumnMenuItems })`). Stakeholder wants the concrete design first — draft for our column menu + context menu. |
| `T \| ((args) => T)` prop pattern + one resolver | noted | Feeds the per-row styling API shape. |
| String fn-names in state, resolved at prepare time | validated | We already do this with operator strings. |
| Per-locale subpath packages | **deferred** | We will grow past EN/SV, but not now. |
| Skeleton-row fabrication on empty data + auto-`manual*` flags | noted | Ties into the loading-vocabulary exploration. |

### Anti-patterns confirmed (avoid; mostly v8 scar tissue)

Post-hoc instance patching (`table.refs`, 14 setters assigned every render) and
`Omit<Table, …> &` type surgery — exactly what v9's feature registry (our
foundation) absorbs; their types even declare an unused
`MRT_CreateTableFeature`, an abandoned attempt at it. Mutating consumer column
defs and `initialState` in place. Conditional hooks guarded by
frozen-at-mount flags (virtualization untogglable at runtime). Renderers
invoked as bare functions instead of components (hooks attach to the wrong
component). Edit buffer in `row._valuesCache` with inconsistent key shapes and
no validation layer. `memoMode` exposing memoization as a user-facing footgun.
Layout via `setTimeout(rerender, 150)` and render-time `getBoundingClientRect`.
Duplicated hardcoded row-height tables that disagree with each other.

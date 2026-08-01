# Competitor scan — working note

Scanning other data table/grid libraries for feature gaps and architecture
ideas. One section per repo; each idea carries a status so decisions stick:
**proposed** (awaiting call), **rejected** (sunset, with why), **accepted**
(move to BACKLOG when planned).

## mantine-datatable (icflorescu, v9.4.0) — scanned 2026-08-01

`<table>`-based, controlled-everything (consumer does the actual
sorting/filtering/paging), no virtualization, no editing, no tests. We are
ahead on the heavy machinery; the items below are what stood out.

### Feature ideas

| Idea | Status | Notes |
| --- | --- | --- |
| Row drag-reordering | **rejected** | DnD is for small lists or trees; we aim at bigger data loads. Their slot-based integration (`rowFactory` + `tableWrapper` + width-copying draggable row) noted for reference only. |
| Reset for persisted layout | proposed | Every persisted slice has a `resetColumnsX()`; consumers build "Reset layout" buttons. Our `settingsKey` has no public reset. Cheap, high value. |
| Per-row styling hooks | proposed | `rowColor(record)`, `rowBackgroundColor(record)`, `rowClassName`/`rowStyle` as functions; `striped`, `highlightOnHover` toggles. We have data attrs + CSS vars but no per-record function props. |
| Scroll-edge shadows + callbacks | proposed | Four fade shadows driven by ResizeObserver→CSS vars, zero re-renders; `onScrollToTop/Bottom/Left/Right`. We have pinned gradients + `onReachEnd` only. Header shadow when scrolled is the valuable cue. |
| Per-column responsive visibility | proposed | `column.visibleMediaQuery` hides columns below a breakpoint. |
| Empty-state slot | proposed | `emptyState` ReactNode / `noRecordsIcon`, auto-centered overlay. We only have `noResultsLabel` text. |
| Details-panel ergonomics | proposed | Expansion `trigger: "click"` (row click opens panel), `allowMultiple: false` (accordion), Collapse animation with row kept mounted through exit. |
| Cell-level click handlers | proposed | `onCellClick/DoubleClick/ContextMenu` with record + column. We expose row-level only. |
| RTL | icebox (already) | Their implementation is the reference: `position` vs `logicalSide` in the pinned map, inverted resize deltas, per-browser RTL `scrollLeft` math. |
| Minor: humanized titles, `verticalAlign`, `textSelectionDisabled`, `hiddenContent`, loader blur, `{light,dark}` color pairs, right-click column toggle | skip | Low value or already covered by our approach. |

### Architecture steals

| Idea | Status | Notes |
| --- | --- | --- |
| `state`/`actions`/`Controls` render-slot shape | proposed | `renderPagination(ctx)`: pre-bound `Controls.Text/PageSizeSelector/Pagination` components; default render is the three in a row. Consumers rearrange/restyle/drop parts. Candidate for our Footer pager and future EditActions. |
| `?: never` mutually-exclusive prop unions | proposed | All-or-nothing prop groups (pagination, selection), `ellipsis` XOR `noWrap`. Compile error instead of dev warning — candidate for `editMode: "batch"` + `onEditCommitBatch`, `manualPagination` + `rowCount`. |
| Persistence hardening | proposed | `sanitizeStoredArray` on every localStorage read (cross-tab `storage` events deliver malformed values); realign stored state when the column set changes (drop removed, append new — in an effect); throttle writes during resize drag. |
| Documented styling contract | proposed | Stable class names, ~30 public CSS vars, state-as-data-attributes listed in docs as API. We do this internally (`--dg-*`, data attrs) — the steal is documenting it as a stable public surface. |
| `keyof T \| (string & NonNullable<unknown>)` accessor typing | proposed | Autocomplete on the row type while accepting arbitrary strings — candidate for `editField`. |
| CSS layer packaging | proposed | Ship `styles.css` and `styles.layer.css` (`layer(mantine-datatable)`) so consumers control cascade order. Relevant when we publish CSS. |

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
| Filter variants: range-slider, date-range, autocomplete, tri-state checkbox | proposed | Their `filterVariant` set is richer than our operator set. Range slider seeds min/max from faceted values; date-range = our before/after as one control; tri-state checkbox (checked/unchecked/no filter) for booleans. |
| Filter match highlighting | proposed | Matched substrings wrapped in Mantine `Highlight` in cells while a text/global filter is active. Small, delightful, cheap with our faceted plumbing. |
| Fuzzy global filter with ranked results | proposed | match-sorter fuzzy fn; while active, sorting is suspended and rows re-rank by best match. Ours is plain contains. |
| Density toggle | proposed | `density` state drives spacing + row heights (we already size rows off Mantine `size` — a runtime toggle is mostly chrome). |
| Full-screen mode | proposed | Paper goes fixed 100dvh; saves/restores page scroll. Common ask in data-heavy apps. |
| Click-to-copy cells | proposed | `enableClickToCopy` per column, Mantine `CopyButton` wrap with "Copied" tooltip. We have Ctrl+C on cell selection; per-cell copy affordance is complementary. |
| Loading skeletons + progress bars | proposed | `showSkeletons` fabricates `min(pageSize, 20)` blank rows of `Skeleton`s; `showProgressBars` in toolbars; `isSaving` drives button spinners. Richer than our `loading` + LoadingIndicator. |
| Row pinning (user-pinned sticky rows) | proposed | `rowPinningDisplayMode`: sticky rows or static top/bottom blocks, plus `select-*` modes that pin as a side-effect of selection. Our sticky entry block already proves the CSS; user-facing row pinning would reuse it. |
| Row numbers column | proposed | `mrt-row-numbers` display column, static (page-offset) or original-index. Trivial with our lane machinery. |
| Column virtualization | icebox (already) | Their wiring is the reference: pinned-column indexes force-included in the `rangeExtractor`, spacer cells sized from virtual start/end deltas, dragged column kept mounted. |
| Cell hover reveal | skip | Truncated cell overflows on hover; niche, measures scrollWidth per hover. |
| Toolbar drop zone (drag header to group) | skip | We group via the column menu; a drop zone adds DnD surface for little gain. |
| Modal edit/create modes | skip | Our four modes + entry block cover it; their modal mode has no validation and buffers values in `row._valuesCache` (a TanStack-private field). |
| Alert banner (`head-overlay` selection banner) | skip | Our toolbar count covers it. |

### Architecture notes

| Idea | Status | Notes |
| --- | --- | --- |
| `internalXxx` handback in render overrides | proposed | Best idea in the codebase: overrides receive the built-in content as an argument — `renderColumnActionsMenuItems({ internalColumnMenuItems })`, `renderDetailPanel({ internalEditComponents })` — so consumers append/wrap instead of rebuilding. Candidate for our column menu and context menu. |
| `T \| ((args) => T)` prop pattern + one resolver | noted | `parseFromValuesOrFunc` resolves every `mantineXxxProps`. Fits our per-row styling idea (single `rowProps`-style prop, object or function). |
| String fn-names in state, resolved at prepare time | validated | Serializable filter state — we already do this with operator strings. |
| Per-locale subpath packages | proposed | 39 locales each built as its own subpath export (`/locales/sv`) with `sideEffects: false` — clean tree-shaking pattern for when we grow past EN/SV. |
| Skeleton-row fabrication on empty data + auto-`manual*` flags | noted | Empty `data` auto-forces all `manual*` flags so a loading table never client-filters skeleton rows. |

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

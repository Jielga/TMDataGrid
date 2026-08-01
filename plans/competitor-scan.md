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

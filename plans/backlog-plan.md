# Backlog - master implementation plan

> **Status: executed 2026-07-31.** Steps 1–9 all shipped, one commit per step
> (`c876388`…`ee7c8ce`); results are summarised under *Done* in
> [BACKLOG.md](../BACKLOG.md). Kept for the rationale and for the cell-editing
> sync points, which still apply.

How the whole of [BACKLOG.md](../BACKLOG.md) gets built: order, the
dependencies between items, the shared infrastructure they fight over, and
which example page each lands on. Cell editing has its own plan
([cell-editing.md](cell-editing.md), phases 0–4); this plan sequences
everything else around it and marks the sync points.

Sizes are complexity, not time: S = mechanical, M = a design already made
plus real wiring, L = new ground.

## Why this order

Two facts drive the sequence:

1. **Localization is a foundation, not a feature.** Every other item adds
   user-visible strings - the search placeholder, summary-row labels, the
   autosize menu item, the whole editing chrome. Land the labels system
   first and each feature adds its labels as it arrives; land it last and
   every feature ships hard-coded strings that then need a second pass.
2. **Three items want the same structural work.** Column footers (a sticky
   bottom row), editing phase 4 (a sticky entry block under the header) and
   the pinned-column chrome all need a stated z-index ladder and the
   header/footer placement technique. Whoever lands first establishes it;
   this plan gives that job to column footers, which is the smaller change.

Everything else is small and independent - ordered to keep the
`TMDataGridTable.tsx` hotspot from being edited by two items at once.

## The sequence

| Step | Backlog item | Size | Depends on |
| --- | --- | --- | --- |
| 1 | 4 - Localization (EN) | M | - |
| 2 | 4 - Swedish preset | S | step 1 |
| 3 | 7 - Toolbar slot + `LoadingIndicator` | S | step 1 (labels) |
| 4 | 2 - Global quick search | S | step 1 (labels) |
| 5 | 5 - Multi-column sorting | S | - |
| 6 | 3 - Full-grid export | S | - |
| 7 | 6 - Column footers / summary row | M | step 1; establishes the z-index ladder |
| 8 | 8 - Column autosizing | M | step 7 (footer cells measurable) |
| 9 | 9 - Infinite scroll + example page | M | step 3 (`LoadingIndicator` demo) |
| - | 0/1 - Cell editing phases 0–4 | L | own plan; sync points below |

Each step ends green and lands on main by itself: tests, docs, changeset
(user-facing changes only), lint, commit. No step blocks more than the one
after it, so the order can flex if something stalls - only steps 1 and 7
are genuine prerequisites for later work.

## Step notes

### 1–2. Localization

The design in the backlog stands: a `labels` option on `useTMDataGrid`,
partial override deep-merged over English defaults, read through the grid
context. Implementation notes beyond that:

- New `core/labels.ts`: the `TMDataGridLabels` type, `TMDATAGRID_LABELS_EN`
  (the defaults), `mergeLabels`. Interpolating labels are functions
  (`summaryCount: (n) => ...`), everything else plain strings.
- Components read `labels` from `useTMDataGridContext` - it joins `table`,
  `features`, `ui` there. Core modules (`filterOperators`, `cellExport`)
  take labels as an argument instead; they stay context-free.
- `FILTER_OPERATOR_LABELS` is exported public API. It becomes an alias of
  the English operator labels and stays exported; `formatFilterLabel`
  gains an optional labels argument. No breakage.
- Sweep targets: operator labels, filter panel, filter pills, toolbar
  buttons, columns panel ("Search", "No columns match"), header menu items,
  footer/pager, empty state ("No rows match your filters" - already a prop,
  keep the prop as the per-instance override), export menu, select/details/
  group column `aria-label`s.
- Step 2 is `TMDATAGRID_LABELS_SV`, a complete Swedish dictionary, plus a
  type-level guarantee (`satisfies TMDataGridLabels`) that presets never go
  stale when new keys arrive. **Every later step that adds a label adds it
  to EN and SV in the same commit** - that rule is what keeps step 2 an S.
- **Sync point (editing):** the editing thread's chrome (edit lane
  tooltips, `EditActions`, entry block) must take its strings from the
  dictionary. If editing phase 1 lands before this step, its strings are
  added to the sweep list here instead - cheap either way, but agree on it.

### 3. Toolbar slot + LoadingIndicator

- Verify-and-document first: `TMDataGrid.Toolbar` already takes children
  and `Spacer` pushes right, so "extra buttons top-right" is already true.
  Add the recipe to `components.md`.
- New `TMDataGrid.LoadingIndicator`: renders a small Mantine `Loader`
  (plus `aria-live` text from labels) whenever the `loading` option is
  true; renders nothing otherwise. One file, one test. The empty-state
  overlay behaviour in `TMDataGridTable.tsx` is untouched.

### 4. Global quick search

- As designed in the backlog: `TMDataGrid.Search`, debounced `TextInput`
  → `table.setGlobalFilter`, render-prop escape hatch, `canSearch`
  capability, hidden when `enableGlobalFilter: false`.
- Placeholder and aria-label from the labels dictionary (why it follows
  step 1).
- Persistence: add `globalFilter` to `DATA_STATE_SLICES` - check
  `persistence.ts` round-trips a plain string slice.
- **Sync point (editing phase 0):** `includesString` coerces values to
  strings, so typed columns keep working; multiSelect array values may
  want a `globalFilterFn` tweak - note it in phase 0's checklist, not a
  blocker here.

### 5. Multi-column sorting

- Pass the click event through to `column.getToggleSortingHandler()` /
  `toggleSorting(desc, event.shiftKey && column.getCanMultiSort())`.
- Sort-priority badge (1, 2, …) beside the arrow only when
  `sorting.length > 1` - read via `useSelector`, per the features.md rule
  about method calls on long-lived objects.
- Header menu unchanged (click replaces the sort); Shift+click is the multi
  path. Document in `features.md`. If TanStack v9's multi-sort event
  plumbing turns out to fight the custom header (the sort control is a
  styled button, not `getToggleSortingHandler` - check first), this is the
  one item allowed to be dropped back to the icebox, per its "if easy"
  decision.

### 6. Full-grid export

- New `exportGridRows({ table, options })` in `core/cellExport.ts`:
  all filtered+sorted leaf rows (`getPrePaginatedRowModel` so a paged grid
  exports everything, not one page) × visible non-control leaf columns,
  reusing `buildCellMatrix`'s value/format path, then `toExcelCsv` /
  `downloadTextFile` / `writeClipboardText` as-is.
- No built-in button. Add a toolbar-button recipe (using the step 3 slot
  pattern) to `components.md`, and wire that recipe into the main example.
- **Sync point (editing phase 0):** `formatExportValue` needs a case for
  array values once `multiSelect` exists - one line, lands with phase 0.

### 7. Column footers / summary row

- Named **summary row**, not footer - `TMDataGrid.Footer` (the pager) is
  taken. It renders inside the Table's scroll container (it must share the
  grid template and horizontal scroll), so it is a Table concern: rendered
  automatically after the virtualized body when any leaf column defines
  `footer`, sticky at `bottom: 0`.
- Pinned lanes get the same left/centre/right treatment as the header;
  `getFooterGroups()` supplies the cells.
- Consumers compute aggregates via a new `aggregateColumn({ table,
  columnId, fn })` helper reusing the registered aggregation fns over
  `getFilteredRowModel().rows` - or render anything at all; the `footer`
  def is just a renderer.
- **Establishes the z-index ladder** from the editing plan §10 (body 0,
  pinned col 2, pinned row 4, pinned row × pinned col 5, header 6,
  header × pinned col 7) as CSS variables/comments in the module CSS,
  replacing today's hardcoded 2/3. Editing phase 4's entry block then
  slots into an existing ladder.
- Empty state and summary row: with zero rows the summary renders (sums of
  nothing are honest zeros) but sits directly under the header - check it
  doesn't overlap the empty-state overlay.

### 8. Column autosizing

- As designed: double-click the resize divider → autosize; exported
  `autosizeColumn({ table, columnId })` primitive; `meta.autoSize` for
  on-mount sizing (run once after first mount, when the virtualizer has
  produced rows); "Autosize column" menu item behind the resize
  capability (label added EN+SV).
- Measurement: max `scrollWidth` over the column's mounted body cells,
  header content, and - after step 7 - its summary cell, plus cell
  padding; clamp to `minSize`/`maxSize`; write via `setColumnSizing`.
  Mounted window only; documented, same as AG Grid's default.
- Needs a DOM query hook on the Table (cells already carry column ids via
  the grid template; add `data-column-id` if the lookup needs it).
- Persistence interplay: autosized widths land in `columnSizing`, already
  a settings slice - a persisted grid keeps the autosized width, which is
  the expected behaviour.

### 9. Infinite scroll

- As designed: `onReachEnd` on `TMDataGrid.Table` with a row `threshold`
  (default ~10), fired from the virtualizer's range change; re-fire
  guarded by a "has fired for this rows.length" latch so a pending fetch
  isn't spammed. Consumer appends to `data`.
- Guard rails: dev-mode warning when combined with `enablePagination`;
  docs state that sorting/filtering must be `manual*` or they operate on
  the partial set.
- **Own example page** (the decision): `/infinite-scroll` route + nav
  entry - simulated latency fetch, `useState` accumulation,
  `LoadingIndicator` in the toolbar (its natural demo), total count in
  `SummaryCount` vs loaded count. Docs section in `server-side.md`.

## Cell editing sync points, collected

| Editing phase | Coordinates with | What |
| --- | --- | --- |
| 0 - column types | steps 4, 6 | multiSelect arrays in `globalFilterFn` and `formatExportValue`; new operator labels go into the labels dictionary (EN+SV) |
| 1 - cell mode | step 1 | editor chrome strings from the dictionary; Enter/F2 branches land in `TMDataGridTable.tsx` - avoid editing that file concurrently with steps 7/9 |
| 2–3 - lanes/batch | step 1 | edit lane and `EditActions` labels |
| 4 - entry block | step 7 | consumes the z-index ladder and header-height measurement; land after step 7 or adopt its ladder |

## Example pages

The rule: the main example shows everyday chrome; anything with its own
mental model gets its own page. New routes follow the `dataGridRoute`
pattern in `router.tsx` + a nav entry in `AppLayout.tsx`.

| Page | Route | Gets |
| --- | --- | --- |
| Main grid (existing) | `/data-grid` | `Search` in the toolbar, Shift+click multi-sort, double-click autosize (both invisible until used), an Export button top-right (the step 6 recipe), a summary row on the salary column, and an EN/SV `SegmentedControl` beside the color-scheme switch driving `labels` - the cheapest honest i18n demo |
| Editable grid | `/editable-grid` | per the cell-editing plan (grids A/B/C) |
| Infinite scroll | `/infinite-scroll` | step 9's demo; also the home of `LoadingIndicator` |

Not built: a separate server-side/manual-pagination page (the docs cover
it; nothing in this backlog changes it) and a separate i18n page (a
dictionary swap has no behaviour to demo beyond the switcher).

## Files by hotspot

Where merge pain lives if order is ignored:

- `TMDataGridTable.tsx` - steps 7 (summary row), 9 (onReachEnd), editing
  phases 1–4 (editors, keys). One at a time.
- `core/filterOperators.ts` - step 1 (labels out) then editing phase 0
  (types in). That order, or phase 0 adds hard-coded labels to migrate.
- `TMDataGridToolbar.tsx` / `components.md` - steps 3, 4, 6 all add parts
  or recipes; they're sequenced adjacently on purpose.
- `core/capabilities.ts` - steps 4 (`canSearch`) and editing (`canEdit`);
  additive, low risk.
- `index.ts` - every step exports something; additive.

## Verification cadence

Per step: unit tests beside the core module, RTL component tests through
the `renderGrid` harness where chrome is involved, `npm run lint`,
`npm test`, docs updated in the same commit, changeset for user-facing
changes, commit to main. The two structural steps (7, 8) get a manual
`npm run dev` pass over the pinned/grouped/details combinations before
committing, since jsdom cannot see sticky positioning or measured widths.

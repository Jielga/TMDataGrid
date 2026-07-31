# Backlog

Feature gaps identified 2026-07-31, with the decision taken for each and notes
on how to build it. Ordered by intended implementation order, not priority of
discovery.

## In progress

### Cell editing

Being built in a separate session. The keyboard model already reserves the
keys: Enter/F2 step into a cell today and are documented as "the pair a cell
editor will take over" — the editor replaces that step-in behaviour on
editable columns.

## Planned

### 1. Column types: date, boolean, select

**Decision:** backlogged.

- Extend `TMDataGridColumnType` in `core/filterOperators.ts` with `"date"`,
  `"boolean"` and `"select"`, each with its own operator set: date gets
  on/before/after (+ optionally between), boolean gets is-true/is-false,
  select gets is/is-not/is-any-of.
- The filter value must stay plain serialisable JSON (the documented contract
  for server-side `manualFiltering`), so dates travel as ISO strings and
  is-any-of as a string array.
- The filter panel needs per-type value inputs. A date picker means the
  `@mantine/dates` peer dependency — decide whether to take it or use the
  native `<input type="date">` styled by Mantine.
- Select options: `meta.filterOptions` explicitly, falling back to TanStack's
  `getFacetedUniqueValues()` to derive them from the data.
- Coordinate with cell editing (in progress elsewhere): editors and filters
  should share the same column type system.

### 2. Global quick search

**Decision:** build it in, flexible — toggleable and/or render-prop.

- The feature is already half-wired: `globalFilteringFeature` is loaded and
  `globalFilterFn: "includesString"` is set in `useTMDataGrid.tsx`. Only the
  UI is missing.
- Add `TMDataGrid.Search` as a toolbar part: debounced Mantine `TextInput`
  writing `table.setGlobalFilter`. Props for `placeholder` and `debounce`;
  accept a render-prop for full replacement while keeping the debounce/state
  plumbing.
- Respect the capability pattern: render nothing when `enableGlobalFilter:
  false` on the table, and add `canSearch` to `getGridCapabilities`. System
  lanes already set `enableGlobalFilter: false` per column.
- `globalFilter` is a data slice for persistence, same as `columnFilters`.

### 3. Full-grid export

**Decision:** expose the API only; the consumer provides the button.

- Everything needed exists in `core/cellExport.ts` — it just only runs over a
  selected cell range today.
- Export a helper, e.g. `exportGridToCsv({ table, options })`, that builds the
  matrix from all filtered+sorted leaf rows × visible leaf columns (skip
  control columns via `isControlColumn`) and reuses `toExcelCsv` /
  `downloadTextFile` / `writeClipboardText`.
- Same `TMDataGridCellExportOptions` shape so the Nordic-Excel defaults and
  overrides carry over unchanged.
- Document a toolbar-button recipe in `server-side.md` or `components.md`.

### 4. Localization

**Decision:** needed. English first, then Swedish.

- Every string is hard-coded today: `FILTER_OPERATOR_LABELS`, "No rows match
  your filters", pager text, menu items, export menu, all `aria-label`s.
- Add a `labels` option on `useTMDataGrid` (partial override, deep-merged over
  the English defaults) and read it through the grid context.
- Ship the English defaults as the built-in and export a complete Swedish
  preset (e.g. `TMDATAGRID_LABELS_SV`) so `labels: TMDATAGRID_LABELS_SV` is
  the whole integration.
- Labels that interpolate (counts, column names) should be functions, not
  template strings: `selectedCount: (n) => \`${n} selected\``.

### 5. Multi-column sorting

**Decision:** implement if reasonably easy.

- TanStack supports it natively; the grid never passes the event through.
  Shift+click via `isMultiSortEvent` / `column.toggleSorting(desc, multi)`.
- Render a small sort-priority index (1, 2, …) next to the sort arrow when
  `sorting.length > 1`.
- Check the header menu: "Sort ascending/descending" items should either
  replace the sort (current behaviour, fine) or gain an "add to sort" variant
  — keep the menu as-is first, Shift+click is the multi path.

### 6. Column footers / summary row

**Decision:** wanted, with proper flexibility.

- Render `table.getFooterGroups()` as a sticky bottom row inside the scroll
  container (above `TMDataGrid.Footer`'s pager), sharing the grid template so
  columns line up, including pinned lanes.
- Opt-in by existence: only render when at least one leaf column defines
  `footer`. No new enable flag needed.
- The column's `footer` renderer gets the table, so consumers compute totals
  over `getFilteredRowModel().rows` themselves, or we export a small
  `aggregateColumn(table, columnId, fn)` helper reusing the registered
  aggregation fns.
- Virtualization interplay: the footer row is outside the virtualized body but
  inside the horizontal scroll — same placement technique as the header.

### 7. Toolbar right slot + refetch indicator

**Decision:** keep it small. No built-in overlay — the consumer places their
own indicator in the toolbar.

- The toolbar is already compositional (`TMDataGrid.Toolbar` takes children,
  `Spacer` pushes right), so "extra buttons on the top bar to the right"
  mostly already works — verify and document the pattern.
- Optionally add a tiny `TMDataGrid.LoadingIndicator` that renders a small
  Mantine `Loader` whenever the `loading` option is true (today the loading
  state only shows when the grid is empty — `TMDataGridTable.tsx` renders it
  under `isEmpty && loading`). Consumer decides where to put it.

### 8. Column autosizing

**Decision:** both double-click on the resize divider and a column option.

- Double-click the resize handle → autosize that column. Column option
  (e.g. `meta.autoSize`) for sizing on mount/data change.
- Measurement under virtualization: only mounted rows exist. Take
  `scrollWidth` of the mounted cells for that column plus the header, use the
  max plus cell padding, write it with `table.setColumnSizing`. That measures
  the visible window, not all rows — document that; it is what AG Grid does
  by default too.
- Export the primitive (`autosizeColumn({ table, columnId })`) so menus and
  consumer code can trigger it; consider an "Autosize" item in the column
  menu behind the resize capability.

### 9. Infinite scroll

**Decision:** implement, with its own example page.

- Fits the grid's virtualization-first design better than the pager for
  server data.
- Add an `onReachEnd` (or `onEndReached`) callback on `TMDataGrid.Table`,
  fired when the virtualizer's last rendered index comes within a threshold
  of `rows.length`. Guard against refiring while a fetch is pending — the
  consumer appends the next page to `data` and the virtualizer keeps its
  scroll position.
- Consumer holds the accumulated rows (`useState` append or TanStack Query's
  `useInfiniteQuery` + `flatMap`).
- Caveats to document: sorting/filtering must be `manual*` (server-side) or
  they silently operate on the partial set; incompatible with
  `enablePagination`.
- New example page under `src/examples/` + a docs section.

## Icebox

Known gaps, no decision to build:

- Column virtualization (all cells of a row mount today).
- Row drag-reordering.
- Multi-range cell selection (explicitly scoped out in docs).
- Tree data from hierarchical source (`getSubRows` passthrough undocumented).
- RTL.

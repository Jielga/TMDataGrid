# Docs restructure - one page per touchpoint

> **Status: executed 2026-08-16.** Supersedes the two-tree layout
> that [examples-showcase.md](examples-showcase.md) shipped on 2026-08-10.
> That plan fixed the examples; it left them in a tree of their own, beside
> the docs, which is the problem this one closes.
>
> **Done 2026-08-16.** The docs and examples trees are one tree. All 25
> pages written, all 35 demos placed, `features.md` and `components.md`
> dissolved into the topics they used to collect, and the examples tree
> deleted - `ExampleTopicPage`, `ExamplesIndexPage` and `examplePages.ts` are
> gone, with every old route redirecting.
>
> **Also built:** the ` ```demo ` fence · heading ids and hash-aware links
> (the renderer emitted **no ids at all**, so every anchor on the site was
> dead) · a table-of-contents rail with deep links and an active marker · a
> site header with the live version · a `Ctrl+K` search over pages, headings
> and Reference-table symbols · a `/docs` card index.
>
> **The generated-API track was dropped** - see [API reference and
> search](#api-reference-and-search). Reference tables are hand-written
> markdown and the search index is built by scanning it, which removed the
> `.d.ts` parser, the invented `@docsPage` tag and the build-order change.
>
> **Still open:** the API explorer as a grid (`/docs/api`) and inline symbol
> hover cards. The skills' `sources:` frontmatter was repointed 2026-08-17,
> alongside a new `editing` skill.

Costs are complexity, not hours: S (contained, one commit), M (touches a few
subsystems), L (new subsystem or real design surface).

**The reader this is written for** is a developer implementing a table. Not
someone evaluating the library, not someone browsing. They have a column
definition open in one window and the docs in the other, and the question is
always the same shape: *"I need the grid to do X - what do I touch?"*

## The rule

**One touchpoint, one page. Everything about that touchpoint on it -
option, prop, column meta field, callback, CSS variable, helper, keyboard
key, and the live demo.**

That is Mantine's model. A Mantine component page is the whole story about
that component: prose, demos inline, then props. There is no second place to
look, and no "see also the example". The difference here is that the unit
cannot be the component - `TMDataGrid.Table` carries seventeen props
belonging to six unrelated features - so the unit is the **touchpoint
group**: the set of API surface you touch to make one thing happen.

Getting started stays what it is: the happy path, thin, and pointed at the
tree. It is not where anything gets documented.

## What is wrong today

Two trees over the same material, and the split is not by topic - it is by
*format*. Prose went left, demos went right.

| | Documentation | Examples |
| --- | --- | --- |
| Route | `/docs/$docId` | `/examples/$topicId` |
| Units | 8 markdown pages, 2 831 lines | 21 topics, 35 demos |
| Prose lives in | `src/docs/*.md` | `src/examples/examplePages.ts` |
| Renderer | `DocsPage` / `DocsRoutePage` | `ExampleTopicPage` / `ExamplesIndexPage` |
| Index | none | `/examples` |

Concrete symptoms, all measured rather than felt:

- **`features.md` is 776 lines and answers fourteen unrelated questions** -
  selection, pagination, capabilities, pinning, match highlighting,
  ordering, grouping, details, cell selection, autosize, summary row,
  scroll edges, pinned edges, virtualization. Eight of the 21 example
  topics point at it. A reader sent there for row grouping lands on a page
  where grouping is one of fourteen `##` sections.
- **18 dangling cross-page anchors.** `columns.md` says
  `See [Features](#features)`; `features.md` says
  `[persistence](#use-tm-data-grid)`. They are cross-page references
  written as same-page anchors - leftovers from when the docs *were* one
  page. Every one of them is a dead link today. Most of them become real
  same-page anchors under this plan.
- **The CSS variable surface is documented in three places and mostly not
  at all.** The stylesheet defines 17 `--dg-*` variables plus `--row-bg`.
  `components.md` tables 5 of them; `--dg-row-group-bg`,
  `--dg-match-highlight-bg` and `--dg-header-shadow-color` are mentioned in
  passing inside `features.md` prose; the remaining eight are undocumented.
- **A demo's prose is TypeScript.** `title`, `description` and `hint` are
  string fields in `examplePages.ts`. The paragraph explaining the same
  feature is markdown in `src/docs/`. Nobody edits both.
- **Two hops to the thing you wanted.** `/examples/grouping` gives two
  one-line demos and a "Reference documentation ↗" link into the middle of
  a 776-line page. Neither end is complete on its own.

## The touchpoint inventory

Everything a consumer of `@jielga/tmdatagrid` can touch, by kind. This is
the list the page tree has to cover - the coverage test in
[Mechanism](#mechanism) asserts each entry appears in exactly one page's
reference block.

### A - `useTMDataGrid` options

Grid-owned (16): `persist` · `labels` · `enableColumnOrdering` ·
`enablePagination` · `enableRowNumbers` · `quickSearchMode` ·
`enableMatchHighlighting` · `selectionMode` · `showSelectedBackground` ·
`defaultHighlightedRowId` · `onHighlightedRowChange` · `cellSelection` ·
`onFocusedCellChange` · `renderDetails` · `renderDetailsEstHeight` ·
`overscan`

Editing (9), all top-level: `editMode` · `getRowId` · `rowValidators` · `isRowEditable` ·
`onEditCommit` · `onEditCommitBatch` · `newRowDefaults` · `onRowAdd` ·
`onRowDelete`

`meta` (4): `loading` · `noResultsLabel` · `rowHeight` · `totalRowCount`

TanStack passthrough that a reader must still be told about: `data` ·
`columns` · `getRowId` · `state` / `initialState` / `on*Change` ·
`manualPagination` / `manualSorting` / `manualFiltering` / `manualGrouping` ·
`rowCount` · the `enable*` matrix (sorting, column filters, global filter,
hiding, pinning, resizing, row selection, multi-row selection, grouping,
multi-sort) · `autoReset*` · `aggregationFn` / `aggregatedCell`

Return value (10): `table` · `ui` · `edit` · `features` · `labels` ·
`renderDetails` · `renderDetailsEstHeight` · `overscan` · `resetSettings` ·
`scrollToRow` (+ `scrollerRef`)

### B - Components rendered in JSX (14)

`TMDataGrid` · `.Table` · `.Toolbar` · `.Footer` · `.Search` ·
`.FilterButton` · `.ColumnsButton` · `.FilterPanel` · `.ColumnsPanel` ·
`.FilterPills` · `.Spacer` · `.LoadingIndicator` · `.SummaryCount` ·
`TMDataGridEditActions`

### C - Column definition

Helper: `createTMDataGridColumnHelper` · `.accessor` / `.display` /
`.group` / `.columns`

Standard column options: `header` · `cell` · `footer` · `size` / `minSize` /
`maxSize` · `filterFn` · `aggregationFn` · `aggregatedCell` · the
column-level `enable*` flags

`meta` (13): `label` · `type` · `options` · `flex` · `align` · `autoSize` ·
`enableOrdering` · `defaultFilterOperator` · `filterControl` · `editable` ·
`editField` · `validate` · `editor`

Generated column ids (5): `SELECT_COLUMN_ID` · `GROUP_COLUMN_ID` ·
`DETAILS_COLUMN_ID` · `EDIT_COLUMN_ID` · `ROW_NUMBER_COLUMN_ID`

### D - Render props and slots (7)

`renderDetails` · `renderEmptyState` · `rowContextMenu` · `Footer`'s
`pagination` · `meta.filterControl` · `meta.editor` · `Toolbar` children

### E - Callbacks (12)

`onRowClick` · `onCellClick` · `onCellDoubleClick` · `onCellContextMenu` ·
`onScrollToTop` / `Bottom` / `Left` / `Right` · `onReachEnd` ·
`onHighlightedRowChange` · `onFocusedCellChange` · `onEditCommit` ·
`onRowAdd` · `onRowDelete`

### F - `TMDataGrid.Table` props (17)

The callbacks above, plus `rowClassName` · `rowStyle` · `striped` ·
`renderEmptyState` · `rowContextMenu` · `rowContextMenuProps` ·
`cellExport` · `reachEndThreshold`

### G - Styling surface

`size` (5 steps) · `className` · `style` · 17 `--dg-*` variables ·
`--row-bg` · `styles.css` vs `styles.layer.css` · data attributes
(`data-selected`, `data-selected-bg`, `data-highlighted`, `data-grouped`,
`data-depth`, `data-focused`, `data-edge-*`, `data-row-id`,
`data-column-id`, `data-dg-part`)

### H - Exported helpers and hooks (~55 names)

Capabilities · ordering · autosize · aggregation · export · expanding ·
filter operators · column options · labels · sizes · persistence
constants · cell navigation · row selection · pagination api · the two
hooks (`useTMDataGridContext`, `useCellControlTabIndex`) · the six built-in
editors · the four built-in filter controls

### I - Keyboard and pointer contract

Cell navigation (12 keys) · editing entry and commit keys · click and
Shift+click to sort · header drag to reorder · divider drag and
double-click to size · right-click menus (header, row, cell range)

### J - On the side

The testing contract (`data-dg-part` parts, page object, virtualization
waits) and the six intent skills. Real, needed, and not what a developer
implementing a table reads first.

## The page tree

25 content pages, an index and the playground. One nav tree, one route
prefix, and every touchpoint above has exactly one home.

```
/                                   Getting started            [Minimal, ToolbarAndFooter]
/docs                               All pages (card index)

  GRID
  /docs/anatomy                     Grid anatomy               -
  /docs/styling                     Size, CSS variables, theming   [Styling, DensityAndLayout]
  /docs/localization                Localization               [Localization]
  /docs/toolbar                     Toolbar composition        [ToolbarComposition]

  COLUMNS
  /docs/columns                     Defining columns           [ColumnDefinitions, HeaderGroups]
  /docs/sorting                     Sorting                    [Sorting]
  /docs/filtering                   Filtering                  [Filtering, FilterPills,
                                                                BuiltInFilterControls,
                                                                CustomFilterControl]
  /docs/column-layout               Visibility, pinning, order, size   [ColumnLayout]

  ROWS
  /docs/row-selection               Row selection              [SelectionModes, SelectionState]
  /docs/row-details                 Row details                [DetailsPanel]
  /docs/grouping                    Grouping and aggregation   [Grouping]
  /docs/summary-row                 Summary row                [SummaryRow]
  /docs/row-pinning                 Row pinning and numbering  [PinningAndNumbers]
  /docs/row-interaction             Clicks and context menus   [ClickAndContextMenu]
  /docs/row-styling                 Row styling                [RowStyling]

  CELLS AND EDITING
  /docs/cell-selection              Cell selection, copy, export   [CellSelection, CopyAndExport]
  /docs/editing                     Editing modes and gating   [CellEditing, EditableGating,
                                                                RowEditing, BatchEditing]
  /docs/editors                     Editors and validation     [EditorsAndValidation]

  DATA
  /docs/pagination                  Pagination                 [Pagination]
  /docs/quick-search                Quick search               [QuickSearch]
  /docs/persistence                 Persistence                [Persistence]
  /docs/server-side                 Server-side and infinite scroll   [ServerSide, InfiniteScroll]
  /docs/loading-and-empty           Loading and empty states   [LoadingAndEmpty]
  /docs/scrolling                   Scrolling and virtualization   -

  REFERENCE  (on the side)
  /docs/api                         API explorer - the grid    [itself]
  /docs/testing                     Testing                    -

/playground                         Playground
```

All 35 demos are placed; none is dropped, none is duplicated. Two content
pages carry no demo (`anatomy`, `scrolling`) because neither has anything a
grid on screen would show that a neighbouring page does not.

### What each page owns

| Page | Touchpoints it owns |
| --- | --- |
| Getting started | install, `styles.css` import, `data`/`columns`, the `minHeight: 0` layout rule, what is on by default |
| Grid anatomy | `useTMDataGrid` return value, `TMDataGrid` props, the composition rule, where each of the 14 components goes, `useTMDataGridContext` |
| Styling | `size` + the size table, all 17 `--dg-*` variables, `--row-bg` pointer, `className`/`style`, `styles.layer.css` and the CSS layer, `SIZE_ROW_HEIGHT` |
| Localization | `labels`, `mergeLabels`, `TMDATAGRID_LABELS_EN` / `_SV` |
| Toolbar composition | `.Toolbar`, `.Spacer`, `.SummaryCount`, `.LoadingIndicator`, `.FilterButton`, `.ColumnsButton`, `getGridCapabilities`, `getColumnCapabilities`, the `features` argument |
| Defining columns | column helper, accessors, display and group columns, `header`/`cell`, `meta.label`/`type`/`align`/`flex`, `minSize`/`maxSize`/`size`, the 5 generated column ids, `getColumnLabel`/`getColumnType`/`isControlColumn` |
| Sorting | `enableSorting`, `enableMultiSort`, `maxMultiSortColCount`, `isMultiSortEvent`, the priority badge, sorting menu items |
| Filtering | `enableColumnFilters`/`enableColumnFilter`, `.FilterPanel`, `.FilterButton`, `.FilterPills`, all operators, `meta.defaultFilterOperator`, `meta.filterControl`, the 4 built-in controls, `openColumnFilter`, the `filterOperators` exports |
| Column layout | `enableHiding`, `.ColumnsPanel`/`.ColumnsButton`, `enableColumnPinning`/`enablePinning`, `enableColumnOrdering`/`meta.enableOrdering`, `moveColumn`/`moveColumnByStep`/`getStepTargetColumn`/`getColumnRegion`, `enableColumnResizing`/`enableResizing`, `meta.autoSize`, `autosizeColumn`, `resetSettings` |
| Row selection | `selectionMode` (4), `enableRowSelection`, `enableMultiRowSelection`, `showSelectedBackground`, `defaultHighlightedRowId`, `onHighlightedRowChange`, `SELECT_COLUMN_ID`, `--dg-row-selected-bg`, `--dg-row-highlight-bg`, `data-selected`/`-bg`/`data-highlighted`, `getSelectableRowIds`, `resolveRowSelectionClick` |
| Row details | `renderDetails`, `renderDetailsEstHeight`, `DETAILS_COLUMN_ID`, `resolveExpandAll`, `areAllRowsExpanded`, `autoResetExpanded` |
| Grouping | `enableGrouping`, `groupedColumnMode`, `aggregationFn` + the registered names, `aggregatedCell`, `GROUP_COLUMN_ID`, `formatGroupValue`, `getGroupDataRows`, `--dg-row-group-bg`, `data-grouped`/`data-depth`, the pagination interaction |
| Summary row | column `footer`, `aggregateColumn`, `--dg-summary-height` |
| Row pinning | `enableRowPinning`, `row.pin`, `rowPinning` state, `enableRowNumbers`, `ROW_NUMBER_COLUMN_ID` |
| Row interaction | `onRowClick`, `onCellClick`, `onCellDoubleClick`, `onCellContextMenu`, `rowContextMenu`, `rowContextMenuProps` |
| Row styling | `rowClassName`, `rowStyle`, `striped`, `--row-bg`, `--dg-row-striped-bg`, `--dg-row-height` |
| Cell selection | `cellSelection`, `onFocusedCellChange`, `ui.state.focusedCell`/`cellRange`, the key map, `useCellControlTabIndex`, `data-focused`/`data-edge-*`, `cellExport`, `exportGridToCsv` and the `cellExport` module, the cell-range menu |
| Editing | `editMode` (4), `getRowId`, `isRowEditable`, `meta.editable`, `meta.editField`, `onEditCommit`, `newRowDefaults`, `onRowAdd`, `onRowDelete`, `EDIT_COLUMN_ID`, `TMDataGridEditActions`, `api.edit`, `--dg-entry-height` |
| Editors | `meta.editor`, the 6 built-in editors, `TMDataGridEditorArgs`, `meta.validate`, `rowValidators`, `normalizeFieldValidate`, `clearedValueForType` |
| Pagination | `enablePagination`, `.Footer`, the `pagination` render prop, `getTMDataGridPaginationApi`, `isPagingActive` |
| Quick search | `.Search`, `enableGlobalFilter`, `quickSearchMode`, `fuzzyGlobalFilterFn`, `enableMatchHighlighting`, `--dg-match-highlight-bg` |
| Persistence | `persist` and its keys, the settings/data slice lists, storage modes, `PERSIST_PAYLOAD_VERSION`, the `useLocalStorage` comparison |
| Server-side | `manual*`, `rowCount`, sending filters, selection and persistence caveats, `onReachEnd`, `reachEndThreshold` |
| Loading and empty | `meta.loading`, `meta.noResultsLabel`, `meta.totalRowCount`, `renderEmptyState`, `.LoadingIndicator`, `.SummaryCount` |
| Scrolling | always-on virtualization, `overscan`, `meta.rowHeight`, measured detail rows, `scrollToRow`, `scrollerRef`, `onScrollTo*`, scroll-edge shadow, `--dg-header-shadow-color`, `--dg-sticky-edge-range`, pinned-lane bands |
| API explorer | every touchpoint in A–I, as rows in a `TMDataGrid`. See [API reference and search](#api-reference-and-search) |
| Testing | unchanged content, moved under `/docs/testing` |

### The page contract

Every content page has the same spine, so a reader learns the shape once:

1. **What it is** - two or three sentences, and when you would reach for it.
2. **The switch** - the single snippet that turns it on. Nothing else in it.
3. **Demo**, inline.
4. **Behaviour** - the prose. Sub-demos where a second one earns its place.
5. **API on this page** - every touchpoint the page owns, with type,
   default and description. Not written: `<ApiGrid page="filtering" />`,
   the same component `/docs/api` mounts unfiltered. Mantine and Chakra
   both end a component page this way, and both generate it.

Sections 1–4 are markdown. Section 5 is one line of fence.

## API reference and search

### What the field actually does

Checked 2026-08-16 rather than remembered:

| Site | Props | Right rail | Search |
| --- | --- | --- | --- |
| Mantine | Inline section at the page bottom, generated from types. Plus a Styles API section | Yes | `Ctrl + K` in the top bar |
| Chakra UI | Inline table at the page bottom - prop, default, type, description | Yes, "On this page" | `⌘K`, top right |
| MUI | Separate `/api/<component>` route, linked from the page | Yes | `⌘K` |
| Radix | "API Reference" section at the page bottom, one table per part | Yes | `⌘K` |

**Nobody uses tabs.** Everyone converged on: linear page, props inline at
the bottom, right-hand table of contents, `Ctrl+K` palette. Tabbed API
sections lose because their content does not deep-link, does not answer
`Ctrl+F`, and does not get indexed by the search that sits above it.

So tabs are out. But the convergent answer does not fully work here
either: it assumes one component per page, and `TMDataGrid.Table` carries
seventeen props belonging to six different features. "Inline at the
bottom" can never produce a complete `.Table` props table anywhere.

### The move: the API reference *is* a grid

`/docs/api` renders the entire public surface - every option, prop, column
meta field, callback, CSS variable, data attribute, export and key - as
rows in a `TMDataGrid`.

That is not a gimmick. It is the one page every other library would build
as a static table and this one should not, for four reasons:

- **It solves the split.** "All props for `TMDataGrid.Table`" is a filter,
  not a page. So is "everything about filtering", "every CSS variable",
  "every callback", "every keyboard key". The split-across-pages objection
  from [open question 1](#open-questions) disappears - the complete table
  exists, it is just not the *only* view.
- **It is the same component the per-page sections use.** `<ApiGrid />`
  unfiltered at `/docs/api`; `<ApiGrid page="filtering" />` at the bottom
  of the filtering page. One component, one dataset, two mounts. Every
  page's props table gets sorting, filtering and search for free, and
  there is no second place for a prop to be documented.
- **It is the best demo on the site.** ~250 rows of real, dense, nested
  data - grouping by component, filtering by kind, quick search, a details
  panel holding the long description and the link to the owning page,
  pinned name column, CSV export. The playground is a switch panel; this
  is the library doing a real job. Nobody evaluating a data grid is
  unmoved by a docs site whose API reference is the product.
- **It is cheap.** The grid already exists. The page is a `TMDataGrid`
  over a JSON array.

The reference section collapses from three routes to one: the keyboard
reference is `/docs/api` filtered to `kind = Key`, and the "API index" is
the unfiltered view.

> **Dropped 2026-08-16.** The generated half of this section is not being
> built. Reference tables are hand-written markdown at the bottom of each
> page - the Mantine and Chakra shape - and the `Ctrl+K` index is built by
> scanning that markdown, which is the same single source of truth without a
> generator. That removed the `.d.ts` parser, the invented `@docsPage` tag and
> the `build:lib`-before-`build` pipeline change in one go. If the tables
> start drifting from the code, generation can be added later without moving
> a single page.
>
> The **API explorer as a grid** is still worth building and still unbuilt;
> it just reads the same markdown-derived index rather than a `.d.ts`.

### Where the data comes from

`dist/index.d.ts` - 2 781 lines, 369 JSDoc blocks, JSDoc fully preserved
through `rolldown-plugin-dts`, and by construction exactly the public
surface with nothing private leaking in. A build step parses it into
`api.json`.

Parsing the `.d.ts` rather than driving the TypeScript compiler API is
deliberate: no dependency on the TS 7 (Go port) API surface, no
`ts-morph`, and the same style as the existing `scripts/*.mjs`. A member
plus its preceding JSDoc block is a small, boring parser.

The descriptions are already good enough to ship - this is
`enablePagination` today, verbatim from the source:

> Client-side pagination and the built-in `TMDataGrid.Footer` pager.
> Defaults to `false`: the grid renders every filtered row and relies on
> virtualization.

One thing the `.d.ts` cannot know is which page owns a symbol. That comes
from a **`@docsPage` JSDoc tag** on the declaration:

```ts
/**
 * Client-side pagination and the built-in `TMDataGrid.Footer` pager.
 * @docsPage pagination
 */
enablePagination?: boolean;
```

The tag lives beside the code, survives refactors, and turns coverage into
a one-line test: **every exported name has a `@docsPage` tag naming a page
that exists.** A new option with no documented home fails CI. That
replaces assertion 4 of the [coverage test](#the-coverage-test), and it is
strictly better - it checks the code, not a markdown table someone
remembered to update.

CSS variables, data attributes and keyboard keys have no declaration to
tag, so those stay a hand-written table (`src/docs/api/extras.ts`) merged
into the same `api.json`. A test asserts every `--dg-*` in the stylesheets
appears in it.

### Search - **built 2026-08-16**

Top bar, `Ctrl+K`. Three kinds of entry in one index, built at module load
from the markdown the site already ships
([searchIndex.ts](../src/docs/searchIndex.ts)):

| Kind | Comes from | Example |
| --- | --- | --- |
| **Page** | `DOCS_PAGES` label and description | *Grouping* |
| **Section** | Every `##` / `###`, deep-linked to its slug | *Grouping suspends pagination* |
| **API** | The first backticked cell of each Reference-table row | `onCellClick` |

The API lane needs no generator: a name is documented on the page whose
Reference table lists it, so scanning `^\| \`([^\`]+)\` \|` *is* the
symbol-to-page map.

Ranking, in [`searchDocs`](../src/docs/searchIndex.ts):

1. A literal hit on the **whole query** - exact, prefix, contains - weighted
   double. An exact name beats everything.
2. Then **per word**, splitting on whitespace *and camelCase humps*, with
   matching more words scoring higher.
3. Anything still unmatched falls to match-sorter's fuzzy rank.

The camelCase split is what makes both of the stakeholder's examples work:

- `onCellClick` → the symbol, first, exactly.
- `onClickExample` → splits to `on` / `click` / `example`; `click` finds
  `onCellClick` and `onCellDoubleClick`.
- `cell sorting` → two words, no symbol match; *Sorting* and *Cell
  selection* rank top. As one string this matched **nothing**, which is what
  [searchIndex.test.ts](../src/docs/searchIndex.test.ts) now pins.

**The fuzzy matcher is the grid's own.** `@tanstack/match-sorter-utils` is
already a runtime dependency - it powers `fuzzyGlobalFilterFn` and the quick
search - so the docs search costs **zero new dependencies** and demonstrates
the same matching the library sells. The palette is Mantine's `Modal` rather
than `@mantine/spotlight`: the ranking is the interesting part and it lives
in the index, so the shell is an input, a list and four keys.

### The header - **built 2026-08-16**

The shape every library docs site has settled on, in
[AppHeader.tsx](../src/AppHeader.tsx): brand mark and wordmark, the live
version badge, the search box, GitHub, and the theme switch (moved up out of
the nav's bottom corner).

The version is read from the npm registry at runtime, not stamped at build
time - the site deploys from the same push that publishes, so a stamped
version is right the moment it ships and quietly wrong from the next merge
that skips a release. While the package is in prerelease the badge shows the
`beta` tag, since that is what `npm install @jielga/tmdatagrid@beta` gives
you. The fetch is shared with the front page's fuller status strip through
[packageStatus.ts](../src/packageStatus.ts).

The search control is a **button styled as an input**. A real input would
take focus on click and then have to hand it to the palette's own field.

### Inline symbol links

In markdown, `` `onCellClick` `` is inline code. When the name is in
`api.json`, the existing `code` renderer turns it into a link to its row,
with a hover card showing type, default and the first line of the
description.

Every mention of every symbol across 25 pages becomes a cross-reference,
automatically, with no author discipline required - and it is roughly
fifteen lines inside a renderer that already special-cases `code`.

### The right rail - **built 2026-08-16**

An "On this page" table of contents, sticky, built from the page's headings,
which is what Mantine, Chakra, MUI and Radix all have. Deep links, and an
IntersectionObserver marks the heading you are reading under.

It appears at `min-width: 1280px` and drops out below, where the article
would start losing width to it. Not a second API sidebar: two rails plus
content leaves no content.

Two bugs surfaced while building it, both now fixed:

- **The renderer emitted no heading `id`s at all**, so every `#anchor` on the
  site was dead - not just the 18 cross-page ones this plan counted. Headings
  now carry GitHub-style slugs, and [headings.ts](../src/docs/headings.ts) is
  the one slug function the renderer and the rail share, so a rail link
  cannot drift from the anchor it points at.
- **Root-relative links dropped their hash.** `/docs/grouping#aggregation`
  was handed to the router as a path, which matched no route. The hash is
  now split off and passed separately.

## Mechanism

### The demo fence

Markdown stays plain markdown - no MDX. `package.json` points
`intent.docs` at `src/docs/`, six `SKILL.md` files cite those paths as
`sources:`, and agents read them as text. A fenced block names the demo:

````markdown
Group by from any column menu. Only the columns told how to aggregate fill
in - the rest stay blank.

```demo
file: rows/Grouping.tsx
hint: "Group by …" lives in every column menu. Group by Location as well and the tree nests.
height: 460
extraSources: data/employees.ts
```
````

`DocsMarkdown` already intercepts `code` by language class; `language-demo`
routes to the existing `DemoBlock` instead of `CodeBlock`. A raw reader
sees the path and the hint, which is an honest degradation - the LLM
reading `grouping.md` is told exactly which file the demo is.

`title` and `description` disappear from the demo entry: the surrounding
prose is the description, and the heading above it is the title. That is
35 pairs of strings deleted from TypeScript and replaced by the paragraph
that was already going to be written.

Parsing is a `key: value` scan over the fence body - about 25 lines, no new
dependency.

### One page tree

`docsPages.ts` and `examplePages.ts` collapse into one `pages.ts`:

```ts
export type DocsPage = {
  id: string;            // route: /docs/{id}
  section: DocsSection;  // nav group
  label: string;
  description: string;   // card index + nav
  source: string;        // the markdown
};
```

Demos are no longer listed here - they are discovered from the fences, so a
demo cannot be registered in one place and rendered in another. `DocsPage`,
`DocsRoutePage` and the nav stay; `ExampleTopicPage` and
`ExamplesIndexPage` are deleted, the latter replaced by `/docs` rendering
the same cards over the new tree.

### The coverage test

Extends `demos.test.tsx`, which already tests every demo and every docs
link. Four new assertions, all cheap and all from data already in the repo:

1. Every demo file under `src/examples/demos/` is named by exactly one
   fence. (Today: named by exactly one topic.)
2. Every fence names a file that exists, and every `extraSources` entry
   resolves.
3. Every `/docs/...` link in any page resolves to a page id **and, where it
   has one, to a heading that exists** - the check that would have caught
   all 18 dangling anchors.
4. Every name in `api.json` carries a `@docsPage` tag naming a page that
   exists, and every `--dg-*` variable in the stylesheets appears in the
   hand-written extras table. A new export with no documented home fails
   CI.

Assertion 4 is the one that makes this hold. Without it the structure decays
back into the current state within a release or two - and because it checks
the JSDoc rather than a markdown table, it fails in the PR that adds the
option, not a release later.

## Migration

| # | Step | Size | Notes |
| --- | --- | --- | --- |
| 1 | Demo fence + renderer, unified `pages.ts`, one nav, `/docs` index | M | No content moves. Both old trees still render, off one list. |
| 2 | Redirects: 8 old `/docs/*` ids, 21 `/examples/*` ids, `/examples`, and a hash map for `features.md`'s 14 sections | S | Do it with step 1, so nothing 404s at any point |
| 3 | Getting started + Grid anatomy + Styling + Localization + Toolbar | M | Proves the page contract on five pages before committing to 20 more |
| 4 | Columns: 4 pages, from `columns.md` + parts of `features.md` | M | |
| 5 | Rows: 7 pages, almost all out of `features.md` | L | The biggest single move - `features.md` loses ~450 lines here |
| 6 | Cells and editing: 3 pages | M | |
| 7 | Data: 6 pages | M | |
| 8 | `api.json` generator: `.d.ts` parser + `@docsPage` tags + extras table | M | Independent of steps 3–7; can run first or in parallel |
| 9 | `ApiGrid`, `/docs/api`, and the `<ApiGrid page=…>` fence | M | Needs step 8. The site's best demo |
| 10 | Right-rail table of contents | S | Headings the renderer already walks |
| 11 | `Ctrl+K` search: two-lane index over `api.json` + headings | M | Needs step 8. `@mantine/spotlight` as a dev dep |
| 12 | Inline symbol links and hover cards | S | Optional. Nice once step 8 exists |
| 13 | Coverage test assertions 1–4 | S | Land last; it will fail until the tree is complete |
| 14 | Delete `ExampleTopicPage`, `ExamplesIndexPage`, `examplePages.ts` prose; repoint the 6 skills' `sources:` | S | |

Steps 4–7 are independent of each other and can run in any order or in
parallel. Step 8 gates 9, 11 and 12 but nothing else, so the API and
search track can run alongside the content track throughout. Each step is
one commit, one changeset, and leaves the site working.

Total: **one L, six M, five S** - the API/search track adds two M and two S
over the content-only version. Comparable to the examples-showcase wave,
and mostly moving text that already exists rather than writing new text.

**One pipeline change:** the generator reads `dist/index.d.ts`, so the docs
build gains a dependency on `build:lib`. `npm run build` becomes
`build:lib && tsc -b && vite build`, and
[deploy-docs.yml](../.github/workflows/deploy-docs.yml) needs the same
order. Cheap, but it is a real change to how the site builds.

## Loose ends, deliberately on the side

- **Testing** keeps its page and its content, under `/docs/testing`, last
  in the nav. It is a real page for a real need, and it is not what the
  primary reader opens.
- **The six intent skills** keep their own granularity - an LLM loads one
  skill for a task, which is not the same cut as a reader navigating a
  tree. Only the `sources:` frontmatter changes: each skill lists the 3–6
  pages that now hold its material. `intent stale` will flag drift once,
  after step 10, which is the intended signal.
- **`data-dg-part`** is documented on the testing page and referenced from
  the Reference block of whichever page owns the part. The index links
  both ways.
- **Styles API.** Mantine documents, per component, which internal element
  each style target hits. The grid's equivalent is its `data-dg-part`
  vocabulary, which already exists for testing. Exposing those parts as a
  styling surface - a fifth kind in `api.json` - is a natural follow-up
  once the CSS variables are all documented, not part of this plan.

## Open questions

1. ~~**Splitting `TMDataGrid.Table`'s props across six pages.**~~
   **Closed** by [the API explorer](#the-move-the-api-reference-is-a-grid):
   the complete `.Table` props table exists at `/docs/api` as a filter,
   with types and defaults, alongside the per-page sections. Both views,
   one dataset, no duplication.
2. **Page count: 25 content pages.** Some are thin - `sorting`,
   `summary-row`, `scrolling`. *Recommend: keep them thin and separate.*
   A thin page is a page a reader finishes; the merged alternative is how
   `features.md` got to 776 lines.
3. **Route prefix.** Keep `/docs/*`, or drop to `/sorting`, `/grouping`?
   *Recommend: keep `/docs/*`* - every external link already has it, and
   `/playground` stays a clean peer.
4. **Demo file paths.** `getting-started/DensityAndLayout.tsx` would move
   to a page whose id is `styling`. *Recommend: leave the paths alone* -
   they are internal, and renaming 35 files churns the diff for no reader.
5. **Where this lands.** The 1.0 wave is on `feature/next` with
   [P2–P4 pending](proposals.md); P2's rename table would change option
   names this documents. *Recommend: steps 1–2 now* (mechanism, no content
   moves, no conflict), **steps 3–10 after P2 is settled** - otherwise the
   content gets moved twice.

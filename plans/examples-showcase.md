# Examples showcase - plan

> **Status: executed 2026-08-10.** Approved as amended: the list was cut from
> 27 topics / 60 demos to 24 / 34 before any of it was built (see [Maintenance
> cost](#maintenance-cost)). All five open questions settled as recommended.
> Shipped on `feature/next`; picks up the "Showcase pass" bullet in
> [BACKLOG.md](../BACKLOG.md).
>
> **What landed, against the plan:**
>
> - 24 topics, 35 demos, one route each under `/examples/<topic>`, plus
>   `/examples` as a card index and `/playground` for the kitchen sink.
> - `rowStyle` was widened to `TMDataGridRowStyle` while writing the row
>   styling demo - its own JSDoc showed `{ "--row-bg": … }`, which did not
>   typecheck. A union rather than an intersection, so a callback returning
>   plain `CSSProperties` still compiles.
> - Explanatory prose was pulled out of the demo files into a `hint` field on
>   the topic entry after the first pass put it in the components: it
>   duplicated the topic description and polluted the source people copy.
> - Shiki is built from `shiki/core` with five grammars and the JavaScript
>   regex engine - the `shiki` entry point emitted ~200 language chunks and a
>   622 kB oniguruma WASM blob for a site that shows tsx, ts, css, bash, json.
> - Nav links needed `activeOptions={{ exact: true }}`: the router's default
>   prefix match set `aria-current` on `/examples` for every topic under it.

Costs are complexity, not hours: S (contained, one commit), M (touches a few
subsystems), L (new subsystem or real design surface).

## Where the examples stand today

Three pages, flat in the sidebar, and between them they carry the whole
feature surface:

| Page | Lines | What it is |
| --- | --- | --- |
| `/data-grid` `DataGridExample` | 918 | Every feature at once behind ~25 switches, plus a snippet generator |
| `/editable-grid` `EditableGridExample` | 373 | Three grids stacked in one viewport - cell, row, batch |
| `/infinite-scroll` `InfiniteScrollExample` | 161 | One idea, told once. The only page that reads as an example |

What is wrong with that:

- **Nothing is copyable.** There is no way to see the code behind a page
  short of finding the file on GitHub. The one exception - "Get the code" -
  emits a *reconstruction* of the switch positions, not the source you are
  looking at.
- **The kitchen sink teaches nothing specific.** A reader who wants to know
  how row grouping is wired has to find it inside 918 lines of switch
  plumbing, tooltips and viewport heuristics. The demo scaffolding outweighs
  the API being demonstrated roughly 4:1.
- **The editable page is three demos in one scroll.** Three grids sharing a
  viewport at `flex 3 / 2 / 2` means none of them is tall enough to use, and
  the mode toggle at the top applies to only the first.
- **Features with no demo at all**: cell click handlers, per-row styling,
  scroll-edge callbacks, custom filter controls beyond the two built-ins,
  `meta.editable` gating, manual pagination, persistence slices,
  `resetSettings`, toolbar composition beyond one Export button, partial
  label overrides, CSS-variable styling.
- **The nav is flat**, so there is no place to put more pages without it
  becoming a list of thirty peers.

## How other libraries solve this

| Library | Shape |
| --- | --- |
| **MUI X DataGrid** | One page per feature, several small demos per page, each with a "show source" expander, copy button, and a StackBlitz/CodeSandbox link. Demo data comes from one shared hook so demos stay short. |
| **Mantine React Table** | A handful of whole-app examples (basic/advanced/remote) *plus* a per-feature guide section where each guide holds 1–3 focused demos with a source accordion. |
| **Mantine DataTable** | Tree nav, one narrow page per idea, demo on top and its exact source underneath in a highlighted block with a copy button. |
| **AG Grid** | One focused live example per feature page, editable in place, "open in …" escape hatch. |

The shared lesson, and the rule this plan adopts:

> **One demo teaches one thing. A page groups the demos that belong to one
> topic. The kitchen sink survives as exactly one page, clearly labelled as
> such.**

The second shared lesson is about data: **shared data, local columns.**
Nobody wants to read a fake-data generator twice, so the data module is
shared and out of sight. Column definitions *are* the API being taught, so
they stay in the demo file where they can be read.

## Structure

### Nav tree

`EXAMPLES` becomes a two-level tree (Mantine `NavLink` nests natively):
category → topic. **Playground** sits at the top, outside the categories,
so the "show me everything" page is one click from anywhere.

```
EXAMPLES
  Playground             ← the renamed kitchen sink
  All examples           ← the card index
  Getting started
    Basic grid
    Column definitions
    Density and layout
  Columns
    Sorting
    Filtering
    Filter controls
    Visibility, pinning and ordering
  Rows
    Row selection
    Row details
    Grouping and summary
    Pinning and numbering
    Styling and interaction
  Cells
    Cell selection and export
  Data
    Pagination
    Quick search
    Persistence
    Server-side data
    Infinite scroll
    Loading and empty states
  Editing
    Cell editing
    Row and batch editing
    Editors and validation
  Customization
    Toolbar and localization
    Styling
DOCUMENTATION            (unchanged - the seven markdown pages)
```

Examples come first in the sidebar: they are what a first visit wants, and
the reference pages are what a second one does.

Categories are nav grouping only, so routes stay flat and short:
`/examples/sorting`, `/examples/row-details`, `/playground`. `/examples`
itself is an index page - a card grid of every topic, which is also where
someone who arrives from npm lands.

Old routes redirect: `/data-grid` → `/playground`, `/infinite-scroll` →
`/examples/infinite-scroll`, `/editable-grid` → `/examples/cell-editing`.

The child NavLinks lose the two-line `description` the current nav shows -
at 27 entries it stops being scannable. Descriptions move to the topic page
header and the `/examples` index cards. Rail widens 230 → 260.

### Files

```
src/examples/
  data/
    employees.ts          Employee type, deterministic generator, DEPARTMENTS…, sek()
    orders.ts             the 100k-row "server" for server-side + infinite scroll
  demos/
    <topic>/<Demo>.tsx    one file, one idea, 30–70 lines
  DemoBlock.tsx           frame: title, description, live area, source panel
  CodeBlock.tsx           shared highlighted code + copy (used by docs too)
  demoRegistry.ts         import.meta.glob pairing component ↔ ?raw source
  examplePages.ts         the tree - categories, topics, which demos each holds
  ExampleTopicPage.tsx    renders a topic: header, docs link, its DemoBlocks
  ExamplesIndexPage.tsx   the card grid
  playground/             the current DataGridExample, moved and renamed
```

`employees.ts` carries **one** type wide enough for every demo - string,
number, date, boolean, select and multiSelect all present - so a reader who
has read it once reads every later demo faster:

```ts
export type Employee = {
  id: number; firstName: string; lastName: string; email: string;
  department: string; location: string; salary: number; age: number;
  hired: string; active: boolean;
  status: "Active" | "On leave" | "Terminated"; skills: Array<string>;
};
```

Generation stays deterministic (as today) so nothing shifts between reloads
or screenshots. `orders.ts` exists only because server-side and infinite
scroll need a second, much larger set behind a fake `fetchOrders`.

## The source viewer

### Registry

Vite's `?raw` gives the exact file text, so the code shown can never drift
from the code running. Pairing two globs on the same paths means adding a
demo is adding a file - no manual registration:

```ts
const components = import.meta.glob("./demos/**/*.tsx", { eager: true });
const sources = import.meta.glob("./demos/**/*.tsx", {
  query: "?raw", import: "default", eager: true,
});
```

A topic in `examplePages.ts` names its demos by path plus the prose the file
should not have to carry:

```ts
{
  id: "sorting",
  category: "Columns",
  label: "Sorting",
  description: "Single and multi-column sorting, and where the state lives.",
  docs: "/docs/features#multi-column-sorting",
  demos: [
    { file: "columns/SortingBasic.tsx", title: "Sorting", description: "…" },
    { file: "columns/MultiSort.tsx", title: "Multi-column", description: "…",
      extraSources: ["data/employees.ts"] },
  ],
}
```

### DemoBlock

- **Header** - title, one-line description, and on the right: a `Code`
  toggle, a copy button, and a `Docs ↗` link to the relevant docs anchor.
- **Body** - the live demo in a bordered card at a fixed height (360px,
  480px for editing demos) so the page does not jump as demos mount.
- **Source** - collapsed by default, `CodeHighlightTabs` with the demo file
  first and any `extraSources` (usually `employees.ts`) as further tabs.
  Expand button over a max collapsed height so a long file cannot swallow
  the page.

DemoBlock stays dumb: any controls a demo needs (a mode toggle, a switch)
live *inside* the demo component, so they show up in the source. That is
honest, and it keeps the frame from growing a props surface.

### Highlighting

`@mantine/code-highlight` (pinned to the installed `@mantine/core`, 9.4.1)
with the async shiki adapter, themes `github-light` / `github-dark` driven by
the app's colour scheme. It brings the copy button and the tab strip with it.

Shiki over highlight.js: TSX highlighting is the whole job here, shiki gets
generics and JSX right where highlight.js guesses, and the adapter is async
so it code-splits out of the initial load. Both are dev-only - the published
package gains nothing.

The same `CodeBlock` then replaces the unhighlighted `<pre>` that
`DocsPage` currently emits for markdown fences, so docs and examples show
code the same way. `StarterSnippetModal` re-skins onto it too and drops its
hand-rolled clipboard fallback.

## Maintenance cost

The first draft of this plan listed 27 topics and ~60 demos. Cut to 24 and 34
before anything was built, by merging every pair that differed by one prop -
a 70-line `Filtering.tsx` covering the panel, the operators,
`defaultFilterOperator` and a programmatic filter is more copyable than three
30-line files, not less.

What actually costs anything is not the total but how many files a change
touches:

| Change | Files touched |
| --- | --- |
| A new option or prop | 1 - the topic that owns it, or one new file |
| A public API renamed | Whatever the compiler lists; mechanical |
| Behaviour of a feature changes | 1–3 - that topic's demos, and its docs page |
| Internals, styling, performance | 0 - demos do not reach inside |

So 34 is a one-time build cost. Four things keep it that way:

- **The compiler is the maintenance mechanism.** `npm run build` runs `tsc -b`
  over `src`, so every demo is typechecked. A rename fails the build. Compare
  the 2 200 lines of markdown under `src/docs/`, whose fences nothing checks -
  demos are the lower-rot half of the documentation, not the higher.
- **One test covers all of them.** `demos.test.tsx` walks the registry and
  mounts each demo. Adding a demo adds no test.
- **All prose in one file.** One line of description per demo in
  `examplePages.ts`, plus an optional `hint`. Demo files carry no prose at
  all, which is also what keeps their sources worth copying.
- **Shared where it does not teach.** `data/employees.ts` for the dataset,
  `data/employeeColumns.tsx` for demos whose subject is not the column - they
  drop from ~45 lines to ~25. Both appear as source tabs, so nothing the demo
  depends on is hidden.

What is deliberately *not* shared: imports, the `useTMDataGrid` call and the
`<TMDataGrid>` JSX. That is the copy target. A demo reading
`<StandardGrid columns={cols} />` teaches nothing.

The cadence that keeps this from ever being a migration: **a user-facing
feature ships with its demo, the same way it ships with a changeset.**

## The examples

24 topics, 35 demos.

### Playground - `/playground`

The old `DataGridExample`, renamed and moved to `examples/playground/`,
otherwise unchanged. Its job is the one thing focused demos cannot do: prove
the features compose, and let someone dial in a configuration and take the
code. Labelled as the kitchen sink so nobody reads it as a starting point.

### Getting started

| Topic | Demos |
| --- | --- |
| **Basic grid** | `Minimal` - data, columns, `TMDataGrid.Table`, nothing else · `ToolbarAndFooter` - the compound parts, added one checkbox at a time |
| **Column definitions** | `ColumnDefinitions` - key and computed accessors, a custom `cell`, all six `meta.type`, `align`, `flex`/`minSize` · `HeaderGroups` - `columnHelper.group`, and why the group is a header row rather than a column |
| **Density and layout** | `DensityAndLayout` - xs→xl, and filling a flex parent without forgetting `minHeight: 0` |

### Columns

| Topic | Demos |
| --- | --- |
| **Sorting** | `Sorting` - `initialState.sorting`, per-column opt-out, Shift+click multi-sort, the state read off the table store |
| **Filtering** | `Filtering` - operators per type, `defaultFilterOperator`, `enableColumnFilter: false`, a filter set from a button · `FilterPills` - pills outside the grid via the `api` prop |
| **Filter controls** | `BuiltInFilterControls` - all four `Dg*` controls, one per column · `CustomFilterControl` - chips written against `TMDataGridFilterControlArgs` |
| **Visibility, pinning and ordering** | `ColumnLayout` - columns panel, pinning both edges, `meta.enableOrdering: false`, persistence, `resetSettings()` |

### Rows

| Topic | Demos |
| --- | --- |
| **Row selection** | `SelectionModes` - the four modes and `enableMultiRowSelection` · `SelectionState` - `table.store` subscription driving a bulk-action bar |
| **Row details** | `DetailsPanel` - `renderDetails`, `renderDetailsEstHeight`, panels of differing height, expanding from outside |
| **Grouping and summary** | `Grouping` - group by, `aggregationFn`/`aggregatedCell` · `SummaryRow` - `footer` + `aggregateColumn` over every filtered row |
| **Pinning and numbering** | `PinningAndNumbers` - `enableRowPinning` from a context menu, `enableRowNumbers` |
| **Styling and interaction** | `RowStyling` - `striped`, `rowStyle` via `--row-bg` · `ClickAndContextMenu` - row/cell/double-click handlers and `rowContextMenu` |

### Cells

| Topic | Demos |
| --- | --- |
| **Cell selection and export** | `CellSelection` - none/single/range, the cursor read off the ui store · `CopyAndExport` - Ctrl+C into Excel, `cellExport`, `exportGridToCsv` |

### Data

| Topic | Demos |
| --- | --- |
| **Pagination** | `Pagination` - `enablePagination`, `pageSizeOptions`, and the `Footer` `pagination` render prop |
| **Quick search** | `QuickSearch` - fuzzy vs contains, `enableMatchHighlighting` |
| **Persistence** | `Persistence` - `settingsKey` plus a narrowed `dataKey`, and Reset layout |
| **Server-side** | `ServerSide` - `manualPagination`/`manualSorting`/`manualFiltering`, `rowCount`, `meta.loading` against a fake server |
| **Infinite scroll** | `InfiniteScroll` - the old page, moved into the frame |
| **Loading and empty states** | `LoadingAndEmpty` - `meta.loading`, `renderEmptyState` on both branches of `hasActiveFilters` |

### Editing - replaces `/editable-grid`

| Topic | Demos |
| --- | --- |
| **Cell editing** | `CellEditing` - `cell` vs `cellConfirm`, `onEditCommit` · `EditableGating` - `meta.editable`, `isRowEditable`, `meta.editField` |
| **Row and batch editing** | `RowEditing` - the edit lane, `rowValidators` with a cross-field `.refine()` · `BatchEditing` - drafts, adds and deletions in one commit |
| **Editors and validation** | `EditorsAndValidation` - one column per built-in editor, a custom `meta.editor`, per-column Zod |

### Customization

| Topic | Demos |
| --- | --- |
| **Toolbar and localization** | `ToolbarComposition` - own actions beside the built-ins · `Localization` - the Swedish preset, and a four-key override |
| **Styling** | `Styling` - `--dg-row-selected-bg`, `--dg-row-highlight-bg`, `--dg-row-striped-bg`, `meta.rowHeight` |

### Deliberately not split out

- **Virtualization** - every demo is virtualized; a page saying so teaches
  nothing. It stays a docs section.
- **Capability helpers** (`grid.features`) - used *inside* the selection and
  toolbar demos where they earn their place, not demoed alone.
Nested header groups were on this list as unverified. They work -
`columnHelper.group` nests, the leaves keep sorting, filtering and resizing,
and the table already rendered more than one header row. **Column
definitions** gained a second demo for it, so the list is now empty.

## What is left

Nothing. Every optional item was decided rather than deferred:

- **StackBlitz "open in" per demo** - **declined 2026-08-10.** Every demo
  already shows and copies its own source, so it would only serve someone who
  wants to *run* a demo rather than read one - at the price of a template
  project (package.json, vite config, peer versions) that has to stay in step
  with the package forever. Reopen only if people ask to run them.
- **Docs → example cross-links** - done. Every reference page opens with a
  `> **Live examples:**` line, and a test fails if one of those links names a
  topic that no longer exists.
- **"On this page" rail** - not needed. No topic has more than two demos, and
  the sidebar already lands you on the one you want.

## Decisions taken - 2026-08-10

All five settled as recommended.

| # | Question | Decision |
| --- | --- | --- |
| 1 | Route shape | Flat `/examples/<topic>`; the tree is nav grouping only. |
| 2 | Highlighter | Shiki - accurate TSX, lazily loaded, and it code-splits out of the initial load. |
| 3 | Docs and examples | Stay separate, cross-linked. Each topic links to its reference page. |
| 4 | "Get the code" | Kept on the playground, re-skinned onto `CodeBlock`; its hand-rolled clipboard fallback dropped for the block's own copy button. |
| 5 | Scope | Everything but the optional items - built in one pass rather than phased, since the cut list made that affordable. From here, a feature ships with its demo. |

# TMDataGrid

A data grid for React built on [TanStack Table v9](https://tanstack.com/table)
and [Mantine](https://mantine.dev). Rows are always virtualized, columns are
resizable, reorderable, sortable, filterable, hideable and pinnable, and every
part of the grid interface is a component you render yourself.

## Installation

```sh
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual` and `@tabler/icons-react`.

> **TanStack Table v9 is still in beta.** The grid is built against
> `^9.0.0-beta.21` and uses its feature-registry API, which beta releases may
> change without a major bump. Pin `@tanstack/react-table` and
> `@tanstack/table-core` to an exact version if you need reproducible installs.

Import both stylesheets once in your app, Mantine's first:

```ts
import "@mantine/core/styles.css";
import "@jielga/tmdatagrid/styles.css";
```

The grid must be rendered inside a Mantine `MantineProvider`.

## Usage

`useTMDataGrid` creates the table, `TMDataGrid` provides it through context, and
the parts rendered inside read what they need from that context.

```tsx
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";

type Employee = { id: number; firstName: string; age: number };

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { type: "number" } }),
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
  }),
]);

export function Employees({ data }: { data: Employee[] }) {
  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
    enablePagination: true,
  });

  return (
    <TMDataGrid {...grid} size="md" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.ColumnsButton />
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
```

Only the parts you render exist, and only the features you enable have state.
Pagination is opt in through `enablePagination` (implied by `manualPagination`);
by default every row renders, virtualized. A column that defines no filter shows
no filter control.

## Documentation

The documentation is markdown under [`src/docs/`](src/docs), served by the demo
site. There is one page per topic, each holding the prose, its demos and a
reference table. [`docsPages.ts`](src/docs/docsPages.ts) is the registry and the
sidebar order.

| Section              | Pages                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Start here           | [Getting started](src/docs/getting-started.md), [Grid anatomy](src/docs/anatomy.md) |
| Columns              | [Defining columns](src/docs/columns.md), [Sorting](src/docs/sorting.md), [Filtering](src/docs/filtering.md), [Visibility, pinning and size](src/docs/column-layout.md) |
| Rows                 | [Selection](src/docs/row-selection.md), [Details](src/docs/row-details.md), [Grouping](src/docs/grouping.md), [Summary row](src/docs/summary-row.md), [Pinning and numbering](src/docs/row-pinning.md), [Clicks and context menus](src/docs/row-interaction.md), [Row styling](src/docs/row-styling.md) |
| Cells and editing    | [Cell selection](src/docs/cell-selection.md), [Editing](src/docs/editing.md), [Editors and validation](src/docs/editors.md) |
| Data                 | [Pagination](src/docs/pagination.md), [Quick search](src/docs/quick-search.md), [Persistence](src/docs/persistence.md), [Server-side](src/docs/server-side.md), [Loading and empty](src/docs/loading-and-empty.md), [Scrolling](src/docs/scrolling.md) |
| Appearance           | [Size and styling](src/docs/styling.md), [Toolbar](src/docs/toolbar.md), [Localization](src/docs/localization.md) |
| Reference            | [useTMDataGrid](src/docs/use-tm-data-grid.md), [Testing](src/docs/testing.md) |

## Development

The grid lives in [`src/tmdatagrid/`](src/tmdatagrid); everything else in `src`
is the demo site that documents it.

| Path                | Contents                                                     |
| ------------------- | ------------------------------------------------------------ |
| `index.ts`          | The public API, and the only entry point the package exposes  |
| `useTMDataGrid.tsx` | The hook that builds the table, and the types it is built on  |
| `core/`             | Headless logic: filtering, ordering, persistence, capabilities |
| `components/`       | The React components and their co-located CSS modules         |

### Examples

The demo site's examples live in [`src/examples/`](src/examples):

| Path              | Contents                                                       |
| ----------------- | -------------------------------------------------------------- |
| `demoRegistry.ts` | Pairs each demo module with its own source through `import.meta.glob` |
| `demos/`          | One file per demo: one idea, no headings, no explanation        |
| `data/`           | Shared datasets, and the column set used by unrelated demos     |
| `playground/`     | Every feature at once, behind switches                          |

To add a demo, add a file under `demos/` and name it from a ` ```demo ` fence on
the docs page that explains it. The registry pairs each module with its own
source, so the code on screen cannot drift from the code running.
[`demos.test.tsx`](src/examples/demos.test.tsx) mounts every registered demo, so
a demo that stops working fails the suite whether or not it still compiles.

```sh
npm install
npm run dev    # demo site: examples, playground and docs
npm run lint   # oxlint
npm run test   # vitest, once
npm run test:watch
```

## Testing

For testing an application that *uses* the grid, including the test ids, roles
and ARIA attributes it publishes and how to drive it from Playwright, see
[Testing](src/docs/testing.md). What follows is about this repo's own suite.

Vitest with React Testing Library, in jsdom. Tests sit next to the code they
cover as `*.test.ts(x)` and are excluded from both the package and the
declaration build; shared fixtures live in [`src/test/`](src/test) so they stay
out of `src/tmdatagrid/` entirely.

Two things to know before adding to them:

- `vitest.setup.ts` installs what jsdom does not provide: an in-memory
  `Storage`, `matchMedia`, `ResizeObserver`, and element sizes. Element sizes
  matter, because without a measurable box the virtualizer renders no rows.
- The Mantine provider in the harness runs with `env="test"`, which disables
  transitions. Without it a popover never finishes mounting and its panel is
  never found.

## Building

Two independent outputs, neither committed:

| Command             | Output       | Contents              |
| ------------------- | ------------ | --------------------- |
| `npm run build:lib` | `dist/`      | The published package |
| `npm run build`     | `dist-demo/` | The demo site         |

`build:lib` runs three steps. Vite bundles `src/tmdatagrid/index.ts` into
`dist/index.js` with every peer dependency left external, and emits the CSS
modules as a single `dist/styles.css`. TypeScript then writes per-file
declarations to `.types-tmp/`, and rollup flattens those into one
`dist/index.d.ts`.

The declarations are flattened rather than shipped as a tree because
TypeScript emits relative imports verbatim: an extensionless `./TMDataGrid`
resolves only under `moduleResolution: bundler` and breaks for anyone on
`node16`/`nodenext`. A single file has no relative imports to resolve, so it
works everywhere without putting `.js` extensions in the sources.

## Publishing

Releases are managed by [Changesets](https://github.com/changesets/changesets).
Nothing publishes from an ordinary push. A release happens only when the version
PR is merged.

Describe your change in the same PR that makes it:

```sh
npm run changeset      # pick patch/minor/major, write a summary
```

That writes a markdown file under `.changeset/`. Commit it alongside the code.

Once on `main`, [`release.yml`](.github/workflows/release.yml) opens a
**chore: version packages** PR that collects every pending changeset, bumps
`package.json`, writes `CHANGELOG.md` and syncs the skills. Review the version it
picked and the changelog it wrote, then merge it to publish to npm with
provenance.

The package build runs from `prepublishOnly` rather than as a workflow step, so
`npm publish` cannot ship a stale `dist` whether it runs in CI or by hand.

### Skill versions

`npm run version-packages` is `changeset version` followed by
[`scripts/sync-skill-version.mjs`](scripts/sync-skill-version.mjs), which sets
`metadata.library_version` in every `skills/*/SKILL.md` to the new version.

Intent reports a skill as stale when its `library_version` trails the package
version, so without that step every release would leave every skill stale.
Because it runs inside the version command, the bump and the skill sync land in
the same PR.

To check what a release would contain without publishing anything:

```sh
npm publish --dry-run
```

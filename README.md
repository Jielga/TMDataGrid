# TMDataGrid

A data grid for React built on [TanStack Table v9](https://tanstack.com/table) and
[Mantine](https://mantine.dev). Rows are always virtualized, columns are resizable,
reorderable, sortable, filterable, hideable and pinnable, and every piece of grid
chrome is a component you opt into.

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
Pagination is opt-in via `enablePagination` (implied by `manualPagination`) —
by default every row renders, virtualized. A column that defines no filter
shows no filter control.

## Documentation

The documentation is written as markdown under [`src/docs/`](src/docs) and served by the
demo site:

| Page                                           | Contents                         |
| ---------------------------------------------- | -------------------------------- |
| [Getting started](src/docs/getting-started.md) | Structure and defaults           |
| [useTMDataGrid](src/docs/use-tm-data-grid.md)  | Options, meta and persistence    |
| [Components](src/docs/components.md)           | Props for every component        |
| [Columns](src/docs/columns.md)                 | Definitions, sizing and filters  |
| [Features](src/docs/features.md)               | Enabling and disabling behaviour |
| [Server-side](src/docs/server-side.md)         | Manual pagination and filtering  |

## Development

The grid lives in [`src/tmdatagrid/`](src/tmdatagrid); everything else in `src`
is the demo site that documents it.

| Path                | Contents                                                     |
| ------------------- | ------------------------------------------------------------ |
| `index.ts`          | The public API — the only entry point the package exposes     |
| `useTMDataGrid.tsx` | The hook that builds the table, and the types it is built on  |
| `core/`             | Headless logic: filtering, ordering, persistence, capabilities |
| `components/`       | The React chrome and its co-located CSS modules               |

```sh
npm install
npm run dev    # demo site with the grid example and docs
npm run lint   # oxlint
npm run test   # vitest, once
npm run test:watch
```

## Testing

Vitest with React Testing Library, in jsdom. Tests sit next to the code they
cover as `*.test.ts(x)` and are excluded from both the package and the
declaration build; shared fixtures live in [`src/test/`](src/test) so they stay
out of `src/tmdatagrid/` entirely.

Two things worth knowing before adding to them:

- `vitest.setup.ts` installs what jsdom does not provide — an in-memory
  `Storage`, `matchMedia`, `ResizeObserver`, and element sizes. The last one
  matters: without a measurable box, the virtualizer renders no rows at all.
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
Nothing publishes from an ordinary push — a release happens only when the
version PR is merged.

Describe your change in the same PR that makes it:

```sh
npm run changeset      # pick patch/minor/major, write a summary
```

That writes a markdown file under `.changeset/`. Commit it alongside the code.

Once on `main`, [`release.yml`](.github/workflows/release.yml) opens a
**chore: version packages** PR that collects every pending changeset, bumps
`package.json`, writes `CHANGELOG.md` and syncs the skills. The PR is the
release proposal: review the version it picked and the changelog it wrote, then
merge it to publish to npm with provenance.

The package build runs from `prepublishOnly` rather than as a workflow step, so
`npm publish` cannot ship a stale `dist` whether it runs in CI or by hand.

### Skill versions

`npm run version-packages` is `changeset version` followed by
[`scripts/sync-skill-version.mjs`](scripts/sync-skill-version.mjs), which sets
`metadata.library_version` in every `skills/*/SKILL.md` to the new version.

Intent reports a skill as stale when its `library_version` trails the package
version, so without that step every release would leave all five skills stale.
Because it runs inside the version command, the bump and the skill sync land in
the same PR and are reviewed together.

To check what a release would contain without publishing anything:

```sh
npm publish --dry-run
```

# TMDataGrid

A data grid for React built on [TanStack Table v9](https://tanstack.com/table) and
[Mantine](https://mantine.dev). Rows are always virtualized, columns are resizable,
sortable, filterable, hideable and pinnable, and every piece of grid chrome is a
component you opt into.

## Installation

```sh
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual` and `@tabler/icons-react`.

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

Only the parts you render exist. Leave out `TMDataGrid.Footer` and there is no
pagination; a column that defines no filter shows no filter control.

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

```sh
npm install
npm run dev    # demo site with the grid example and docs
npm run lint   # oxlint
```

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

Versions are bumped explicitly — nothing publishes on a merge to `main`.

```sh
npm version patch      # or minor / major — bumps package.json, commits, tags
git push --follow-tags
```

Pushing the tag runs [`publish.yml`](.github/workflows/publish.yml), which
fails if the tag disagrees with `package.json`, then lints, type-checks and
publishes with provenance. The package build runs from `prepublishOnly`
rather than as a workflow step, so `npm publish` cannot ship a stale `dist`
whether it runs in CI or by hand.

To check what a release would contain without publishing anything:

```sh
npm publish --dry-run
```

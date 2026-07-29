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
import { createTMDataGridColumnHelper, TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";

type Employee = { id: number; firstName: string; age: number };

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { type: "number" } }),
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("age", { header: "Age", meta: { type: "number", align: "right" } }),
]);

export function Employees({ data }: { data: Employee[] }) {
  const grid = useTMDataGrid({ data, columns, getRowId: (row) => String(row.id) });

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

| Page | Contents |
| --- | --- |
| [Getting started](src/docs/getting-started.md) | Structure and defaults |
| [useTMDataGrid](src/docs/use-tm-data-grid.md) | Options, meta and persistence |
| [Components](src/docs/components.md) | Props for every component |
| [Columns](src/docs/columns.md) | Definitions, sizing and filters |
| [Features](src/docs/features.md) | Enabling and disabling behaviour |
| [Server-side](src/docs/server-side.md) | Manual pagination and filtering |

## Development

```sh
npm install
npm run dev        # demo site — grid example and docs
npm run build      # demo site  → dist-demo
npm run build:lib  # package    → dist
npm run lint       # oxlint
```

The demo site lives in [`src/examples/`](src/examples) and the grid itself in
[`src/tmdatagrid/`](src/tmdatagrid).

## Releasing

Versions are bumped explicitly; there is no automatic release on merge.

```sh
npm version patch      # or minor / major — commits and creates the tag
git push --follow-tags
```

Pushing the tag runs [`.github/workflows/publish.yml`](.github/workflows/publish.yml),
which verifies the tag matches `package.json`, lints, type-checks and publishes
to npm with provenance. The package build runs from `prepublishOnly`, so `dist`
is always rebuilt from the tagged commit.

Publishing requires an `NPM_TOKEN` repository secret — an npm granular access
token with write access to the `@jielga` scope.

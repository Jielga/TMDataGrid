---
name: tanstack-table-v9-meta
description: Reference for defining and using `meta` on TanStack Table v9 (table-level and column-level), including the v9 `metaHelper`/`tableFeatures` typing pattern and a generic, reusable table component pattern for passing typed render functions (e.g. a row-details renderer) through `meta` when `TData` isn't known ahead of time. Use whenever working with TanStack Table v9 meta, typed table options, or building generic/reusable table components.
---

# TanStack Table v9 — `meta` Reference

Notes on `meta`, typed with `metaHelper` (v9's preferred approach, no global
declaration merging), for a React + strict TypeScript stack (Mantine/Chakra +
Emotion, no Tailwind).

## Two levels of `meta`

- **Table-level**: `options.meta`, set via the `meta` table option, read via
  `table.options.meta`. Good for cross-cutting things like a shared render
  function, locale object, or update handler.
- **Column-level**: `columnDef.meta`, read via `column.columnDef.meta`. Good
  for per-column config (alignment, filter variant, etc).

This file focuses on table-level `meta`.

## Typing `meta` with `metaHelper` (preferred over declaration merging)

v9 replaces v8's global `declare module` augmentation with a type-only
`tableMeta` slot registered on `tableFeatures()`. This scopes the type to
tables built from that specific `features` object — important once you have
multiple tables with different feature sets or different `TData` shapes.

```ts
import { tableFeatures, metaHelper, useTable } from '@tanstack/react-table'

interface MyTableMeta {
  renderDetails: (rowId: string) => React.ReactNode
}

const features = tableFeatures({
  tableMeta: metaHelper<MyTableMeta>(),
})

const table = useTable({
  features,
  columns,
  data,
  meta: {
    renderDetails: (rowId) => <DetailPanel rowId={rowId} />,
  } satisfies MyTableMeta,
})
```

Access anywhere the table instance is available, fully typed, no `any`:

```ts
cell: ({ row, table }) => table.options.meta?.renderDetails(row.id),
```

Old v8-style global declaration merging still works in v9, just with an
added `TFeatures` generic:

```ts
declare module '@tanstack/react-table' {
  interface TableMeta<TFeatures, TData, TValue> {
    renderDetails: (rowId: string) => React.ReactNode
  }
}
```

Prefer `metaHelper` unless you specifically want one `meta` shape to apply
to every table in the codebase.

## Passing the full `Row<TData>` instead of just an id

Often more useful than an id — gives the consumer `row.original`,
`row.depth`, `row.index`, etc. without a lookup:

```ts
import type { Row } from '@tanstack/react-table'

interface MyTableMeta<TData> {
  renderDetails: (row: Row<TData>) => React.ReactNode
}
```

```tsx
cell: ({ row, table }) => table.options.meta?.renderDetails(row),
```

```tsx
renderDetails: (row) => <DetailPanel person={row.original} depth={row.depth} />
```

## Generic pattern: reusable `DataTable<TData>` component

When building a shared table component where `TData` isn't known ahead of
time (different call sites use different row shapes), `metaHelper` and
`tableFeatures` must be created generically per instance rather than once
at module scope — they're type carriers with no runtime state, so this is
cheap to memoize per component instance.

```tsx
import {
  tableFeatures,
  metaHelper,
  useTable,
  flexRender,
  type ColumnDef,
  type Row,
  type RowData,
} from '@tanstack/react-table'
import { useMemo } from 'react'

interface RowDetailsMeta<TData extends RowData> {
  renderDetails: (row: Row<TData>) => React.ReactNode
}

// Factory so metaHelper can be typed per-TData, not globally.
function createTableFeatures<TData extends RowData>() {
  return tableFeatures({
    tableMeta: metaHelper<RowDetailsMeta<TData>>(),
  })
}

interface DataTableProps<TData extends RowData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  getRowId: (row: TData) => string
  renderDetails: (row: Row<TData>) => React.ReactNode
}

function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  renderDetails,
}: DataTableProps<TData>) {
  // Stable reference across renders — safe since features carry no runtime state.
  const features = useMemo(() => createTableFeatures<TData>(), [])

  const table = useTable({
    features,
    columns,
    data,
    getRowId,
    meta: { renderDetails } satisfies RowDetailsMeta<TData>,
  })

  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
            <td>{table.options.meta?.renderDetails(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Usage — fully typed per call site, `row.original` resolves to the concrete
row type at that call site:

```tsx
<DataTable
  data={people}
  columns={personColumns}
  getRowId={(p) => p.id}
  renderDetails={(row) => <PersonDetails person={row.original} />}
/>
```

### Design notes

- `renderDetails` is a **required prop** on `DataTableProps`, not something
  the consumer sets via `meta` directly — `meta` is internal wiring
  `DataTable` uses to hand the render function through TanStack Table's
  context to cells. Consumers never touch `metaHelper`/`tableFeatures`.
- `useMemo(() => createTableFeatures<TData>(), [])` — empty deps is correct;
  the features object has no runtime dependency on props, only on the
  generic type parameter, which TypeScript resolves at the call site.
- Same pattern extends to column-level `meta` if per-column render config
  is needed instead of (or alongside) a single shared function — use
  `columnMeta: metaHelper<...>()` on `tableFeatures()` the same way.

## Syncing a wrapper hook's table type with a consuming component

Common shape: a `useMyTable(options)` hook builds the table (and owns the
`meta`/`renderDetails` wiring), and a separate `<MyTable table={...} />`
component renders it. Don't hand-write the component's `table` prop type as
a copy of the hook's generics — derive it with `ReturnType` so the hook stays
the single source of truth and the two can't drift out of sync.

```ts
// useMyTable.ts
export function useMyTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  renderDetails,
}: UseMyTableOptions<TData>) {
  const features = useMemo(() => createFeatures<TData>(), [])

  return useTable({
    features,
    columns,
    data,
    getRowId,
    meta: { renderDetails } satisfies MyTableMeta<TData>,
  })
}

// Inferred, not hand-written.
export type MyTableInstance<TData extends RowData> = ReturnType<
  typeof useMyTable<TData>
>
```

```tsx
// MyTable.tsx
interface MyTableProps<TData extends RowData> {
  table: MyTableInstance<TData>
}

// Trailing comma after TData in a .tsx generic component — otherwise the
// parser reads <TData> as a JSX tag opening.
function MyTable<TData extends RowData,>({ table }: MyTableProps<TData>) {
  /* ... */
}
```

```tsx
// MyComponent.tsx
function MyComponent() {
  const table = useMyTable({ data: people, columns, getRowId, renderDetails })
  return <MyTable table={table} />
}
```

`TData` is inferred once where `useMyTable` is called, flows through the
returned table instance, and `MyTable`'s own `TData` infers from the `table`
prop — no manual annotation, no duplicated generic parameter lists to keep
in sync.

**Caveat**: `ReturnType<typeof useMyTable<TData>>` relies on `useMyTable`
being a plain `function` declaration with an explicit `<TData extends
RowData>`. If it's converted to an arrow function assigned to a `const`,
TypeScript can sometimes fail to preserve the generic through `ReturnType`
— function declarations are the safer choice for hooks whose return type
needs to be extracted this way.

## Sources

- TanStack Table v9 beta docs — Table and Column Meta guide
  (`tanstack.com/table/beta/docs/framework/react/guide/table-and-column-meta`)
- TanStack Table v9 migration guide (React)
  (`tanstack.com/table/beta/docs/framework/react/guide/migrating`)

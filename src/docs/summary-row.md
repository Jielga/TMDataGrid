# Summary row

A sticky row along the bottom edge holding totals for the whole grid - the
count, the sum, whatever the column is worth saying one number about. It is
independent of [grouping](/docs/grouping): grouping totals each category,
the summary row totals everything.

There is no flag. Give a column a `footer` and the row appears; the row exists
exactly when at least one visible column defines one.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  footer: ({ table }) =>
    sek(Number(aggregateColumn({ table, columnId: "salary" }))),
});
```

```demo
file: rows/SummaryRow.tsx
```

`footer` is TanStack's own column option, rendered by the grid the way the
header is: each cell renders that column's renderer with the header context.
It can equally render anything - a static label, a count, its own calculation.

## Totalling a column

`aggregateColumn({ table, columnId, fn })` computes over every **filtered** row
(all pages, following the filters live) through the registered aggregation
functions. `fn` defaults to `"sum"`.

```tsx
aggregateColumn({ table, columnId: "salary" });                 // sum
aggregateColumn({ table, columnId: "age", fn: "mean" });        // average
aggregateColumn({ table, columnId: "location", fn: "uniqueCount" });
```

Following the filters is the point: a footer that keeps saying the same number
while the reader narrows the grid is worse than no footer, because it looks
like it is answering the question in front of them.

## Layout

Pinned columns keep their lanes in the summary row, and the row sits under the
pinned-lane gradients on the stacking ladder. The generated lanes - checkbox,
tree, details, row numbers - define no `footer`, so their summary cells stay
blank.

The row is sticky, so it stays put while the body scrolls, and its height is
`--dg-summary-height`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `footer` | Column option | `(ctx) => ReactNode` | – | Renders this column's summary cell. Any column defining one summons the row. |
| `aggregateColumn` | Export | `({ table, columnId, fn }) => unknown` | `fn: "sum"` | Aggregates a column over every filtered row, all pages. |
| `TMDataGridAggregationName` | Export | type | – | The registered function names - `sum`, `mean`, `count`, `uniqueCount`, … |
| `--dg-summary-height` | CSS variable | length | From `size` | Height of the summary row. |

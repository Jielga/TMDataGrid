# Loading and empty states

There are four ways a grid can have nothing to show, and they mean different
things to the reader. A grid still fetching is not empty; a grid emptied by the
reader's own filter is not the same as one with no data at all.

```demo
file: data/LoadingAndEmpty.tsx
hint: Switch to loaded, then search for something that cannot match, to see the other branch.
extraSources: data/employeeColumns.tsx
```

## What wins

An empty body shows exactly one thing, decided in this order:

1. **Loading** — `meta.loading` is true: a centred loader. A grid that is
   fetching never claims to be empty.
2. **Entry rows** — an open entry row from `edit.addRow()`: only the entry
   block, with no message competing with the form.
3. **`renderEmptyState`** — your node, centred where the message would be.
4. **Filtered-empty** — a filter or search is active: a search icon and
   `labels.noResults` ("No rows match your filters"), because this emptiness is
   the reader's own doing and clearing the filter will fix it.
5. **Truly-empty** — no data at all: `labels.noRows` ("No rows to show").

## Replacing the message

`renderEmptyState` replaces states 4 and 5 with one render prop, and
`hasActiveFilters` tells it which of the two it is standing in for — which is
what lets one prop give two genuinely different answers:

```tsx
<TMDataGrid.Table<Employee>
  renderEmptyState={({ hasActiveFilters, table }) =>
    hasActiveFilters ? (
      <Stack align="center" gap="xs">
        <Text c="dimmed">Nothing matches your filters</Text>
        <Button variant="light" onClick={() => table.resetColumnFilters()}>
          Clear filters
        </Button>
      </Stack>
    ) : (
      <Stack align="center" gap="xs">
        <Text c="dimmed">No employees yet</Text>
        <Button onClick={openCreateModal}>Add the first one</Button>
      </Stack>
    )
  }
/>
```

An empty grid is where a reader is most likely to be stuck, so it is worth
giving them the action that unsticks them rather than a full stop.

## Loading with rows on screen

The body's loading state only appears while the grid is **empty**. A
server-driven grid refetching with rows still on screen keeps showing them —
blanking the body on every page change would be worse than a moment of stale
data.

`TMDataGrid.LoadingIndicator` is the signal for that case: a small spinner
while `meta.loading` is true, nothing otherwise. Put it wherever it belongs,
typically after `Spacer`.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
</TMDataGrid.Toolbar>
```

## Counting what is there

`TMDataGrid.SummaryCount` shows visible rows out of total. The total is
`meta.totalRowCount` when you provide it — which is what a
[server-side](/docs/server-side) grid must do, since the client cannot know —
and the pre-filtered row count otherwise.

```tsx
<TMDataGrid.SummaryCount>
  {visible} of {total} employees
</TMDataGrid.SummaryCount>
```

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. Outranks every empty message. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | The filtered-empty message, without a render prop. |
| `meta.totalRowCount` | Option | `number` | Pre-filtered count | The total `SummaryCount` reports. |
| `renderEmptyState` | Table prop | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. |
| `TMDataGrid.LoadingIndicator` | Component | – | – | Spinner while `meta.loading`, for when the body has rows. |
| `TMDataGrid.SummaryCount` | Component | `children` replaces the text | – | Visible rows out of total. |
| `labels.noRows` · `labels.noResults` | Labels | `string` | English defaults | The two built-in messages. See [Localization](/docs/localization). |

# Loading and empty states

There are four ways a grid can have nothing to show, and they mean different
things to the user. A grid still fetching is not empty, and a grid emptied by a
filter is not the same as one with no data at all.

```demo
file: data/LoadingAndEmpty.tsx
hint: Switch to loaded, then search for something that cannot match, to see the other branch.
extraSources: data/employeeColumns.tsx
```

## What wins

An empty body shows exactly one thing, decided in this order:

1. **Loading** - `meta.loading` is true: a centred loader. A grid that is
   fetching never reports itself as empty.
2. **Entry rows** - an open entry row from `edit.addRow()`: the entry block
   only, with no message beside the form.
3. **`renderEmptyState`** - your node, centred where the message would be.
4. **Filtered-empty** - a filter or search is active: a search icon and
   `labels.noResults` ("No rows match your filters"), since clearing the filter
   will bring rows back.
5. **Truly-empty** - no data at all: `labels.noRows` ("No rows to show").

## Replacing the message

`renderEmptyState` replaces states 4 and 5 with one render prop.
`hasActiveFilters` says which of the two it is replacing, so one prop can render
two different messages:

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

An empty grid is a good place to offer the action that fills it, such as
clearing the filters or creating the first record.

## Loading with rows on screen

The body's loading state only appears while the grid is **empty**. A
server-driven grid refetching with rows still on screen keeps showing them
rather than blanking the body on every page change.

`TMDataGrid.LoadingIndicator` covers that case: a small spinner while
`meta.loading` is true, and nothing otherwise. Place it where you want it,
typically after `Spacer`.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
</TMDataGrid.Toolbar>
```

## Counting what is there

`TMDataGrid.SummaryCount` shows visible rows out of the total. The total is
`meta.totalRowCount` when you provide it, and the pre-filtered row count
otherwise. A [server-side](/docs/server-side) grid must provide it, because the
client only holds one page.

```tsx
<TMDataGrid.SummaryCount>
  {visible} of {total} employees
</TMDataGrid.SummaryCount>
```

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. Takes precedence over every empty message. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | The filtered-empty message, without a render prop. |
| `meta.totalRowCount` | Option | `number` | Pre-filtered count | The total `SummaryCount` reports. |
| `renderEmptyState` | Table prop | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. |
| `TMDataGrid.LoadingIndicator` | Component | – | – | Spinner while `meta.loading`, for when the body has rows. |
| `TMDataGrid.SummaryCount` | Component | `children` replaces the text | – | Visible rows out of total. |
| `labels.noRows` · `labels.noResults` | Labels | `string` | English defaults | The two built-in messages. See [Localization](/docs/localization). |

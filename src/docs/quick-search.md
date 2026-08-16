# Quick search

One box over every column. `TMDataGrid.Search` is a debounced input writing
TanStack's `globalFilter` state — no option turns it on, you render it or you
do not.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.Search />
</TMDataGrid.Toolbar>
```

```demo
file: data/QuickSearch.tsx
hint: Try “Stckholm” — fuzzy finds it, contains does not.
extraSources: data/employeeColumns.tsx
```

## Fuzzy by default

Typos and skipped characters are forgiven, and while the search is the only
thing narrowing the grid — no sort, no grouping — the rows order by **match
quality**, best first.

That ordering is derived, never written into `sorting`: no column claims
`aria-sort`, nothing lands in the persisted slices, and the reader's next sort
click takes over just by existing.

```tsx
const grid = useTMDataGrid({ data, columns, quickSearchMode: "contains" });
```

`"contains"` restores plain substring matching. An explicit `globalFilterFn`
overrides both — and switches the rank ordering off with it, since the grid can
no longer say what a match is worth.

`fuzzyGlobalFilterFn` is exported for anyone building their own input over the
same matching.

## Match highlighting

Opt in with `enableMatchHighlighting: true` and cells mark the matched slice of
their text — while the quick search is active, or a `contains` / `starts with` /
`ends with` column filter.

```tsx
const grid = useTMDataGrid({ data, columns, enableMatchHighlighting: true });
```

What gets marked is the **contiguous, case-insensitive** occurrence of the
needle. So under the fuzzy search a typo-match with no contiguous occurrence
shows no highlight, which is the honest answer to what a non-contiguous match
"is". Equality operators highlight nothing: marking the whole cell says nothing
the filter did not already say.

**Default-rendered cells only.** A column with its own `cell` renderer opts out
by existing — the grid replicates the default value-to-string render with the
marks added, and never rummages inside a custom renderer's output.

The mark colour is `--dg-match-highlight-bg`, a yellow that follows the Mantine
colour scheme. While the feature is off — the default — it costs one flag check
per render.

## Opting columns out

`enableGlobalFilter: false` on a column takes it out of the search; on the
table it removes the input entirely. The generated lanes already opt out.

A search input of your own skips the component and calls
`table.setGlobalFilter` directly. The state is TanStack's own, so a
[`manualFiltering`](/docs/server-side) grid forwards it to the server, and it is
one of the persisted `data` slices.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `TMDataGrid.Search` | Component | – | – | The debounced quick-search input. |
| `placeholder` | Search prop | `string` | `labels.searchPlaceholder` | Input placeholder. |
| `debounce` | Search prop | `number` | `250` | Pause before the filter applies, in ms. `0` filters per keystroke. |
| `w` | Search prop | `number \| string` | `220` | Input width. |
| `quickSearchMode` | Option | `"fuzzy" \| "contains"` | `"fuzzy"` | How the search matches. |
| `enableMatchHighlighting` | Option | `boolean` | `false` | Mark the matched text in default-rendered cells. |
| `enableGlobalFilter` | Table option | `boolean` | `true` | Also a column option. `false` removes the input, or one column's participation. |
| `globalFilterFn` | Table option | filter fn | `fuzzy` | Overrides the matching, and the rank ordering with it. |
| `fuzzyGlobalFilterFn` | Export | filter fn | – | The default matcher, for a custom input. |
| `--dg-match-highlight-bg` | CSS variable | colour | Themed yellow | The mark colour. |

# Localization

Every string the grid renders - menu items, panels, tooltips, the pager, and
every `aria-label` - comes from one labels object. English by default.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  labels: { noResults: "Inga rader matchar dina filter" },
});
```

`labels` takes **any subset** and merges it over the defaults, so overriding one
string does not mean supplying the other hundred.

```demo
file: customization/Localization.tsx
extraSources: data/employeeColumns.tsx
```

## A whole language

A complete Swedish dictionary ships as `TMDATAGRID_LABELS_SV`:

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

`TMDATAGRID_LABELS_EN` is the English base, and `TMDataGridLabels` is the full
dictionary type - which is what makes a new translation a typed exercise rather
than a guess at what needs covering.

## Labels that carry a value

They are functions, so a language can put the value where its grammar wants it
rather than where English happens to put it:

```tsx
labels: {
  groupBy: (column) => `Gruppera på ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
}
```

## Keep the object stable

Module scope, or `useMemo`. The chrome re-renders when the labels object changes
identity, and an inline literal is a new object every render.

```tsx
const labels = { noResults: "Inga träffar" } satisfies TMDataGridLabelsOverride;
```

## Reading them yourself

The resolved dictionary comes back from the hook as `grid.labels`, and from
context as `useTMDataGridContext().labels` - so a
[toolbar component of your own](/docs/toolbar) uses the same strings the
built-in chrome does, in whatever language is configured.

`mergeLabels(base, override)` is the merge itself, exported for anyone
composing dictionaries before handing one over.

`meta.noResultsLabel` still works as a per-instance override of
`labels.noResults`, for the common case of one grid wanting a more specific
empty message than the rest.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `labels` | Option | `TMDataGridLabelsOverride` | English | Any subset, merged over the defaults. Keep it stable. |
| `grid.labels` | Hook return | `TMDataGridLabels` | – | The resolved dictionary. |
| `TMDATAGRID_LABELS_EN` | Export | `TMDataGridLabels` | – | The English base. |
| `TMDATAGRID_LABELS_SV` | Export | `TMDataGridLabels` | – | A complete Swedish dictionary. |
| `TMDataGridLabels` | Export | type | – | The full dictionary - what a new translation must cover. |
| `TMDataGridLabelsOverride` | Export | type | – | A partial dictionary. |
| `mergeLabels` | Export | `(base, override) => TMDataGridLabels` | – | The merge, for composing dictionaries. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | Per-instance override of the filtered-empty message. |

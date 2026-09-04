# Localization

Every string the grid renders - menu items, panels, tooltips, the pager and
every `aria-label` - comes from one labels object. English by default.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  labels: { noResults: "Inga rader matchar dina filter" },
});
```

`labels` takes **any subset** and merges it over the defaults.

```demo
file: customization/Localization.tsx
extraSources: data/employeeColumns.tsx
```

## A complete translation

A full Swedish dictionary ships as `TMDATAGRID_LABELS_SV`:

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

`TMDATAGRID_LABELS_EN` is the English base, and `TMDataGridLabels` is the full
dictionary type, so a missing key in a new translation is a compile error.

## Labels that carry a value

These labels are functions, so each language can place the value where its
grammar requires:

```tsx
labels: {
  groupBy: (column) => `Gruppera på ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
}
```

## Keep the object stable

Define it at module scope, or memoize it. The grid re-renders when the labels
object changes identity.

```tsx
const labels = { noResults: "Inga träffar" } satisfies TMDataGridLabelsOverride;
```

## Reading them yourself

The resolved dictionary comes back from the hook as `grid.labels`, and from
context as `useTMDataGridContext().labels`, so a
[toolbar component of your own](/docs/toolbar) uses the same strings as the
built-in parts, in whatever language is configured.

`mergeLabels(base, override)` is the merge itself, exported for composing
dictionaries before passing one in.

`meta.noResultsLabel` remains as a per-instance override of
`labels.noResults`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `labels` | Option | `TMDataGridLabelsOverride` | English | Any subset, merged over the defaults. Keep it stable. |
| `grid.labels` | Hook return | `TMDataGridLabels` | – | The resolved dictionary. |
| `TMDATAGRID_LABELS_EN` | Export | `TMDataGridLabels` | – | The English base. |
| `TMDATAGRID_LABELS_SV` | Export | `TMDataGridLabels` | – | A complete Swedish dictionary. |
| `TMDataGridLabels` | Export | type | – | The full dictionary. What a new translation must cover. |
| `TMDataGridLabelsOverride` | Export | type | – | A partial dictionary. |
| `mergeLabels` | Export | `(base, override) => TMDataGridLabels` | – | The merge, for composing dictionaries. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | Per-instance override of the filtered-empty message. |

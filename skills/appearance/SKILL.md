---
name: appearance
description: >
  Theme, size, compose and translate a TMDataGrid. Covers the size scale (xs to
  xl) and what it drives, every --dg-* CSS variable for metrics, colours and the
  stacking ladder, the two stylesheets styles.css and styles.layer.css and why
  only one may be imported, the bounded-height layout rule with minHeight 0,
  toolbar composition through children and TMDataGrid.Spacer, writing a toolbar
  button with useTMDataGridContext, hiding it the way the built-ins do with
  getGridCapabilities and getColumnCapabilities, why capabilities take a
  features argument under the React Compiler, and localization through the
  labels option, TMDATAGRID_LABELS_EN, TMDATAGRID_LABELS_SV, mergeLabels and
  grid.labels. Load when styling or theming the grid, choosing a density,
  building a toolbar, adding a button beside the built-in ones, or translating
  the interface.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.0.2'
sources:
  - 'Jielga/TMDataGrid:src/docs/styling.md'
  - 'Jielga/TMDataGrid:src/docs/toolbar.md'
  - 'Jielga/TMDataGrid:src/docs/localization.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/capabilities.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/labels.ts'
---

# TMDataGrid - Appearance, toolbar and labels

Everything set on the grid element or composed around it: the size scale, the
CSS variables, the toolbar, and the strings.

## Size

`size` drives row height, header height, font size and cell padding together,
and selects the size of every Mantine control the grid renders.

| `size` | Row height | Header height | Font size | Cell padding |
| --- | --- | --- | --- | --- |
| `xs` | 34px | 32px | `xs` | 6px |
| `sm` | 42px | 38px | `sm` | 8px |
| `md` (default) | 52px | 44px | `sm` | 10px |
| `lg` | 62px | 52px | `md` | 14px |
| `xl` | 72px | 60px | `lg` | 18px |

Row height is also required by the virtualizer **as a number**, so it cannot be
defined in CSS alone. For a height outside the scale set `meta.rowHeight`, not
the variable. `SIZE_ROW_HEIGHT` is the exported source of these values.

## CSS variables

`style` accepts custom properties and `className` reaches the same element from
a stylesheet. Both are per instance - a grid is themed without a provider.

```tsx
<TMDataGrid
  {...grid}
  size="sm"
  style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
/>
```

**Metrics:** `--dg-row-height`, `--dg-header-height`, `--dg-summary-height`,
`--dg-entry-height`, `--dg-font-size`, `--dg-padding`. All default from `size`.
The generated lanes are exempt from padding: they are fixed 36px tracks that
centre their control.

**Colours:** `--row-bg` (one row's own background - set this, never
`background`), `--dg-row-selected-bg`, `--dg-row-highlight-bg`,
`--dg-row-striped-bg`, `--dg-row-group-bg`, `--dg-match-highlight-bg`,
`--dg-header-shadow-color`.

**Layout internals:** `--dg-sticky-edge-range` (`20px`), the `--dg-edge-*`
markers the grid sets on cell-range borders, and the `--dg-z-*` stacking ladder -
change those only to slot something of your own between two layers.

One stylesheet import, once, anywhere:

```tsx
import "@jielga/tmdatagrid/styles.css";
```

`@jielga/tmdatagrid/styles.layer.css` is the same stylesheet wrapped in a
`@layer`, for an application that orders its own layers. Import **one** of the
two, never both.

## Layout

The grid fills the box you give it and scrolls inside it. It does not size
itself to its content - a virtualized grid has no content height to measure.

```tsx
<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
  <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
    <TMDataGrid.Table />
  </TMDataGrid>
</div>
```

`minHeight: 0` is the part everyone forgets: a flex item's default
`min-height: auto` refuses to shrink below its content, so without it the grid
grows past the viewport instead of scrolling.

## Toolbar

The toolbar is a flex row and nothing more. No slots API, no `actions` prop -
your buttons sit beside the built-in ones because they are all just children,
and `TMDataGrid.Spacer` pushes what follows to the right. That is the whole
layout system.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Search />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
  <ExportButton />
  <TMDataGrid.FilterButton />
  <TMDataGrid.ColumnsButton />
</TMDataGrid.Toolbar>
```

Each built-in renders nothing when its feature is off, so a read-only grid needs
no conditionals: `FilterButton` under `enableColumnFilters: false` is simply
absent.

A button of your own reads the grid from context - `{ table, ui, features,
labels, controlSize, resetSettings }`:

```tsx
import {
  exportGridToCsv,
  getGridCapabilities,
  useTMDataGridContext,
} from "@jielga/tmdatagrid";

function ExportButton() {
  const { table, features, controlSize } = useTMDataGridContext();
  const { canFilterAny } = getGridCapabilities(table, features);

  if (!canFilterAny) return null;

  return (
    <Button size={controlSize} onClick={() => exportGridToCsv({ table })}>
      Export
    </Button>
  );
}
```

`getGridCapabilities(table, features)` answers `canSortAny`, `canFilterAny`,
`canHideAny`, `canPinAny`, `canReorderAny`, `canGroupAny`, `canSelectRows`,
`canPaginate` and `canSearch`. `getColumnCapabilities(column, features)` answers
the same for one column as `canSort`, `canFilter`, `canHide`, `canPin`,
`canResize`, `canReorder` and `canGroup`.

### Why `features` is a second argument

`features` comes back from `useTMDataGrid` and is re-derived from the options
object on every render. It is required **in addition to** TanStack's `getCanX()`
methods because it is what makes the result reactive: `column.getCanSort()` is a
method call on a column object whose identity survives an options change, so
under the React Compiler that call is memoized and a grid whose `enableSorting`
flipped to `false` would carry on rendering sort indicators. `features` supplies
a value that changes; `getCanX()` still decides the outcome.

The same rule applies anywhere in your app: read state through
`useSelector(table.store, …)` and options through `features`, rather than
calling methods on a long-lived object.

## Labels

Every string the grid renders, and every `aria-label`, comes from one labels
object. English by default, and `labels` takes **any subset**, merged over the
defaults.

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

Labels that carry a value are functions, so a language can put the value where
its grammar wants it:

```tsx
const labels = {
  groupBy: (column) => `Gruppera på ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
} satisfies TMDataGridLabelsOverride;
```

`TMDataGridLabels` is the full dictionary type, which is what makes a new
translation a typed exercise rather than a guess. The resolved dictionary comes
back as `grid.labels` and from `useTMDataGridContext().labels`, so a component
of your own uses the same strings as the built-in chrome.

## Common mistakes

### CRITICAL Importing both stylesheets

`styles.css` and `styles.layer.css` are the same rules, one wrapped in a
`@layer`. Importing both means the unlayered copy wins every cascade contest,
so an application that ordered its layers to put the grid underneath its own
overrides silently gets the opposite.

Source: `src/docs/styling.md` (The stylesheet).

### CRITICAL A grid with no bounded height

The grid does not size itself to its content, so inside a flex parent without
`minHeight: 0` it grows past the viewport and the page scrolls instead of the
body. Rows render, so nothing looks broken until the list is long.

Wrong:

```tsx
<TMDataGrid {...grid} style={{ flex: 1 }} />
```

Correct:

```tsx
<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }} />
```

Source: `src/docs/styling.md` (Layout).

### HIGH Setting `--dg-row-height` to change density

The virtualizer needs the row height as a number, and takes it from
`meta.rowHeight` or `size` - not from the variable. Setting the variable alone
leaves the measurement and the render disagreeing, so rows overlap or gaps open
as you scroll.

Correct:

```tsx
useTMDataGrid({ data, columns, meta: { rowHeight: 64 } });
```

Source: `src/docs/styling.md` (The size scale).

### HIGH A capability check without `features`

`getGridCapabilities` and `getColumnCapabilities` both take `features` as a
second argument because it is the value that changes. Calling
`column.getCanSort()` directly in a custom header or toolbar button memoizes
against the column identity under the React Compiler, and the control keeps
rendering after its option was switched off.

Wrong:

```tsx
if (!column.getCanSort()) return null;
```

Correct:

```tsx
const { canSort } = getColumnCapabilities(column, features);
if (!canSort) return null;
```

Source: `src/docs/toolbar.md` (Why `features` is a second argument).

### MEDIUM An inline `labels` object

The chrome re-renders when the labels object changes identity, and an inline
literal is a new object every render. Keep it at module scope, or `useMemo` it.

Wrong:

```tsx
useTMDataGrid({ data, columns, labels: { noResults: "Inga träffar" } });
```

Correct:

```tsx
const labels = { noResults: "Inga träffar" } satisfies TMDataGridLabelsOverride;

useTMDataGrid({ data, columns, labels });
```

Source: `src/docs/localization.md` (Keep the object stable).

### MEDIUM Conditionally rendering built-in toolbar parts

Each built-in already renders nothing when its feature is off. Wrapping them in
your own checks duplicates the capability logic, and the two drift apart the
first time an option changes.

Source: `src/docs/toolbar.md` (The built-in parts).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `size` | Prop | `MantineSize` | `"md"` | The whole density scale. |
| `className` · `style` · `id` | Props | – | – | Set on the root element. `style` takes the `--dg-*` variables. |
| `meta.rowHeight` | Option | `number` | From `size` | A row height outside the scale. |
| `SIZE_ROW_HEIGHT` | Export | `Record<MantineSize, number>` | – | The row heights the scale table lists. |
| `SIZE_CONTROL_SIZE` | Export | `Record<MantineSize, MantineSize>` | – | Which control size each grid size uses. |
| `DEFAULT_TMDATAGRID_SIZE` | Export | `"md"` | – | The default size. |
| `TMDataGrid.Toolbar` · `Spacer` | Components | `children` | – | The flex row, and the push-right. |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | `{ table, ui, features, labels, controlSize, resetSettings }`. |
| `getGridCapabilities` | Export | `(table, features) => TMDataGridCapabilities` | – | What this grid can do, reactively. |
| `getColumnCapabilities` | Export | `(column, features) => TMDataGridColumnCapabilities` | – | The same for one column. |
| `readFeatureFlags` | Export | `(options) => TMDataGridFeatureFlags` | – | Derives the flags from an options object. |
| `labels` | Option | `TMDataGridLabelsOverride` | English | Any subset, merged over the defaults. Keep it stable. |
| `grid.labels` | Hook return | `TMDataGridLabels` | – | The resolved dictionary. |
| `TMDATAGRID_LABELS_EN` · `TMDATAGRID_LABELS_SV` | Exports | `TMDataGridLabels` | – | The English base, and a complete Swedish dictionary. |
| `TMDataGridLabels` · `TMDataGridLabelsOverride` | Exports | types | – | The full dictionary, and a partial one. |
| `mergeLabels` | Export | `(base, override) => TMDataGridLabels` | – | The merge, for composing dictionaries. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | Per-instance override of the filtered-empty message. |

The CSS layer name `tmdatagrid` in `styles.layer.css` is public API and never
changes.

See also: the `rows` skill for `--row-bg` and per-row styling, and
`getting-started` for the component catalog.

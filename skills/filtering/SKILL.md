---
name: filtering
description: >
  Narrow the rows a TMDataGrid shows. Covers the shared tmDataGrid filter
  function and its {operator, value} model, the eighteen operators and which
  meta.type offers each, meta.defaultFilterOperator, isFilterActive and the
  half-typed filter, the filter panel, TMDataGrid.FilterButton,
  TMDataGrid.FilterPills with its api prop, openColumnFilter, replacing a value
  control with DgRangeSliderFilter / DgDateRangeFilter / DgAutocompleteFilter /
  DgTriStateFilter or a meta.filterControl component, per-column filterFn, and
  the quick search: TMDataGrid.Search, quickSearchMode fuzzy or contains,
  fuzzyGlobalFilterFn, enableMatchHighlighting and enableGlobalFilter. Load when
  adding filters, choosing operators, building a filter control, showing active
  filters outside the grid, or wiring a search box.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '1.0.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/filtering.md'
  - 'Jielga/TMDataGrid:src/docs/quick-search.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/filterOperators.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/quickSearch.ts'
---

# TMDataGrid - Filtering

Two independent narrowings: per-column filters built from an operator and a
value, and one quick-search box across every column. Both write standard
TanStack state, so a `manualFiltering` grid forwards either to a server.

## How a filter is stored

All columns share one filter function. The operator lives **in the value**
rather than being selected through `filterFn`:

```ts
type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string | ReadonlyArray<string>;
};
```

The model is therefore plain JSON: dates as ISO `YYYY-MM-DD`, booleans as
`"true"` / `"false"`, and an array only under `isAnyOf` / `isNoneOf` (the set the
cell is tested against) and `between` (a `[min, max]` pair, an empty string
leaving that end open).

A filter with an empty value **stays in state** so the panel keeps showing its
row while the reader types. It matches every row, does not light the header
indicator and gets no pill. `isFilterActive(value)` is the test for that state -
presence in `columnFilters` is not.

## Operators

`meta.type` selects which operators a column offers.

| Column type | Operators |
| --- | --- |
| `string` | `contains`, `equals`, `notEquals`, `startsWith`, `endsWith` |
| `number` | `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between` |
| `date` | `equals`, `notEquals`, `before`, `after`, `onOrBefore`, `onOrAfter`, `between` |
| `boolean` | `equals`, `notEquals` |
| `select`, `multiSelect` | `isAnyOf`, `isNoneOf` |

Every type also offers `isEmpty` and `isNotEmpty`, which ignore the value input.

String comparisons are case-insensitive. Date comparisons are by calendar day,
and `equals` on a `date` column plays the role of "is". On a `multiSelect`
column, whose cells hold arrays, `isAnyOf` is an intersection test and `isNoneOf`
its complement. `between` is inclusive at both ends.

`meta.defaultFilterOperator` sets which one a fresh filter opens on, and must be
one of the type's own:

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { type: "number", defaultFilterOperator: "between" },
});
```

## The panel and the pills

`TMDataGrid.FilterPanel` is column, operator and value rows under a "Filters"
header, above "Add filter" and "Clear all". It is rendered by
`TMDataGrid.Table`; Escape and a click outside close it, with `FilterButton`
exempt from the click-away so it stays a toggle. Closing only hides it - the
filters stay. **Clear all** drops every filter, half-typed ones included.

`TMDataGrid.FilterPills` takes the grid as an `api` prop rather than reading
context, so active filters can live in a page header or anywhere else:

```tsx
import { TMDataGridFilterPills } from "@jielga/tmdatagrid";

<TMDataGridFilterPills api={grid} onPillClick={(columnId) => focus(columnId)} />;
```

One pill per **active** filter - `First name: Sofia ✕` - where ✕ clears it and a
click on the label reopens the panel on its column. The label spells the
operator out unless it is the type's default: `Age is greater than 30`, but
`First name: Sofia`. `openColumnFilter(api, columnId)` does the same reopening
from anywhere, seeding an empty row if the column has none.

## Replacing the value control

The built-in control follows the type and operator. Four alternatives ship as
named exports:

| Export | For | Renders |
| --- | --- | --- |
| `DgRangeSliderFilter` | `number` | Range slider seeded from the data's min/max, writing the `between` pair |
| `DgDateRangeFilter` | `date` | A From/To pair of native date inputs |
| `DgAutocompleteFilter` | `string` | Free text with faceted values as suggestions |
| `DgTriStateFilter` | `boolean` | All / Yes / No segments, All clearing the filter |

```tsx
meta: {
  type: "number",
  filterControl: DgRangeSliderFilter,
  defaultFilterOperator: "between",
}
```

Pair the range-shaped ones with `defaultFilterOperator: "between"` so the filter
opens on them. For operators outside their shape every built-in falls back to
`TMDataGridFilterValueInput`, which is exported so a custom control can take the
same escape.

`meta.filterControl` is a **component**, rendered as JSX, so hooks are legal
inside. It is a **value-only contract**: it reads `operator` to shape itself and
writes the bare value through `onChange`, and the grid composes the stored
`{ operator, value }` around it. The column and operator dropdowns stay the
panel's.

```tsx
import type { TMDataGridFilterControlComponent } from "@jielga/tmdatagrid";

// Module scope: a new identity per render remounts the control mid-typing.
const StatusFilter: TMDataGridFilterControlComponent = ({
  operator,
  value,
  options,
  onChange,
}) => (
  <Chip.Group
    multiple
    value={Array.isArray(value) ? [...value] : []}
    onChange={onChange}
  >
    {options.map((option) => (
      <Chip key={option.value} value={option.value}>
        {option.label}
      </Chip>
    ))}
  </Chip.Group>
);

meta: { type: "select", filterControl: StatusFilter }
```

`args.options` arrives pre-resolved for a column that declares `meta.options` or
is select-shaped; `args.table` is the escape hatch for a control that must reach
further.

To give a column its own *matching* rather than its own control, set `filterFn`
on the column definition. The grid only provides `"tmDataGrid"` as the default.

## Quick search

`TMDataGrid.Search` is a debounced input writing TanStack's `globalFilter`. No
option turns it on: you render it or you do not.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.Search placeholder="Search employees" debounce={0} />
</TMDataGrid.Toolbar>
```

Matching is **fuzzy by default**: typos and skipped characters are forgiven, and
while the search is the only thing narrowing the grid (no sort, no grouping) the
rows order by match quality, best first. That ordering is derived, never written
into `sorting` - no column claims `aria-sort`, nothing lands in the persisted
slices, and the reader's next sort click takes over just by existing.

`quickSearchMode: "contains"` restores plain substring matching. An explicit
`globalFilterFn` overrides both, and switches the rank ordering off with it.
`fuzzyGlobalFilterFn` is exported for a custom input over the same matching.

`enableMatchHighlighting: true` marks the matched slice of a cell's text, under
the quick search or a `contains` / `startsWith` / `endsWith` column filter. What
gets marked is the contiguous, case-insensitive occurrence, so a fuzzy
typo-match with no contiguous occurrence shows no highlight. It applies to
**default-rendered cells only**: a column with its own `cell` renderer opts out
by existing.

## Turning it off

`enableColumnFilters: false` removes the panel, the button and the menu item;
`enableColumnFilter: false` on a column takes that column out.
`enableGlobalFilter: false` removes the search input, or on a column removes its
participation in the search. Generated lanes already opt out.

## Common mistakes

### CRITICAL Treating presence in `columnFilters` as an active filter

A half-typed filter stays in state on purpose, so the panel keeps its row while
the reader types. Counting entries reports filters that are narrowing nothing,
and forwarding them to a server sends `{ operator: "contains", value: "" }` as a
real constraint.

Wrong:

```tsx
const activeCount = columnFilters.length;
```

Correct:

```tsx
import { isFilterActive } from "@jielga/tmdatagrid";

const active = columnFilters.filter((filter) => isFilterActive(filter.value));
```

Source: `src/docs/filtering.md` (How a filter is stored).

### HIGH Assuming `value` is always a string

`value` is a `[min, max]` pair under `between` and an array under `isAnyOf` /
`isNoneOf`. Code written against the single-string case compiles against the
union and fails at runtime on the first range filter.

Correct:

```tsx
import {
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "@jielga/tmdatagrid";

if (operatorTakesRangeValue(operator)) {
  const [min, max] = value as ReadonlyArray<string>;
}
```

Source: `src/tmdatagrid/core/filterOperators.ts`.

### HIGH A numeric column with no `meta.type`

`getColumnType` defaults to `"string"`, so a numeric column that omits
`meta: { type: "number" }` offers only the string operators. `greaterThan` and
`between` never appear in the panel, and comparisons run as text - `"9"` sorts
above `"10"`.

Source: `src/docs/filtering.md` (Operators).

### HIGH A filter control defined inside the component

`meta.filterControl` is rendered as JSX, so its identity is its component type.
An inline arrow is a new type every render, which remounts the control and loses
what was being typed into it.

Correct:

```tsx
// Module scope, referenced by name.
const StatusFilter: TMDataGridFilterControlComponent = (args) => { /* … */ };

meta: { filterControl: StatusFilter }
```

Source: `src/docs/filtering.md` (Writing your own).

### MEDIUM Writing the whole filter from a custom control

The contract is value-only: `onChange` takes the bare value, and the grid
composes `{ operator, value }` around it. Passing an object writes a filter
whose `value` is itself an object, which no operator can match against.

Wrong:

```tsx
onChange({ operator: "isAnyOf", value: picked });
```

Correct:

```tsx
onChange(picked);
```

Source: `src/docs/filtering.md` (Writing your own).

### MEDIUM Expecting match highlighting in a custom cell

The grid replicates the default value-to-string render with marks added, and
never rummages inside a custom renderer's output. A column with a `cell`
renderer shows no marks however `enableMatchHighlighting` is set. Equality
operators highlight nothing either.

Source: `src/docs/quick-search.md` (Match highlighting).

### MEDIUM Expecting fuzzy ranking to survive a sort

The rank ordering applies only while the search is the sole narrowing. Any sort
or grouping takes over, by design - the ordering is derived and never written
into `sorting`, so there is nothing to clear afterwards.

Source: `src/docs/quick-search.md` (Fuzzy by default).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableColumnFilters` | Table option | `boolean` | `true` | `false` removes the panel, the button and the menu item. |
| `enableColumnFilter` | Column option | `boolean` | `true` | `false` takes one column out of filtering. |
| `meta.type` | Column meta | `TMDataGridColumnType` | `"string"` | Selects the operators and the value control. |
| `meta.defaultFilterOperator` | Column meta | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter opens on. |
| `meta.filterControl` | Column meta | `TMDataGridFilterControlComponent` | By type and operator | Replaces the value control. Module scope. |
| `filterFn` | Column option | name or fn | `"tmDataGrid"` | Custom matching for one column. |
| `quickSearchMode` | Option | `"fuzzy" \| "contains"` | `"fuzzy"` | How the quick search matches. |
| `enableMatchHighlighting` | Option | `boolean` | `false` | Mark matched text in default-rendered cells. |
| `enableGlobalFilter` | Table option | `boolean` | `true` | Also a column option. Removes the input, or one column's participation. |
| `globalFilterFn` | Table option | filter fn | fuzzy | Overrides the matching, and the ranking with it. |
| `TMDataGrid.FilterPanel` | Component | – | – | The panel of filter rows. |
| `TMDataGrid.FilterButton` | Component | – | – | Toolbar button opening the panel, with an active count. |
| `TMDataGrid.FilterPills` | Component | `api`, `size`, `showClearAll`, `onPillClick`, `className` | – | Active filters as removable pills, renderable anywhere. |
| `TMDataGrid.Search` | Component | `placeholder`, `debounce` (`250`), `w` (`220`) | – | The debounced quick-search input. |
| `openColumnFilter` | Export | `(api, columnId) => void` | – | Opens the panel on a column. |
| `isFilterActive` | Export | `(value) => boolean` | – | Whether a filter value is doing anything. |
| `getOperatorsForType` | Export | `(type) => operators` | – | The operator list a type offers. |
| `FILTER_OPERATOR_LABELS` | Export | record | – | The label shown for each operator. |
| `formatFilterLabel` | Export | `({ label, type, filter }) => string` | – | The one-line description used on the pills. |
| `emptyValueForOperator` · `operatorNeedsValue` · `operatorTakesArrayValue` · `operatorTakesRangeValue` | Exports | – | – | What shape of value an operator wants. |
| `TMDataGridFilterValueInput` | Export | component | – | The default value control, for falling back to. |
| `DgRangeSliderFilter` · `DgDateRangeFilter` · `DgAutocompleteFilter` · `DgTriStateFilter` | Exports | components | – | The four ready-made controls. |
| `fuzzyGlobalFilterFn` | Export | filter fn | – | The default matcher, for a custom input. |
| `--dg-match-highlight-bg` | CSS variable | colour | Themed yellow | The mark colour. |

See also: the `columns` skill for `meta.type` and `meta.options`, and the
`server-side` skill for forwarding `columnFilters` to an API.

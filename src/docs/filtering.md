# Filtering

Per-column filters, built out of an operator and a value. Users add them from
the filter panel or a column menu. You control what each column offers through
`meta.type`, and can replace the value control when the default input is not
the right one.

For one box across every column instead, see [Quick search](/docs/quick-search).

```demo
file: columns/Filtering.tsx
hint: Every column type offers its own operators - Salary opens on “between” because its meta says so.
```

## How a filter is stored

All columns share one filter function. The operator lives *in the value*
rather than being selected through `filterFn`:

```ts
type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string | ReadonlyArray<string>;
};
```

So the filter model is plain JSON, and can be forwarded to a server without
transformation - dates as ISO strings, booleans as `"true"` / `"false"`, and an
array only under `isAnyOf` / `isNoneOf` (the set the cell is tested against) and
`between` (a `[min, max]` pair, an empty string leaving that end open). See
[Server-side data](/docs/server-side#sending-filters).

A filter with an empty value stays in state, so the panel keeps its row while
the user types. It matches every row, does not set the header's filter
indicator, and produces no pill. `isFilterActive(value)` tests for that
state.

## Operators

`meta.type` selects which operators a column offers.

| Operator | Label | Column type |
| --- | --- | --- |
| `contains` | contains | `string` |
| `equals` | equals | `string`, `number`, `boolean`, `date` |
| `notEquals` | does not equal | `string`, `number`, `boolean`, `date` |
| `startsWith` | starts with | `string` |
| `endsWith` | ends with | `string` |
| `greaterThan` | is greater than | `number` |
| `greaterThanOrEqual` | is greater than or equal to | `number` |
| `lessThan` | is less than | `number` |
| `lessThanOrEqual` | is less than or equal to | `number` |
| `between` | is between | `number`, `date` |
| `before` | is before | `date` |
| `after` | is after | `date` |
| `onOrBefore` | is on or before | `date` |
| `onOrAfter` | is on or after | `date` |
| `isAnyOf` | is any of | `select`, `multiSelect` |
| `isNoneOf` | is none of | `select`, `multiSelect` |
| `isEmpty` | is empty | every type |
| `isNotEmpty` | is not empty | every type |

String comparisons are case-insensitive. Date comparisons are by calendar day,
so `equals` on a `date` column matches the same day. On a `multiSelect`
column, whose cells hold arrays, `isAnyOf` is an intersection test and
`isNoneOf` its complement, and an empty cell array counts as empty for
`isEmpty`. `between` is inclusive at both ends; the panel renders a From/To
pair and either end may stay empty to leave the interval open on that side.

`meta.filter.defaultOperator` sets which one a fresh filter opens on: a salary
column can start on `between` rather than `equals`. It must be one of the
operators that type offers.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { type: "number", filter: { defaultOperator: "between" } },
});
```

## Filters outside the grid

`TMDataGrid.FilterPills` takes the grid as an `api` prop rather than reading
context, so active filters can live in a page header, above the toolbar, or
anywhere else on the page.

```demo
file: columns/FilterPills.tsx
```

`openColumnFilter(api, columnId)` opens the panel on a column, seeding an empty
row if it has none yet, the same as "Filter" in the column menu. Use it to send
the user back to the panel from a control elsewhere on the page.

### The panel and the pills

`TMDataGrid.FilterPanel` is column, operator and value rows, under a "Filters"
header with a close button and above "Add filter" / "Clear all". Escape and a
click outside close it - `FilterButton` is exempt from the click-away, so it
stays a toggle. It is rendered by `TMDataGrid.Table` and positions itself
against the nearest positioned ancestor.

Closing only hides the panel; the filters stay. **Clear all** drops every
filter, half-typed ones included, and closes the panel, the same as removing the
last filter row by hand.

`TMDataGrid.FilterPills` renders one pill per active filter -
`First name: Sofia ✕` - where the ✕ clears that filter and a click on the label
reopens the panel on its column. Half-typed filters are left out. The label
spells the
operator out unless it is the column type's default - `Age is greater than 30`,
but `First name: Sofia`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `api` | `TMDataGridApi<TData>` | – | The object returned by `useTMDataGrid`. |
| `size` | `MantineSize` | `"sm"` | Pill size. |
| `showClearAll` | `boolean` | `true` | "Clear all", shown once two filters are active. |
| `onPillClick` | `(columnId) => void` | – | Replaces the default click behaviour. |
| `className` | `string` | – | Added to the wrapper class. |

It is also exported as `TMDataGridFilterPills`. Use that import when nothing
else in the file touches `TMDataGrid`.

## Replacing the value control

The built-in control follows the type and operator: a text input for strings, a
number pair for `between`, a native date input for dates, a Yes/No dropdown for
booleans, a multi-select for option columns.

Four ready-made alternatives ship as named exports:

| Export | For | Renders |
| --- | --- | --- |
| `DgRangeSliderFilter` | `number` | A range slider seeded from the data's min/max, writing the `between` pair. |
| `DgDateRangeFilter` | `date` | A From/To pair of native date inputs, writing the `between` pair. |
| `DgAutocompleteFilter` | `string` | Free text with the faceted (or declared) values as suggestions. |
| `DgTriStateFilter` | `boolean` | All / Yes / No segments - All clears the filter. |

```tsx
meta: {
  type: "number",
  filter: { control: DgRangeSliderFilter, defaultOperator: "between" },
}
```

Pair the range-shaped ones with `defaultOperator: "between"` so the filter
opens on them. For an operator they do not cover, every built-in falls back to
`TMDataGridFilterValueInput`, the default control, which is exported so custom
controls can fall back the same way.

```demo
file: columns/BuiltInFilterControls.tsx
hint: Open the filter panel and compare each row's control with the plain input the other demos show.
```

### Writing your own

`meta.filter.control` is a **component**, rendered as JSX, so hooks may be used
inside. It receives `TMDataGridFilterControlArgs` and handles the value only:
it reads `operator` to shape itself and writes the bare value through
`onChange`, and the grid stores the `{ operator, value }` pair around it. The
column and operator dropdowns remain the panel's.

```tsx
const SalaryFilter: TMDataGridFilterControlComponent = ({
  operator,
  value,
  onChange,
}) =>
  operator === "between" ? (
    <RangeSlider /* value is the [min, max] pair */ />
  ) : (
    <NumberInput /* a single bound */ />
  );

meta: { filter: { control: SalaryFilter, defaultOperator: "between" } }
```

Define controls at module scope so their identity is stable. `args.options`
arrives pre-resolved through `resolveColumnOptions` for a column that declares
`meta.options` or is select-shaped. `args.table` is available to a control that
needs more than that.

```demo
file: columns/CustomFilterControl.tsx
hint: Open the filter panel - Status offers chips, every other column the built-in control.
```

## Custom matching

To give a column its own matching logic instead of its own control, set
`filterFn` on the column definition. The grid provides only `"tmDataGrid"`,
which is the default.

## Turning it off

`enableColumnFilters: false` removes the filter menu item, the `FilterButton`
and the panel. `enableColumnFilter: false` on a column removes that column's
menu item and its entry in the panel's column list.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableColumnFilters` | Table option | `boolean` | `true` | `false` removes the panel, the button and the menu item. |
| `enableColumnFilter` | Column option | `boolean` | `true` | `false` takes one column out of filtering. |
| `meta.type` | Column meta | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | Selects the operators and the value control. |
| `meta.filter.defaultOperator` | Column meta | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter opens on. |
| `meta.filter.control` | Column meta | `TMDataGridFilterControlComponent` | By type and operator | Replaces the value control. |
| `filterFn` | Column option | name \| fn | `"tmDataGrid"` | Custom matching for one column. |
| `TMDataGrid.FilterPanel` | Component | – | – | The panel of filter rows. |
| `TMDataGrid.FilterButton` | Component | – | – | Toolbar button opening the panel, with an active count. |
| `TMDataGrid.FilterPills` | Component | takes `api` | – | Active filters as removable pills, renderable anywhere. |
| `openColumnFilter` | Export | `(api, columnId) => void` | – | Opens the panel on a column, seeding an empty row. |
| `isFilterActive` | Export | `(value) => boolean` | – | Whether a filter value narrows anything. |
| `getOperatorsForType` | Export | `(type) => operators` | – | The operator list a type offers. |
| `FILTER_OPERATOR_LABELS` | Export | record | – | The label shown for each operator. |
| `TMDataGridFilterValueInput` | Export | component | – | The default value control, for falling back to. |
| `formatFilterLabel` | Export | `({ label, type, filter }) => string` | – | The one-line description used on the pills. |
| `emptyValueForOperator` · `operatorNeedsValue` · `operatorTakesArrayValue` · `operatorTakesRangeValue` | Exports | – | – | What shape of value an operator expects. |
| `DgRangeSliderFilter` · `DgDateRangeFilter` · `DgAutocompleteFilter` · `DgTriStateFilter` | Exports | components | – | The four ready-made controls. |

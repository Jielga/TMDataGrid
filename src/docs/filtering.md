# Filtering

Per-column filters, built out of an operator and a value. Users add them from
the filter panel, the column headers or a column menu - `filters` decides
which. You control what each column offers through `meta.type`, and can
replace the value control when the default input is not the right one.

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

A filter with an empty value stays in state, so a panel row survives while the
user types. (A header filter control has no row to keep alive and drops its
entry instead - see [Header filters](#header-filters).) It matches every row, does not set the header's filter
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

## Where the filter controls go: popup, sidebar, header

`filters` on `useTMDataGrid` decides which surface the grid renders.

```tsx
useTMDataGrid({ data, columns, filters: { surface: "sidebar", inHeader: true } });
```

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `surface` | `"popup" \| "sidebar" \| "none"` | `"popup"` | The surface `TMDataGrid.Table` renders and `TMDataGrid.FilterButton` toggles. |
| `sidebarSide` | `"left" \| "right"` | `"right"` | Which side the sidebar sits on. Ignored by the other surfaces. |
| `sidebarWidth` | `string` | `"280px"` | Width of the sidebar, any CSS length. Ignored by the other surfaces. |
| `defaultOpen` | `boolean` | `true` under `"sidebar"`, `false` otherwise | Whether the surface starts open. Read once, at mount. Under `"none"`, the starting value of `ui.state.filterPanelOpen`. |
| `inHeader` | `boolean` | `false` | A second header row of per-column controls. Independent of `surface`. |

`surface` and `inHeader` are two separate choices, not one list: `inHeader`
composes with all three surfaces. `{ surface: "none", inHeader: true }` is
header filters and nothing else; `{ inHeader: true }` keeps the popup as well,
for the multi-column work a header row has no room for.

The option is read field by field, so a literal is fine - unlike `labels` and
`persist`, it does not have to be referentially stable.

### The popup

The default. The panel floats over the first body rows, anchored under the
header. A pointerdown outside closes it, so does Escape, and so does emptying
it - by removing the last filter row or by **Clear all**. `FilterButton` is
exempt from the click-away, which is what keeps it a toggle.

Closing only hides the popup; the filters stay.

### The sidebar

`surface: "sidebar"` puts the same panel beside the rows, inside the grid
frame and under the toolbar. It is a column of the frame rather than a layer
over it, so the rows give up the width instead of being covered, and nothing
about working in the table dismisses it: not a click on a row, and not
clearing the filters, which leaves it standing with its **Add filter** button.
Escape closes it, so a keyboard user inside it has a way back out to the grid.

A sidebar starts open, unlike the popup - it is a layout choice rather than a
transient one. `defaultOpen: false` overrides that.

Its rows are stacked rather than side by side, because 280px has no room for
the triple. See `layout` below.

```demo
file: columns/FilterSidebar.tsx
hint: The funnel button in the toolbar closes the sidebar and gives the width back to the rows.
```

### Header filters

`inHeader: true` adds a second header row holding one value control per
filterable column, always visible. It is a row like the group rows above it -
on the same column tracks, in the same pinned lanes - so resizing, reordering
and pinning move each control with its column.

A header cell has room for a value and not much else, so the panel's column
and operator dropdowns are not there: the column is the one the cell sits
over, and the operator is a small funnel button beside the input, tinted
whenever the column is on anything but its default operator. The control
itself is the same one the panel would render, `meta.filter.control` included -
it receives `layout: "header"` and drops its field label for an `aria-label`.

Two pieces of column chrome come off with header filters on: the column menu's
**Filter** item and the funnel indicator on a filtered header. Both existed
only to reveal a control that is now always on screen. The filtered column's
tinted title stays, as does everything else about the header.

A header control has no row to keep alive, so clearing it removes the column's
`columnFilters` entry rather than leaving an empty one behind - unless the user
also picked a non-default operator, which is kept, being the part of the filter
an empty control cannot show. Panel rows still keep their empty filters; see
[How a filter is stored](#how-a-filter-is-stored).

A narrow column clips its control. Give a column that has to hold a date range
or a multi-select a `minSize` wide enough for it.

`FilterButton` still toggles whatever `surface` names, and the panel it opens
holds the same filters. `openColumnFilter` does not: with `inHeader` on it
always scrolls the column's header control into view and focuses it, leaving
the surface closed - the control the user can already see wins.

```demo
file: columns/HeaderFilters.tsx
hint: Department offers its faceted values; the funnel beside an input changes that column's operator.
```

### Placing the panel yourself

`surface: "none"` leaves the grid with no panel of its own, which makes a
hand-placed `TMDataGrid.FilterPanel` the only one on the page. The panel is a
plain block of controls - column, operator and value rows over an "Add filter"
/ "Clear all" footer - with no title, no close button and no open state, so it
renders wherever it is mounted: a card, a form, a drawer, a page column.

`layout` decides how one filter row is laid out.

| `layout` | Rows | For |
| --- | --- | --- |
| `"row"` (default) | Column, operator and value side by side | A host about 550px wide or more |
| `"stacked"` | The three one under the other, each filling the width | A drawer, a narrow column - what the sidebar surface uses |

```tsx
<Drawer opened={open} onClose={close}>
  <TMDataGrid.FilterPanel layout="stacked" />
</Drawer>
```

The value controls follow: `layout` reaches every `meta.filter.control` as its
own `layout`, so a custom control sizes itself to the same decision.

`TMDataGrid.FilterButton` renders nothing under this surface, having nothing to
toggle. Read `ui.state.filterPanelOpen` and render your own control if the
panel belongs behind one - `defaultOpen` sets where that state starts.

```demo
file: columns/FilterPanelPlaced.tsx
```

The panel still has to be inside `<TMDataGrid>`, like every other compound
component - it reads the grid from context. `TMDataGrid.FilterPills` is the
one that does not; see below.

## Filters outside the grid

`TMDataGrid.FilterPills` takes the grid as an `api` prop rather than reading
context, so active filters can live in a page header, above the toolbar, or
anywhere else on the page.

```demo
file: columns/FilterPills.tsx
```

It renders one pill per active filter - `First name: Sofia ✕` - where the ✕
clears that filter and a click on the label sends the user to that column's
control. Half-typed filters are left out. The label spells the operator out
unless it is the column type's default - `Age is greater than 30`, but
`First name: Sofia`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `api` | `TMDataGridApi<TData>` | – | The object returned by `useTMDataGrid`. |
| `size` | `MantineSize` | `"sm"` | Pill size. |
| `showClearAll` | `boolean` | `true` | "Clear all", shown once two filters are active. |
| `onPillClick` | `(columnId) => void` | – | Replaces the default click behaviour. |
| `className` | `string` | – | Added to the wrapper class. |

It is also exported as `TMDataGridFilterPills`. Use that import when nothing
else in the file touches `TMDataGrid`.

`openColumnFilter(api, columnId)` is what a pill's label and the column menu's
Filter item both call, and it is available for a control of your own. It seeds
an empty filter on the column if it has none yet, then sends the user to the
column's control: the panel row under `popup`, `sidebar` and `manual`, and the
header control - scrolled into view and focused - under `inHeader`.

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

`args.layout` says how much room the control has and whether it has to name
itself:

| `layout` | Where | The field |
| --- | --- | --- |
| `"row"` | A panel row laid out side by side | Labelled, fixed width |
| `"stacked"` | A panel row in a narrow host - the sidebar | Labelled, fills the width |
| `"header"` | One header cell, under `filters.inHeader` | No label; `aria-label` instead, fills the column |

```tsx
const SalaryFilter: TMDataGridFilterControlComponent = ({ layout, ...rest }) =>
  layout === "header" ? <NumberInput {...} /> : <RangeSlider {...} />;
```

A control that ignores `layout` still works - it will simply look the same
everywhere, which is fine until it has to fit a header cell. Every built-in
control honours it.

```demo
file: columns/CustomFilterControl.tsx
hint: Open the filter panel - Status offers chips, every other column the built-in control.
```

## Custom matching

To give a column its own matching logic instead of its own control, set
`filterFn` on the column definition. The grid provides only `"tmDataGrid"`,
which is the default.

## Turning it off

`enableColumnFilters: false` removes the filter menu item, the `FilterButton`,
the panel and the header filter row. `enableColumnFilter: false` on a column
removes that column's menu item, its entry in the panel's column list and its
header control - the header cell stays, empty.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableColumnFilters` | Table option | `boolean` | `true` | `false` removes the panel, the button, the header row and the menu item. |
| `filters.surface` | Table option | `"popup" \| "sidebar" \| "none"` | `"popup"` | Which surface the table renders. |
| `filters.sidebarSide` | Table option | `"left" \| "right"` | `"right"` | Which side the sidebar sits on. |
| `filters.sidebarWidth` | Table option | `string` | `"280px"` | Width of the sidebar. |
| `filters.defaultOpen` | Table option | `boolean` | `true` under `"sidebar"` | Whether the surface starts open. |
| `filters.inHeader` | Table option | `boolean` | `false` | A second header row of per-column controls. |
| `enableColumnFilter` | Column option | `boolean` | `true` | `false` takes one column out of filtering. |
| `meta.type` | Column meta | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | Selects the operators and the value control. |
| `meta.filter.defaultOperator` | Column meta | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter opens on. |
| `meta.filter.control` | Column meta | `TMDataGridFilterControlComponent` | By type and operator | Replaces the value control. |
| `filterFn` | Column option | name \| fn | `"tmDataGrid"` | Custom matching for one column. |
| `TMDataGrid.FilterPanel` | Component | `layout: "row" \| "stacked"` | `"row"` | The panel of filter rows, as a plain block. |
| `TMDataGrid.FilterButton` | Component | – | – | Toolbar button toggling the surface, with an active count. Opening it seeds an empty filter row on the first filterable column. |
| `TMDataGrid.FilterPills` | Component | takes `api` | – | Active filters as removable pills, renderable anywhere. |
| `openColumnFilter` | Export | `(api, columnId) => void` | – | Sends the user to a column's filter control, seeding an empty filter. |
| `TMDataGridFilterControlArgs` | Type | `layout: "row" \| "stacked" \| "header"` | – | What a value control is handed, `layout` saying how much room it has. |
| `isFilterActive` | Export | `(value) => boolean` | – | Whether a filter value narrows anything. |
| `getOperatorsForType` | Export | `(type) => operators` | – | The operator list a type offers. |
| `FILTER_OPERATOR_LABELS` | Export | record | – | The label shown for each operator. |
| `TMDataGridFilterValueInput` | Export | component | – | The default value control, for falling back to. |
| `formatFilterLabel` | Export | `({ label, type, filter }) => string` | – | The one-line description used on the pills. |
| `emptyValueForOperator` · `operatorNeedsValue` · `operatorTakesArrayValue` · `operatorTakesRangeValue` · `filterValueShape` | Exports | – | – | What shape of value an operator expects. |
| `TMDataGridFiltersOptions` · `TMDataGridFiltersSettings` · `TMDataGridFilterSurface` · `TMDataGridFilterSidebarSide` | Types | – | – | The `filters` option, and the resolved form of it on `api.filters`. |
| `TMDataGridFilterPanelProps` · `TMDataGridFilterPanelLayout` | Types | – | – | For wrapping `TMDataGrid.FilterPanel` in a component of your own. |
| `DgRangeSliderFilter` · `DgDateRangeFilter` · `DgAutocompleteFilter` · `DgTriStateFilter` | Exports | components | – | The four ready-made controls. |

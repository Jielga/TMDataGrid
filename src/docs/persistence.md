# Persistence

Restores table state on mount and writes it back on every change, so users
return to the grid as they left it.

State is split across **two keys**, because the two groups have different
lifetimes. Column configuration stays valid indefinitely; filters and pagination
go stale as the data underneath them changes. Separate keys let one be cleared
without touching the other.

```tsx
// Module scope: the object is a dependency of the write subscription, and a
// new identity every render would resubscribe on every render.
const persist = {
  dataKey: "employees.data",
  settingsKey: "employees.settings",
} satisfies TMDataGridPersistence;

const grid = useTMDataGrid({ data, columns, persist });
```

Both keys are optional - pass only `settingsKey` to remember the layout but
never the filters.

```demo
file: data/Persistence.tsx
hint: Sort, filter and hide a column, then reload the page. It all comes back; the page index does not.
extraSources: data/employeeColumns.tsx
```

## The two groups

| Group | Slices | Lifetime |
| --- | --- | --- |
| `dataKey` | `columnFilters`, `globalFilter`, `sorting`, `pagination`, `expanded` | As long as the data means the same thing |
| `settingsKey` | `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning`, `grouping` | Indefinite. This is the user's layout |

`DATA_STATE_SLICES` and `SETTINGS_STATE_SLICES` are exported with the same
values. Slice names are typed per group, so only valid names compile.

## Persisting only some of it

A key on its own persists every slice in its group. Pass a tuple to narrow it:

```tsx
const persist = {
  // Restore filters and sorting, but always start on the first page.
  dataKey: ["employees.data", ["columnFilters", "sorting"]],
  // Restore column layout but not widths.
  settingsKey: ["employees.settings", ["columnVisibility", "columnOrder"]],
  storageMode: "sessionStorage",
} satisfies TMDataGridPersistence;
```

Only the selected slices are read back, so a payload written before you narrowed
the selection cannot reintroduce slices you have since opted out of.

## Behaviour

**Restoring happens once**, on mount, through `initialState`. Writing is a
subscription to the table store, so state changed directly through the table
API is persisted too.

**A payload from another version is dropped whole**, not migrated. Payloads
carry the exported `PERSIST_PAYLOAD_VERSION`, and anything else, including
everything written by a 0.x build, which had no stamp, is discarded. The cost is
one lost layout, which is preferable to interpreting a shape the current code no
longer understands.

**Restored state is realigned against the columns that exist.** Entries naming a
column removed between deploys are dropped: a stale id in the order, a width for
a column that no longer exists, or a sort or filter that would be active with no
column to show it. New columns need no handling, since TanStack appends columns
missing from `columnOrder` in definition order.

**Storage access is guarded.** If storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

**Keys are not namespaced.** Include a tenant or user identifier if several
people can share a browser profile.

## Resetting

`resetSettings()` puts the settings state back to what a first visit with clean
storage would have shown (your `initialState` plus the structural lanes), and,
with persistence configured, writes through to storage like any other change.
The columns panel's **Reset layout** button calls it.

TanStack's own `resetColumnX()` family cannot do it on a persisted grid: those
reset to `initialState`, which the mount built *from* the restored payload.

## Why not `useLocalStorage`

Mantine's hook holds a piece of state and returns `[value, setValue]`. Here the
table already holds the state and storage only mirrors it. Routing writes
through the hook would keep a second copy and trigger a React state update on
every change, including every pointer move during a column resize.

Its defaults conflict too: `getInitialValueInEffect: true` delivers the stored
value after mount, while `initialState` is only read on the first render, and
`sync: true` would let two open tabs overwrite each other's column layout.

The option names follow Mantine's `UseStorageOptions` where they apply, and
`storageMode` takes the same values as its `StorageType`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `persist` | Option | `TMDataGridPersistence` | – | The whole configuration. Keep it referentially stable. |
| `dataKey` | persist field | `string \| [string, DataSlice[]]` | – | Storage key for the data group. |
| `settingsKey` | persist field | `string \| [string, SettingsSlice[]]` | – | Storage key for the settings group. |
| `storageMode` | persist field | `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage area. `"sessionStorage"` is per tab. |
| `serialize` | persist field | `(value) => string` | `JSON.stringify` | Serializes a payload before storing. |
| `deserialize` | persist field | `(value: string) => unknown` | `JSON.parse` | Parses a stored payload. |
| `resetSettings` | Hook return | `() => void` | – | Back to a clean first visit, written through to storage. |
| `DATA_STATE_SLICES` · `SETTINGS_STATE_SLICES` | Exports | `string[]` | – | The slice names of each group. |
| `PERSIST_PAYLOAD_VERSION` | Export | `number` | – | The stamp. A payload from another version is dropped. |

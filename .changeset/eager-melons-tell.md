---
"@jielga/tmdatagrid": patch
---

Controlled `state` no longer renders forever.

TanStack re-reads `options.state` on every render and compares each slice by
identity, so a `state` object built in the consumer's render body published a
new value each time and the publish re-rendered the consumer. The grid now
hands the table back the previous value for a slice that says the same thing,
which makes `state: { columnVisibility: { play: false } }` safe to write
inline. A controlled slice passed without its `onXChange` warns once: nothing
can write to it, and `initialState` is what seeds a starting value.

Also: a controlled `columnVisibility` no longer hides the generated lanes or
drops the tree column's entry, which tracks `grouping` and is the grid's own.
The same entry is now seeded into an external `atoms.columnVisibility`, which
`initialState` never reached - an empty tree lane used to show in a grid with
nothing grouped.

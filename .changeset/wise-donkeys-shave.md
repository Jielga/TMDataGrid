---
"@jielga/tmdatagrid": major
---

**Breaking.** Column meta groups its editing and filtering fields into two
namespaces, `meta.edit` and `meta.filter`, named after the `edit` engine and the
filter panel they configure. A new `meta.edit.mapValue` maps a value on its way
into the draft, and the deprecated `autoFocus` on the editor contract is gone.

Column meta had grown flat across four concerns at once, so a field name had to
carry its own stage: `editable` and `filterControl` sat beside `label` and
`align` with nothing but the prefix to say which part of the grid read them.
Grouping them puts what a column **is** at the top level and what a stage
**does** with it inside that stage's namespace, and it mirrors the runtime API,
where editing has been `edit.begin()` / `edit.commit()` / `edit.store` all along.

| Before | After |
| --- | --- |
| `meta.editable` | `meta.edit.enabled` |
| `meta.editField` | `meta.edit.field` |
| `meta.editor` | `meta.edit.editor` |
| `meta.validate` | `meta.edit.validate` |
| `meta.filterControl` | `meta.filter.control` |
| `meta.defaultFilterOperator` | `meta.filter.defaultOperator` |

```tsx
// Before
meta: { type: "number", defaultFilterOperator: "between", editable: false }

// After
meta: {
  type: "number",
  filter: { defaultOperator: "between" },
  edit: { enabled: false },
}
```

`meta.type` and `meta.options` stay at the top level: one declaration of each
feeds the filter panel and the cell editor alike, and moving either into a
namespace would mean declaring it twice. Every old field is a compile error
after the upgrade, so `tsc` names each site to change.

**`meta.edit.mapValue`** maps every value an editor writes, before it reaches
the draft: uppercase a code, strip spaces from an IBAN, clamp a number into
range. It runs per write, so a text input maps per keystroke and a select per
pick, and what it returns is what the cell shows, what the validators judge and
what commits.

```tsx
meta: {
  edit: {
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}
```

The map is applied in the editor host, around the field every editor writes
through, so one declaration covers the six built-in editors, a custom
`meta.edit.editor`, and the character that opened the editor when typing started
the edit. The value an editor opens with is deliberately not mapped, since that
would rewrite stored data nobody edited and swallow the select-all that lets the
first keystroke replace the value; neither is `edit.clearCell()`, which writes
the type's empty value through the form rather than through an editor. The
built-in string and number editors keep the caret where it was typed across a
mapped write, which a hand-rolled editor previously had to solve for itself.

**`TMDataGridEditorArgs.autoFocus` is removed**, as 1.1.1 said it would be. The
grid has placed the caret itself since then, so an editor that ignored the prop
already behaved correctly and one that honoured it loses nothing. A row opened
by `edit.addRow()` now gets the same treatment: its caret lands in the first
editable cell whether that cell holds a built-in editor or your own, which the
old `autoFocus` path only managed for the built-ins.

New exported types: `TMDataGridColumnEditOptions`, `TMDataGridColumnFilterOptions`,
`TMDataGridEditValueMap` and `TMDataGridEditValueMapArgs`. New exported readers:
`getColumnFilterControl` and `isColumnEditableForRow`.

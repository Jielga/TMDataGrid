# Editors and validation

Reference for the `editing` skill. Which control a cell opens, and what stops a
bad value being committed. Both follow from the column.

## The built-in editors

`meta.type` picks one, `meta.options` feeds the two select editors from the same
declaration the filter panel reads.

| `meta.type` | Editor | Writes | Export |
| --- | --- | --- | --- |
| `"string"` (default) | Text input | `string` | `TMDataGridStringEditor` |
| `"number"` | Number input | `number`, or `null` while the cell is empty or the text is not yet a number | `TMDataGridNumberEditor` |
| `"boolean"` | Checkbox | `boolean` | `TMDataGridBooleanEditor` |
| `"date"` | Native `<input type="date">` | A `Date`, or the ISO `"YYYY-MM-DD"` string; `null` when cleared | `TMDataGridDateEditor` |
| `"select"` | Searchable select, commits on pick under `"cell"` | `string \| null` | `TMDataGridSelectEditor` |
| `"multiSelect"` | Multi-select, same source | `string[]` | `TMDataGridMultiSelectEditor` |

**Writes** is the value the editor puts into the draft: what `meta.edit.mapValue` is handed, what `meta.edit.validate` checks, and what a commit carries in `value` and in `changes[].next`.

The number editor writes `null` rather than `NaN` while the text does not parse, so a half-typed number leaves the field empty instead of committing a number no rule can describe.
The date editor picks between its two types once, when it opens, from what the cell held: a `Date` cell keeps receiving `Date`s and a string cell keeps receiving `"YYYY-MM-DD"` strings, so clearing and retyping cannot flip the type.
A validator for a date column has to accept whichever of the two that column's data holds.

```tsx
columnHelper.accessor("department", {
  header: "Department",
  meta: { type: "select", options: ["Engineering", "Sales", "Support"] },
});
```

`meta.options` takes a static array, `"faceted"` (the distinct values present in
the data), or a function of the table, column and row.

## The editor API

`meta.edit.editor` fills the same slot as the built-ins. It is a **component**,
rendered as JSX, so hooks may be used inside it.

```ts
type TMDataGridEditorArgs = {
  field: TMDataGridEditField; // the live TanStack Form field
  form: TMDataGridRowEditForm; // the row's form, for sibling fields
  cell: Cell;
  row: Row;
  column: Column;
  table: TMDataGridTable;
  commit: () => Promise<boolean>; // what Enter would do
  cancel: () => void; // what Escape would do
  size: TMDataGridSize;
  seedText?: string; // set when typing opened the editor
};
```

The grid places the caret itself, once per open gesture: it focuses
`data-dg-part="editor-input"` when the editor publishes it, and the first
focusable element inside the editor otherwise. So a custom editor gets the caret
without asking for focus - set `editor-input` only to name which of several
inputs should take it.

Bind any control to `field` exactly as inside any TanStack Form:
`field.state.value`, `field.state.meta.errors`, `field.handleChange`,
`field.handleBlur`.

Binding `field.state.meta.errors` is what shows a refused commit: the built-in
editors pass the first error to the input's `error` prop, and an editor that
binds nothing leaves a blocked save as `data-invalid` on the cell with no
message on screen. An entry is a string from a function validator, or an issue
carrying a `message` from a schema.

```tsx
import { Slider } from "@mantine/core";
import type { TMDataGridEditorComponent } from "@jielga/tmdatagrid";

// Module scope. A new identity per render remounts the editor mid-edit.
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit, cancel }) => (
  <Slider
    value={Number(field.state.value ?? 0)}
    min={0}
    max={100_000}
    step={1_000}
    onChange={(next) => field.handleChange(next)}
    onChangeEnd={() => void commit()}
    onKeyDown={(event) => {
      if (event.key === "Escape") cancel();
    }}
  />
);

columnHelper.accessor("salary", {
  header: "Salary",
  meta: { type: "number", edit: { editor: SalaryEditor } },
});
```

## Wrapping a built-in

The built-ins take `TMDataGridEditorArgs` as their props, so a custom editor can
pass the whole object through and render around it instead of starting from
scratch.

```tsx
import { Group, Text } from "@mantine/core";
import {
  TMDataGridNumberEditor,
  TMDataGridSelectEditor,
  TMDataGridStringEditor,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";

// Decorate one.
const SalaryEditor: TMDataGridEditorComponent = (args) => (
  <Group gap={4} wrap="nowrap" w="100%">
    <TMDataGridNumberEditor {...args} />
    <Text size="xs" c="dimmed">
      kr
    </Text>
  </Group>
);

// Or choose between them per row.
const DepartmentEditor: TMDataGridEditorComponent = (args) =>
  args.row.original.status === "Terminated" ? (
    <TMDataGridStringEditor {...args} />
  ) : (
    <TMDataGridSelectEditor {...args} />
  );
```

Pass `args` through whole. `field` is a live TanStack Form `FieldApi`, not a
plain object, so spreading or rebuilding it loses the binding its methods rely
on.

## Mapping the value

`meta.edit.mapValue` maps every value an editor writes, before it reaches the
draft. It runs per write, which for a text input is per keystroke and for a
select is per pick.

```tsx
meta: {
  edit: {
    // Uppercase as it is typed.
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}

meta: {
  edit: {
    // Depends on the record being edited; `previous` is the value the field
    // held before this write.
    mapValue: ({ value, previous, row }) =>
      row.original.country === "SE" ? normalise(value) : previous,
  },
}
```

The grid applies it in the editor host, around the field every editor writes
through, so it covers the six built-ins, a custom `meta.edit.editor`, and the
type-to-edit seed character.

Left unmapped on purpose:

- The value an editor opens with. Mapping it would rewrite stored data nobody
  edited, mark a pristine row dirty and swallow the select-all.
- `edit.clearCell()`, the Delete key: it writes the type's empty value through
  the form, so there is no input to map.
- `edit.setCellValue()` and `edit.setRowValues()`: they write through the form
  too, and the caller passes the stored value itself. `meta.edit.validate` still
  runs on the commit.
- An editor calling `field.setValue`. `handleChange` is the mapped path.

The built-in string and number editors restore the caret after a mapped write,
shifted by the length the map changed, because React reassigning `input.value`
otherwise drops the caret at the end of the field. A custom editor rendering its
own input has to do the same: record `selectionStart` on change, restore it in a
layout effect.

## Field validation

`meta.edit.validate` takes TanStack Form's field-validator vocabulary. A bare schema
(Zod, or any Standard Schema, or a plain function) means `{ onChange: it }`; the
object form takes every trigger Form defines.

```tsx
import { z } from "zod";

// Bare schema: validates on change.
meta: { edit: { validate: z.string().min(2, "At least two characters") } }

// Object form: pick the trigger.
meta: { edit: { validate: { onBlur: z.string().email("Not an email address") } } }

// A plain function works too.
meta: { edit: { validate: ({ value }) => (value > 0 ? undefined : "Must be positive") } }
```

`normalizeFieldValidate(validate)` is exported for consumers building their own
column factories: it turns a bare schema into Form's validator shape.

## Row validation

`editing.rowValidators` is form-level, and where cross-field rules live.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "row",
    rowValidators: {
      onSubmit: z
        .object({ salary: z.number().positive(), status: z.string() })
        .refine((row) => row.status !== "Terminated" || row.salary === 0, {
          message: "A terminated employee has no salary",
        }),
    },
    onCommit,
  },
});
```

Issues with a path land on the matching column's cell; pathless issues land on
the row, where the message shows in the edit lane's tooltip - on the open
row's ✓, and on the parked row's marker. A nested schema's issues follow the
same rule, so a `address.city` issue lands on the column whose `editField` is
`"address.city"`.

Cross-field rules need a mode that commits the whole row at once. Under `"cell"`
each cell commits alone, so the rule is evaluated against the other column's
unedited value and cannot pass. Use `"row"`.

## Server-side errors

`editing.rowValidators.onSubmitAsync` returns TanStack Form's `{ form, fields }`
shape, so an API's field errors land on the right cells without translation.

```tsx
rowValidators: {
  onSubmitAsync: async ({ value }) => {
    const response = await api.validateEmployee(value);
    if (response.ok) return undefined;
    return {
      form: response.message,
      fields: response.fieldErrors, // { salary: "Above the band ceiling" }
    };
  },
},
```

A commit blocked by validation keeps the editor open with the message on the
input. A rejected `editing.onCommit` keeps the draft too, with the error on the
row.

## Where the state shows

| Marker | Means |
| --- | --- |
| The cell's own value | A held draft is displayed: the cell renders the draft value through the column's `cell` renderer, in every mode |
| Blue cell corner | The field is dirty against its original value |
| Red cell corner | The field carries a validation error |
| Row error text | A pathless rule failed, or a commit was rejected. In the lane's tooltip: the open row's ✓, or the parked row's marker |
| `data-dirty` on the row | The row holds a dirty draft |

The same information is readable from `edit.store`: `rows[rowId].dirtyFields`,
`rows[rowId].errorFields`, `rows[rowId].errorMessages` (`{ field, message }`
pairs), `rows[rowId].hasRowError`, `rows[rowId].isSubmitting`, and
`rows[rowId].values` for the draft itself. The pathless message's text is not
in the store; read it from `edit.getForm(rowId)?.state.errors`.

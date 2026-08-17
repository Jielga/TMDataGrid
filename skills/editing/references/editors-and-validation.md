# Editors and validation

Reference for the `editing` skill. Which control a cell opens, and what stops a
bad value being committed. Both follow from the column.

## The built-in editors

`meta.type` picks one, `meta.options` feeds the two select editors from the same
declaration the filter panel reads.

| `meta.type` | Editor | Export |
| --- | --- | --- |
| `"string"` (default) | Text input | `TMDataGridStringEditor` |
| `"number"` | Number input | `TMDataGridNumberEditor` |
| `"boolean"` | Checkbox | `TMDataGridBooleanEditor` |
| `"date"` | Native `<input type="date">`, ISO `YYYY-MM-DD` | `TMDataGridDateEditor` |
| `"select"` | Searchable select, commits on pick under `"cell"` | `TMDataGridSelectEditor` |
| `"multiSelect"` | Multi-select, same source | `TMDataGridMultiSelectEditor` |

```tsx
columnHelper.accessor("department", {
  header: "Department",
  meta: { type: "select", options: ["Engineering", "Sales", "Support"] },
});
```

`meta.options` takes a static array, `"faceted"` (the distinct values present in
the data), or a function of the table, column and row.

## The editor contract

`meta.editor` fills the same slot the built-ins fill. It is a **component**,
rendered as JSX, so hooks are legal inside it.

```ts
type TMDataGridEditorArgs = {
  field: TMDataGridEditField; // the live TanStack Form field
  form: TMDataGridRowEditForm; // the whole row's form, for sibling fields
  cell: Cell;
  row: Row;
  column: Column;
  table: TMDataGridTable;
  commit: () => Promise<boolean>; // what Enter would do
  cancel: () => void; // what Escape would do
  size: TMDataGridSize;
  autoFocus: boolean; // take focus on mount
  seedText?: string; // set when typing opened the editor
};
```

Bind any control to `field` exactly as inside any TanStack Form:
`field.state.value`, `field.state.meta.errors`, `field.handleChange`,
`field.handleBlur`.

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
  meta: { type: "number", editor: SalaryEditor },
});
```

## Wrapping a built-in

The built-ins take `TMDataGridEditorArgs` as their props, so a custom editor can
pass the whole object through and add around it rather than start over.

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

## Field validation

`meta.validate` takes TanStack Form's field-validator vocabulary. A bare schema
(Zod, or any Standard Schema, or a plain function) means `{ onChange: it }`; the
object form takes every trigger Form defines.

```tsx
import { z } from "zod";

// Bare schema: validates on change.
meta: { validate: z.string().min(2, "At least two characters") }

// Object form: pick the trigger.
meta: { validate: { onBlur: z.string().email("Not an email address") } }

// A plain function works too.
meta: { validate: ({ value }) => (value > 0 ? undefined : "Must be positive") }
```

`normalizeFieldValidate(validate)` is exported for consumers building their own
column factories: it turns a bare schema into Form's validator shape.

## Row validation

`rowValidators` is form-level, and where cross-field rules live.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editMode: "row",
  rowValidators: {
    onSubmit: z
      .object({ salary: z.number().positive(), status: z.string() })
      .refine((row) => row.status !== "Terminated" || row.salary === 0, {
        message: "A terminated employee has no salary",
      }),
  },
  onEditCommit,
});
```

Issues with a path land on the matching column's cell; pathless issues land on
the row. A nested schema's issues follow the same rule, so a `address.city`
issue lands on the column whose `editField` is `"address.city"`.

Cross-field rules need a mode that commits the whole row at once. Under `"cell"`
each cell commits alone, so the rule is evaluated against the other column's
unedited value and can never pass. Use `"row"` or `"batch"`.

## Server-side errors

`rowValidators.onSubmitAsync` returns TanStack Form's `{ form, fields }` shape,
so an API's field errors land on the right cells without translation.

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
input. A rejected `onEditCommit` keeps the draft too, with the error on the row.

## Where the state shows

| Marker | Means |
| --- | --- |
| Blue cell corner | The field is dirty against its original value |
| Red cell corner | The field carries a validation error |
| Row error text | A pathless rule failed, or a commit was rejected |

The same information is readable from `edit.store`: `rows[rowId].dirtyFields`,
`rows[rowId].errorFields`, `rows[rowId].isSubmitting`.

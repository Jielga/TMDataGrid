import {
  Alert,
  Button,
  Group,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditorArgs,
  type TMDataGridEditorComponent,
  type TMDataGridRowValidators,
} from "../../../tmdatagrid";

const FIELDS = ["title", "status", "hired"] as const;
type QueryField = (typeof FIELDS)[number];

type QueryCondition = {
  /** Negative while unsaved - the server mints the real id. */
  id: number;
  field: QueryField;
  operator: string;
  value: string;
};

const OPERATORS: Record<QueryField, ReadonlyArray<string>> = {
  title: ["contains", "equals", "starts with"],
  status: ["equals", "does not equal"],
  hired: ["before", "after", "on"],
};

const STATUSES = ["Active", "On leave", "Terminated"];

const INITIAL_CONDITIONS: Array<QueryCondition> = [
  { id: 1, field: "title", operator: "contains", value: "engineer" },
  { id: 2, field: "status", operator: "equals", value: "Active" },
];

/**
 * Every editor reads its live values from the row's form store, which each
 * editor receives - `field.state.value` alone is a render-time read, so a
 * controlled input bound to it goes stale after its own handleChange.
 */
const useDraft = (form: TMDataGridEditorArgs["form"]) =>
  useSelector(form.store, (state) => state.values as QueryCondition);

/**
 * Picking a field changes what the other two columns mean, so this editor
 * also resets them - through the row's own form.
 */
const FieldEditor: TMDataGridEditorComponent = ({ field, form, size }) => {
  const draft = useDraft(form);
  return (
    <Select
      size={size}
      w="100%"
      data={[...FIELDS]}
      comboboxProps={{ withinPortal: false }}
      aria-label="Field"
      value={draft.field}
      onChange={(next) => {
        if (next === null) return;
        field.handleChange(next);
        form.setFieldValue("operator", OPERATORS[next as QueryField][0]);
        form.setFieldValue("value", "");
      }}
    />
  );
};

/** Offers the operators of the field being picked, not the committed one. */
const OperatorEditor: TMDataGridEditorComponent = ({ field, form, size }) => {
  const draft = useDraft(form);
  return (
    <Select
      size={size}
      w="100%"
      data={[...OPERATORS[draft.field]]}
      comboboxProps={{ withinPortal: false }}
      aria-label="Operator"
      value={draft.operator}
      onChange={(next) => next !== null && field.handleChange(next)}
    />
  );
};

/** A text box, a select or a date input - whichever the draft field wants. */
const ValueEditor: TMDataGridEditorComponent = ({ field, form, size }) => {
  const draft = useDraft(form);
  if (draft.field === "status") {
    return (
      <Select
        size={size}
        w="100%"
        data={STATUSES}
        comboboxProps={{ withinPortal: false }}
        aria-label="Value"
        value={draft.value}
        onChange={(next) => next !== null && field.handleChange(next)}
      />
    );
  }
  return (
    <TextInput
      size={size}
      w="100%"
      type={draft.field === "hired" ? "date" : "text"}
      aria-label="Value"
      value={draft.value}
      onChange={(event) => field.handleChange(event.currentTarget.value)}
    />
  );
};

const columnHelper = createTMDataGridColumnHelper<QueryCondition>();

const columns = columnHelper.columns([
  columnHelper.accessor("field", {
    header: "Field",
    minSize: 120,
    meta: { edit: { editor: FieldEditor } },
  }),
  columnHelper.accessor("operator", {
    header: "Operator",
    minSize: 140,
    meta: { edit: { editor: OperatorEditor } },
  }),
  columnHelper.accessor("value", {
    header: "Value",
    minSize: 160,
    meta: { edit: { editor: ValueEditor } },
  }),
]);

/** The row's own rule: whatever the operator, it compares against something. */
const rowValidators = {
  onSubmit: z
    .object({ value: z.string() })
    .refine((condition) => condition.value.trim().length > 0, {
      message: "The condition needs a value",
      path: ["value"],
    }),
} satisfies TMDataGridRowValidators;

/**
 * The grid packaged as a form field: rows in through `value`, the next array
 * out through `onChange`. The component owns nothing - every change is the
 * form's to keep.
 */
function ConditionsGrid({
  value,
  onChange,
  onOpenDraftChange,
}: {
  value: Array<QueryCondition>;
  onChange: (next: Array<QueryCondition>) => void;
  onOpenDraftChange: (open: boolean) => void;
}) {
  const grid = useTMDataGrid({
    data: value,
    columns,
    getRowId: (row) => String(row.id),
    editMode: "row",
    rowValidators,
    // Map by row id, never by index - a sort or a delete moves the index,
    // and the draft is keyed by id.
    onEditCommit: ({ rowId, value: row }) =>
      onChange(
        value.map((condition) =>
          String(condition.id) === rowId ? row : condition,
        ),
      ),
    // New rows count down from -1; the server mints real ids on save.
    // Math.min(0, ...) so an emptied grid starts at -1, not -Infinity.
    onRowAdd: ({ value: row }) =>
      onChange([
        ...value,
        { ...row, id: Math.min(0, ...value.map((c) => c.id)) - 1 },
      ]),
    onRowDelete: ({ rowId }) =>
      onChange(value.filter((condition) => String(condition.id) !== rowId)),
    newRowDefaults: (): QueryCondition => ({
      id: 0,
      field: "title",
      operator: "contains",
      value: "",
    }),
    enableRowSelection: false,
    enableGrouping: false,
  });

  // The one thing the form needs to know that only the grid does: whether a
  // condition is mid-edit. The store publishes no values, just the fact.
  const hasOpenDraft = useSelector(
    grid.edit.store,
    (state) => state.openRowIds.length > 0,
  );
  useEffect(() => {
    onOpenDraftChange(hasOpenDraft);
  }, [hasOpenDraft, onOpenDraftChange]);

  return (
    <TMDataGrid {...grid} size="sm" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => grid.edit.addRow()}
        >
          Add condition
        </Button>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<QueryCondition> />
    </TMDataGrid>
  );
}

export function QueryBuilderForm() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [hasOpenDraft, setHasOpenDraft] = useState(false);

  const form = useForm({
    defaultValues: {
      from: "",
      to: "",
      title: "",
      conditions: INITIAL_CONDITIONS,
    },
    onSubmit: ({ value }) =>
      setSubmitted(
        `Searching ${value.from || "…"} to ${value.to || "…"}` +
          (value.title ? ` for "${value.title}"` : "") +
          ` with ${value.conditions.length} condition(s)`,
      ),
  });

  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const conditionsError = useSelector(form.store, (state) =>
    state.fieldMeta.conditions?.errors.find(
      (error): error is string => typeof error === "string",
    ),
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
        minHeight: 0,
      }}
    >
      <Group gap="xs" align="flex-end">
        <form.Field name="from">
          {(field) => (
            <TextInput
              label="From"
              type="date"
              size="xs"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
            />
          )}
        </form.Field>
        <form.Field name="to">
          {(field) => (
            <TextInput
              label="To"
              type="date"
              size="xs"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
            />
          )}
        </form.Field>
        <form.Field name="title">
          {(field) => (
            <TextInput
              label="Title"
              placeholder="Any title"
              size="xs"
              style={{ flex: 1 }}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
            />
          )}
        </form.Field>
      </Group>

      <form.Field
        name="conditions"
        validators={{
          // Collection rules live here: they need the whole array, which no
          // single row can see. Runs per approved row, never per keystroke.
          onChange: ({ value }) => {
            if (value.length === 0) return "Add at least one condition";
            const pairs = value.map((c) => `${c.field}:${c.operator}`);
            return pairs.some((pair, i) => pairs.indexOf(pair) !== i)
              ? "Two conditions repeat the same field and operator"
              : undefined;
          },
        }}
      >
        {(field) => (
          <ConditionsGrid
            value={field.state.value}
            onChange={field.handleChange}
            onOpenDraftChange={setHasOpenDraft}
          />
        )}
      </form.Field>

      {conditionsError && (
        <Alert color="red" variant="light" p="xs">
          {conditionsError}
        </Alert>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {submitted ?? "Nothing searched yet"}
        </Text>
        <Button
          type="submit"
          size="compact-sm"
          disabled={!canSubmit || hasOpenDraft}
        >
          {hasOpenDraft ? "Finish the open condition" : "Search"}
        </Button>
      </Group>
    </form>
  );
}

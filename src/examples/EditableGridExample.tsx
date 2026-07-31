import {
  Badge,
  Button,
  Code,
  Flex,
  Group,
  SegmentedControl,
  Slider,
  Text,
} from "@mantine/core";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitBatchArgs,
  type TMDataGridEditMode,
} from "../tmdatagrid";

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  salary: number;
  active: boolean;
  hired: string;
  department: string;
  skills: Array<string>;
};

const DEPARTMENTS = ["Engineering", "Design", "Sales", "Support"];
const FIRST = ["Anna", "Erik", "Maria", "Lars", "Sofia", "Johan", "Elin", "Oskar"];
const LAST = ["Lindberg", "Åkesson", "Nyström", "Ek", "Holm", "Sandell"];
const SKILLS = ["React", "TypeScript", ".NET", "SQL", "Figma", "Excel"];

function makeEmployees(count: number, idOffset = 0): Array<Employee> {
  return Array.from({ length: count }, (_, index) => ({
    id: idOffset + index + 1,
    firstName: FIRST[index % FIRST.length],
    lastName: LAST[(index * 3 + 1) % LAST.length],
    salary: 32_000 + ((index * 977) % 300) * 100,
    active: index % 5 !== 3,
    hired: `20${18 + (index % 8)}-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + ((index * 7) % 28)).padStart(2, "0")}`,
    department: DEPARTMENTS[index % DEPARTMENTS.length],
    skills: [SKILLS[index % SKILLS.length], SKILLS[(index + 2) % SKILLS.length]],
  }));
}

const sek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

const columnHelper = createTMDataGridColumnHelper<Employee>();

/** Grid A — every built-in editor across the typed columns. */
const inlineColumns = columnHelper.columns([
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
    meta: { validate: z.string().min(2, "At least two characters") },
  }),
  columnHelper.accessor("lastName", {
    header: "Last name",
    minSize: 120,
    meta: { validate: z.string().min(2, "At least two characters") },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: {
      type: "number",
      align: "right",
      validate: z.number({ error: "A number" }).positive("Must be positive"),
    },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("active", {
    header: "Active",
    minSize: 90,
    meta: { type: "boolean", align: "center" },
    cell: (info) => (info.getValue() ? "✓" : "—"),
  }),
  columnHelper.accessor("hired", {
    header: "Hired",
    minSize: 130,
    meta: { type: "date" },
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    // One declaration feeds the filter panel and the editor dropdown alike.
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("skills", {
    header: "Skills",
    minSize: 200,
    meta: { type: "multiSelect", options: SKILLS },
    cell: (info) => (
      <Group gap={4} wrap="nowrap">
        {info.getValue().map((skill) => (
          <Badge key={skill} variant="light" size="sm">
            {skill}
          </Badge>
        ))}
      </Group>
    ),
  }),
]);

/**
 * Grid B — row mode: the pencil opens every cell of the row, the ✓ saves
 * them as one commit. Salary demos a custom editor over the live Form field
 * API; the row schema's `.refine()` is a cross-field rule that lands on the
 * row (the Save's tooltip), not on any one cell.
 */
const rowColumns = columnHelper.columns([
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
    meta: { validate: z.string().min(2, "At least two characters") },
  }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 200,
    meta: {
      type: "number",
      align: "right",
      renderEditor: ({ field }) => (
        <Slider
          w="100%"
          min={20_000}
          max={90_000}
          step={500}
          label={(value) => sek(value)}
          value={typeof field.state.value === "number" ? field.state.value : 0}
          onChange={(value) => field.handleChange(value)}
        />
      ),
    },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: DEPARTMENTS },
  }),
]);

const rowValidators = {
  onSubmit: z
    .object({
      firstName: z.string().min(2, "At least two characters"),
      salary: z.number().positive(),
      department: z.string(),
    })
    .refine(
      (row) => !(row.department === "Support" && row.salary > 60_000),
      { message: "Support salaries cap at 60 000 kr" },
    ),
};

/** Grid C — batch: drafts, adds and deletes all land in one submit. */
const batchColumns = columnHelper.columns([
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
    meta: { validate: z.string().min(2, "At least two characters") },
  }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: DEPARTMENTS },
  }),
]);

const newEmployee = (): Employee => ({
  id: 0,
  firstName: "",
  lastName: "",
  salary: 32_000,
  active: true,
  hired: "2026-01-01",
  department: "Engineering",
  skills: [],
});

export function EditableGridExample() {
  const [employees, setEmployees] = useState(() => makeEmployees(200));
  const [teamRows, setTeamRows] = useState(() => makeEmployees(30, 1000));
  const [mode, setMode] = useState<TMDataGridEditMode>("cell");
  const [lastCommit, setLastCommit] = useState<string | null>(null);

  const onEditCommit = useCallback(
    ({
      rowId,
      value,
      changes,
    }: {
      rowId: string;
      value: Employee;
      changes: ReadonlyArray<{ field: string }>;
    }) => {
      setEmployees((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      );
      setLastCommit(
        `#${rowId}: ${changes.map((change) => change.field).join(", ")}`,
      );
    },
    [],
  );

  const inlineGrid = useTMDataGrid({
    data: employees,
    columns: inlineColumns,
    getRowId: (row) => String(row.id),
    editMode: mode,
    onEditCommit,
    selectionMode: "highlight",
  });

  const onRowCommit = useCallback(
    ({ rowId, value }: { rowId: string; value: Employee }) => {
      setTeamRows((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      );
    },
    [],
  );

  const rowGrid = useTMDataGrid({
    data: teamRows,
    columns: rowColumns,
    getRowId: (row) => String(row.id),
    editMode: "row",
    rowValidators,
    onEditCommit: onRowCommit,
    selectionMode: "highlight",
    enableGrouping: false,
  });

  const [batchRows, setBatchRows] = useState(() => makeEmployees(25, 2000));

  // Everything pending — edits, adds, deletions — lands here in one call.
  const onBatchCommit = useCallback(
    ({ rows, added, deleted }: TMDataGridEditCommitBatchArgs<Employee>) => {
      setBatchRows((previous) => {
        const edited = previous.map(
          (employee) =>
            rows.find((row) => row.rowId === String(employee.id))?.value ??
            employee,
        );
        const kept = edited.filter(
          (employee) => !deleted.includes(String(employee.id)),
        );
        const maxId = Math.max(2999, ...kept.map((employee) => employee.id));
        return [
          ...kept,
          ...added.map((add, index) => ({ ...add.value, id: maxId + index + 1 })),
        ];
      });
    },
    [],
  );

  const batchGrid = useTMDataGrid({
    data: batchRows,
    columns: batchColumns,
    getRowId: (row) => String(row.id),
    editMode: "batch",
    onEditCommitBatch: onBatchCommit,
    newRowDefaults: newEmployee,
    selectionMode: "highlight",
    enableGrouping: false,
  });

  return (
    <Flex direction="column" gap="md" p={{ base: "sm", md: "lg" }} h="100%">
      <Group gap="sm">
        <Text fw={600} size="lg">
          Inline editing{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — double-click a cell, or press Enter / F2 / type on it
          </Text>
        </Text>
        <SegmentedControl
          size="xs"
          data={[
            { value: "cell", label: "cell" },
            { value: "cellConfirm", label: "cellConfirm" },
          ]}
          value={mode}
          onChange={(next) => setMode(next as TMDataGridEditMode)}
        />
        {lastCommit !== null && (
          <Text size="sm" c="dimmed">
            Last save — <Code>{lastCommit}</Code>
          </Text>
        )}
      </Group>

      <TMDataGrid {...inlineGrid} size="md" style={{ flex: 3, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.Search />
          <TMDataGrid.FilterButton />
          <TMDataGrid.ColumnsButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>

      <Text fw={600} size="lg" mt="xs">
        Row editing{" "}
        <Text component="span" size="sm" c="dimmed" fw={400}>
          — the pencil opens the row, ✓ saves it as one commit; try a Support
          salary over 60 000 kr
        </Text>
      </Text>

      <TMDataGrid {...rowGrid} size="md" style={{ flex: 2, minHeight: 0 }}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>

      <Text fw={600} size="lg" mt="xs">
        Batch editing{" "}
        <Text component="span" size="sm" c="dimmed" fw={400}>
          — nothing commits until Save: edit cells, add rows in the entry
          block, mark deletions with the trash; one call carries the lot
        </Text>
      </Text>

      <TMDataGrid {...batchGrid} size="md" style={{ flex: 2, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <Button
            variant="light"
            size="compact-sm"
            onClick={() => batchGrid.edit.addRow()}
          >
            Add row
          </Button>
          <TMDataGrid.EditActions />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </Flex>
  );
}

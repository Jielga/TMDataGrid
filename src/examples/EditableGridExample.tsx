import { Badge, Code, Flex, Group, Text } from "@mantine/core";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
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

function makeEmployees(count: number): Array<Employee> {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
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

const columns = columnHelper.columns([
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
 * Inline cell editing over every built-in editor: double-click a cell, or
 * put the cursor on it and press Enter, F2 or just start typing. Enter and
 * Tab commit, Escape cancels; the grid never mutates `data` — the commit
 * callback applies the change and the new rows flow back in.
 */
export function EditableGridExample() {
  const [employees, setEmployees] = useState(() => makeEmployees(200));
  const [lastCommit, setLastCommit] = useState<string | null>(null);

  const onEditCommit = useCallback(
    ({ rowId, value, changes }: { rowId: string; value: Employee; changes: ReadonlyArray<{ field: string }> }) => {
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

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editMode: "cell",
    onEditCommit,
    selectionMode: "highlight",
  });

  return (
    <Flex direction="column" gap="md" p={{ base: "sm", md: "lg" }} h="100%">
      <Group gap="sm">
        <Text fw={600} size="lg">
          Editable grid{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — double-click a cell, or press Enter / F2 / type on it. Enter and
            Tab save, Escape cancels.
          </Text>
        </Text>
      </Group>

      <TMDataGrid {...grid} size="md" style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          {lastCommit !== null && (
            <Text size="sm" c="dimmed">
              Last save — <Code>{lastCommit}</Code>
            </Text>
          )}
          <TMDataGrid.Spacer />
          <TMDataGrid.Search />
          <TMDataGrid.FilterButton />
          <TMDataGrid.ColumnsButton />
        </TMDataGrid.Toolbar>

        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </Flex>
  );
}

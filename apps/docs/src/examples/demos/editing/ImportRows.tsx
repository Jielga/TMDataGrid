import { Button, Text, Textarea } from "@mantine/core";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridSaveDraftsArgs,
} from "@jielga/tmdatagrid";
import {
  DEPARTMENTS,
  makeEmployees,
  sek,
  type Employee,
} from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
    meta: { edit: { validate: z.string().min(2, "At least two characters") } },
  }),
  columnHelper.accessor("lastName", {
    header: "Last name",
    minSize: 120,
    meta: { edit: { validate: z.string().min(2, "At least two characters") } },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: {
      type: "number",
      align: "right",
      edit: { validate: z.number().min(20_000, "At least 20 000 kr") },
    },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 150,
    meta: { type: "select", options: DEPARTMENTS },
  }),
]);

const PASTED = `Ada,Lindqvist,48000,Engineering
B,Nordin,52000,Engineering
Selma,Ohlsson,19000,Sales
Nils,Ekstrom,41000,Sales`;

const newEmployee = (): Employee => ({
  id: 0,
  firstName: "",
  lastName: "",
  email: "",
  department: "Engineering",
  location: "Stockholm",
  salary: 32_000,
  age: 30,
  hired: "2026-01-01",
  active: true,
  status: "Active",
  skills: [],
});

/** One pasted line into the fields the columns edit. */
function parseLine(line: string): Partial<Employee> {
  const [firstName = "", lastName = "", salary = "", department = ""] = line
    .split(",")
    .map((part) => part.trim());
  return {
    firstName,
    lastName,
    salary: Number(salary),
    department: department as Employee["department"],
  };
}

export function ImportRows() {
  const [employees, setEmployees] = useState(() => makeEmployees(8, 4000));
  const [raw, setRaw] = useState(PASTED);
  const [report, setReport] = useState<string | null>(null);

  const onSaveDrafts = useCallback(
    ({ created }: TMDataGridSaveDraftsArgs<Employee>) => {
      setEmployees((previous) => {
        const maxId = Math.max(4999, ...previous.map((row) => row.id));
        return [
          ...previous,
          ...created.map((add, index) => ({
            ...add.value,
            id: maxId + index + 1,
          })),
        ];
      });
      setReport(null);
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      mode: "row",
      draft: true,
      onSaveDrafts,
      newRowDefaults: newEmployee,
    },
    selectionMode: "highlight",
    enableGrouping: false,
  });

  const importRows = async () => {
    const lines = raw.split("\n").filter((line) => line.trim() !== "");
    // Committed rows are ready to save; the rest stay open in the entry
    // block, each carrying the error that stopped it.
    const { committed, open } = await grid.edit.addRows(
      lines.map(parseLine),
      { commit: true },
    );
    setReport(
      open.length === 0
        ? `${committed.length} rows ready`
        : `${committed.length} ready, ${open.length} need fixing`,
    );
  };

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <Textarea
          size="xs"
          rows={2}
          style={{ flex: 1 }}
          value={raw}
          onChange={(event) => setRaw(event.currentTarget.value)}
        />
        <Button size="compact-xs" variant="light" onClick={() => void importRows()}>
          Import
        </Button>
        {report !== null && (
          <Text size="xs" c="dimmed">
            {report}
          </Text>
        )}
        <TMDataGrid.Spacer />
        <TMDataGrid.DraftActions />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}

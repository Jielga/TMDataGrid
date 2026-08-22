import { Button } from "@mantine/core";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitBatchArgs,
} from "../../../tmdatagrid";
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
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 150,
    meta: { type: "select", options: DEPARTMENTS },
  }),
]);

/** The shape a new row starts as, before anyone types into it. */
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

export function BatchEditing() {
  const [employees, setEmployees] = useState(() => makeEmployees(20, 2000));

  // Everything pending (edits, additions, deletions) arrives here at once, so
  // the server can apply it as a single transaction.
  const onCommitBatch = useCallback(
    ({ rows, added, deleted }: TMDataGridEditCommitBatchArgs<Employee>) => {
      setEmployees((previous) => {
        const edited = previous.map(
          (employee) =>
            rows.find((row) => row.rowId === String(employee.id))?.value ??
            employee,
        );
        const kept = edited.filter(
          (employee) => !deleted.includes(String(employee.id)),
        );
        // The engine mints a temporary id; the real one is the app's to
        // assign, which here means "one past the highest".
        const maxId = Math.max(2999, ...kept.map((employee) => employee.id));
        return [
          ...kept,
          ...added.map((add, index) => ({
            ...add.value,
            id: maxId + index + 1,
          })),
        ];
      });
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      mode: "batch",
      onCommitBatch,
      newRowDefaults: newEmployee,
    },
    selectionMode: "highlight",
    enableGrouping: false,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => grid.edit.addRow()}
        >
          Add row
        </Button>
        {/* Save and Discard for the whole batch, disabled while nothing is
            pending and while anything is invalid. */}
        <TMDataGrid.EditActions />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}

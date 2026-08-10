import { Button } from "@mantine/core";
import { exportGridToCsv, TMDataGrid, useTMDataGrid } from "../../../tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function CopyAndExport() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    cellSelection: "range",
    selectionMode: "highlight",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        {/* No built-in export button on purpose: what the file is called,
            which rows it covers and when it is offered are the app's call.
            The helper is the part worth sharing. */}
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() =>
            exportGridToCsv({
              table: grid.table,
              options: { fileName: "employees" },
            })
          }
        >
          Export CSV
        </Button>
        <TMDataGrid.FilterButton />
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee>
        // How Ctrl+C writes values. These *are* the defaults — the Nordic
        // Excel conventions — spelled out here to show what is adjustable.
        cellExport={{ separator: ";", decimalComma: true }}
      />
    </TMDataGrid>
  );
}

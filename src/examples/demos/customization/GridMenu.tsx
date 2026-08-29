import { Menu } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { exportGridToCsv, TMDataGrid, useTMDataGrid } from "../../../tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * The burger is a Mantine Menu the app fills: its own items first, the column
 * chooser as built-in items after them.
 */
export function GridMenu() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <Menu.Item
            leftSection={<IconDownload size={16} stroke={1.6} />}
            onClick={() =>
              exportGridToCsv({
                table: grid.table,
                options: { fileName: "employees" },
              })
            }
          >
            Export CSV
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Columns</Menu.Label>
          {/* Search, one checkbox item per column, show/hide all, and Reset
              layout - the same chooser as the header menu's "Manage columns". */}
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}

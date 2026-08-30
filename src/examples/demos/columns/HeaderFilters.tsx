import { TMDataGrid, useTMDataGrid } from "../../../tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * `filters.inHeader` adds a second header row of value controls, one per
 * filterable column. Each control is the one the column would get in the
 * panel - a multi-select on Department, a number input on Salary - and the
 * funnel button beside it changes that column's operator.
 *
 * The column menu loses its "Filter" item here, and a filtered header loses
 * its funnel indicator: both only existed to reveal a control that is now
 * always on screen.
 */
export function HeaderFilters() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    filters: { inHeader: true, surface: "manual" },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}

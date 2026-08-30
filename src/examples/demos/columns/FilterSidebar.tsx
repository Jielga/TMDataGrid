import { TMDataGrid, useTMDataGrid } from "../../../tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * `filters.surface: "sidebar"` puts the panel beside the rows instead of over
 * them. It is a column of the grid frame, so the rows give up the width rather
 * than being covered, and nothing about clicking in the table dismisses it -
 * which is what a screen where filtering is the work needs.
 *
 * `defaultOpen` decides whether it starts out showing; the toolbar's filter
 * button toggles it either way.
 */
export function FilterSidebar() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    filters: { surface: "sidebar", sidebarSide: "right", defaultOpen: true },
    initialState: {
      columnFilters: [
        { id: "department", value: { operator: "isAnyOf", value: ["Sales"] } },
      ],
    },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}

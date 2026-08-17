import { Pagination as MantinePagination, Switch } from "@mantine/core";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "../../../tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function Pagination() {
  const [customPager, setCustomPager] = useState(false);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    // Opt-in. By default every row renders, virtualized - which for most
    // grids is both faster and easier to use than paging.
    enablePagination: true,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });

  return (
    <>
      <Switch
        size="xs"
        mb="xs"
        label="Custom pager"
        checked={customPager}
        onChange={(event) => setCustomPager(event.currentTarget.checked)}
      />

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>

        <TMDataGrid.Table<Employee> />

        {customPager ? (
          // The render prop replaces the built-in pager with anything built on
          // the distilled pagination API - page count, index, and the setters.
          <TMDataGrid.Footer
            pagination={(api) => (
              <MantinePagination
                size="sm"
                total={api.pageCount}
                value={api.pageIndex + 1}
                onChange={(page) => api.setPageIndex(page - 1)}
              />
            )}
          />
        ) : (
          <TMDataGrid.Footer pageSizeOptions={[10, 25, 50, 100]} />
        )}
      </TMDataGrid>
    </>
  );
}

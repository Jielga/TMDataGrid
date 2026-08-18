import { Menu } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "../../../tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function PinningAndNumbers() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    // Sticky blocks at the top and bottom edges; the body scrolls beneath.
    enableRowPinning: true,
    // A gutter outermost left. It numbers the *view*: sort or filter and the
    // numbers stay 1..n, because they answer "which row on screen", not
    // "which record". Group rows go unnumbered.
    enableRowNumbers: true,
    selectionMode: "highlight",
    initialState: { rowPinning: { top: ["2"], bottom: ["8"] } },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee>
        renderRowContextMenu={({ row }) => (
          <>
            <Menu.Label>
              {row.original.firstName} {row.original.lastName}
            </Menu.Label>
            {row.getIsPinned() !== "top" && (
              <Menu.Item onClick={() => row.pin("top")}>Pin to top</Menu.Item>
            )}
            {row.getIsPinned() !== "bottom" && (
              <Menu.Item onClick={() => row.pin("bottom")}>
                Pin to bottom
              </Menu.Item>
            )}
            {row.getIsPinned() !== false && (
              <Menu.Item onClick={() => row.pin(false)}>Unpin</Menu.Item>
            )}
          </>
        )}
      />
    </TMDataGrid>
  );
}

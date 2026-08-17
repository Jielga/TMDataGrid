import { Code, Group, SegmentedControl } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridCellSelectionMode,
} from "../../../tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const MODES = [
  { value: "none", label: "none" },
  // One cell at a time - a cursor, not a selection.
  { value: "single", label: "single" },
  // Drag, or Shift+arrows, to take a block.
  { value: "range", label: "range" },
] as const satisfies ReadonlyArray<{
  value: TMDataGridCellSelectionMode;
  label: string;
}>;

export function CellSelection() {
  const [mode, setMode] = useState<TMDataGridCellSelectionMode>("range");

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    cellSelection: mode,
    selectionMode: "highlight",
  });

  // The cursor and the range are chrome state, not table state, so they live
  // on the ui store beside the panels rather than in TanStack's state tree.
  const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);

  return (
    <>
      <Group gap="md" mb="xs">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) =>
            setMode(value as TMDataGridCellSelectionMode)
          }
          data={MODES as unknown as Array<{ value: string; label: string }>}
        />
        <Code>
          {focusedCell
            ? `${focusedCell.rowId} · ${focusedCell.columnId}`
            : "no cell"}
        </Code>
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </>
  );
}

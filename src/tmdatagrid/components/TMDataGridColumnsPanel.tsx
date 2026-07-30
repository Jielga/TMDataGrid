import { Button, Checkbox, ScrollArea, Text, TextInput } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import classes from "./TMDataGridColumnsPanel.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getColumnLabel } from "../core/columnUtils";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import { SearchIcon } from "./icons";

/**
 * The "Manage columns" surface. Reachable from every column header menu and
 * from the grid's burger menu, so it lives on its own and is rendered by
 * `TMDataGrid.ColumnsButton`.
 */
export function TMDataGridColumnsPanel() {
  const { table, controlSize } = useTMDataGridContext();
  const [search, setSearch] = useState("");

  const columnVisibility = useSelector(
    table.store,
    (state) => state.columnVisibility,
  );

  // The tree column is left out rather than listed and disabled: its visibility
  // is not a setting at all, it follows the grouping state, so an unchecked box
  // that cannot be ticked would only invite the question.
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.id !== GROUP_COLUMN_ID);
  const needle = search.trim().toLowerCase();
  const visibleInPanel = needle
    ? columns.filter((column) =>
        getColumnLabel(column).toLowerCase().includes(needle),
      )
    : columns;

  const hideableColumns = columns.filter((column) => column.getCanHide());
  const shownCount = hideableColumns.filter(
    (column) => columnVisibility[column.id] !== false,
  ).length;

  return (
    <div className={classes.columnsPanel}>
      <div className={classes.columnsPanelSearch}>
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search"
          leftSection={<SearchIcon size={16} stroke={1.6} />}
          size={controlSize}
          data-autofocus
        />
      </div>

      <ScrollArea.Autosize mah={260} type="auto">
        <div className={classes.columnsPanelList}>
          {visibleInPanel.map((column) => (
            <Checkbox
              key={column.id}
              size={controlSize}
              label={getColumnLabel(column)}
              disabled={!column.getCanHide()}
              checked={columnVisibility[column.id] !== false}
              onChange={(event) =>
                column.toggleVisibility(event.currentTarget.checked)
              }
            />
          ))}
          {visibleInPanel.length === 0 && (
            <Text size={controlSize} c="dimmed">
              No columns match “{search}”
            </Text>
          )}
        </div>
      </ScrollArea.Autosize>

      <div className={classes.columnsPanelFooter}>
        <Checkbox
          size={controlSize}
          label="Show/Hide All"
          checked={shownCount === hideableColumns.length}
          indeterminate={shownCount > 0 && shownCount < hideableColumns.length}
          onChange={(event) =>
            table.toggleAllColumnsVisible(event.currentTarget.checked)
          }
        />
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={() => table.resetColumnVisibility()}
        >
          RESET
        </Button>
      </div>
    </div>
  );
}

import {
  Button,
  Checkbox,
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import classes from "./TMDataGridColumnsPanel.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getColumnLabel } from "../core/columnUtils";
import { SearchIcon } from "./icons";

/**
 * The "Manage columns" surface. Reachable from every column header menu and
 * from the grid's burger menu, so it lives on its own and is rendered by
 * `TMDataGrid.ColumnsButton`.
 */
export function TMDataGridColumnsPanel() {
  const { table, labels, controlSize, resetSettings } = useTMDataGridContext();
  const [search, setSearch] = useState("");

  const columnVisibility = useSelector(
    table.store,
    (state) => state.columnVisibility,
  );

  // Only what can actually be hidden. A column with `enableHiding: false` is
  // left out rather than listed and disabled: a box that cannot be ticked only
  // invites the question, and every generated lane is one - the checkbox and
  // edit lanes hold the controls the grid needs, the tree column follows the
  // grouping state, the row-number gutter follows `enableRowNumbers`. None of
  // them is a setting.
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());
  const needle = search.trim().toLowerCase();
  const visibleInPanel = needle
    ? columns.filter((column) =>
        getColumnLabel(column).toLowerCase().includes(needle),
      )
    : columns;

  const shownCount = columns.filter(
    (column) => columnVisibility[column.id] !== false,
  ).length;

  /**
   * Show or hide every listed column.
   *
   * Not `table.toggleAllColumnsVisible`, which writes a visibility entry for
   * *every* leaf column: showing all would publish the tree column - hidden
   * because nothing is grouped, not because the user hid it - and hiding all
   * would force the same column visible, since it writes `!getCanHide()` for
   * the columns it will not touch. Either way a lane the panel never listed
   * changes state, and persistence then keeps it that way.
   */
  const setAllVisible = (visible: boolean) => {
    table.setColumnVisibility((previous) => {
      const next = { ...previous };
      for (const column of columns) next[column.id] = visible;
      return next;
    });
  };

  return (
    <div data-dg-part="columns-panel" className={classes.columnsPanel}>
      <div className={classes.columnsPanelSearch}>
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={labels.columnsSearchPlaceholder}
          leftSection={<SearchIcon size={16} stroke={1.6} />}
          size={controlSize}
          data-dg-part="columns-search"
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
              data-dg-part="columns-toggle"
              data-column-id={column.id}
              checked={columnVisibility[column.id] !== false}
              onChange={(event) =>
                column.toggleVisibility(event.currentTarget.checked)
              }
            />
          ))}
          {visibleInPanel.length === 0 && (
            <Text span size={controlSize} c="dimmed">
              {labels.columnsNoMatch(search)}
            </Text>
          )}
        </div>
      </ScrollArea.Autosize>

      <div className={classes.columnsPanelFooter}>
        <Checkbox
          size={controlSize}
          label={labels.columnsShowHideAll}
          data-dg-part="columns-toggle-all"
          checked={shownCount === columns.length}
          indeterminate={shownCount > 0 && shownCount < columns.length}
          onChange={(event) => setAllVisible(event.currentTarget.checked)}
        />
        {/* The whole layout, not only visibility: one reset with an honest
            scope, stated in the tooltip. `table.resetColumnVisibility()` would
            also be wrong under persistence - it resets to `initialState`,
            which the mount built *from* the persisted payload. */}
        <Tooltip label={labels.columnsResetHint} withArrow>
          <Button
            variant="subtle"
            size="compact-sm"
            data-dg-part="columns-reset"
            onClick={() => resetSettings()}
          >
            {labels.columnsReset}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

import { ActionIcon, Button, Select, Stack, TextInput } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import classes from "./TMDataGrid.module.css";
import { useTMDataGridContext } from "./TMDataGridContext";
import { getColumnLabel, getColumnType } from "./columnUtils";
import {
  type TMDataGridFilterOperator,
  type TMDataGridFilterValue,
  FILTER_OPERATOR_LABELS,
  getDefaultOperator,
  getOperatorsForType,
  isTMDataGridFilterValue,
  operatorNeedsValue,
} from "./filterOperators";
import { CloseIcon } from "./icons";

const FALLBACK_FILTER: TMDataGridFilterValue = { operator: "contains", value: "" };

function asFilterValue(value: unknown): TMDataGridFilterValue {
  return isTMDataGridFilterValue(value) ? value : FALLBACK_FILTER;
}

/**
 * The MUI-style filter surface: one row per active column filter, each row a
 * column / operator / value triple. It only ever reads and writes the table's
 * `columnFilters` state, so a `manualFiltering` grid gets the same panel for
 * free — the state is forwarded to the server instead of a row model.
 */
export function TMDataGridFilterPanel() {
  const { table, ui, controlSize } = useTMDataGridContext();
  const opened = useSelector(ui, (state) => state.filterPanelOpen);
  const columnFilters = useSelector(
    table.store,
    (state) => state.columnFilters,
  );

  if (!opened) return null;

  const filterableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanFilter());

  const columnOptions = filterableColumns.map((column) => ({
    value: column.id,
    label: getColumnLabel(column),
  }));

  function removeFilter(columnId: string) {
    const remaining = columnFilters.filter((filter) => filter.id !== columnId);
    table.setColumnFilters(remaining);
    if (remaining.length === 0) ui.actions.closeFilterPanel();
  }

  function changeFilterColumn(fromColumnId: string, toColumnId: string) {
    const current = asFilterValue(
      columnFilters.find((filter) => filter.id === fromColumnId)?.value,
    );
    const target = table.getColumn(toColumnId);
    table.setColumnFilters(
      columnFilters
        .filter((filter) => filter.id !== toColumnId)
        .map((filter) =>
          filter.id === fromColumnId
            ? {
                id: toColumnId,
                value: {
                  operator: getDefaultOperator(
                    target ? getColumnType(target) : "string",
                  ),
                  value: current.value,
                } satisfies TMDataGridFilterValue,
              }
            : filter,
        ),
    );
    ui.actions.openFilterPanel(toColumnId);
  }

  function patchFilter(columnId: string, patch: Partial<TMDataGridFilterValue>) {
    table.setColumnFilters(
      columnFilters.map((filter) =>
        filter.id === columnId
          ? { ...filter, value: { ...asFilterValue(filter.value), ...patch } }
          : filter,
      ),
    );
  }

  function addFilter() {
    const nextColumn = filterableColumns.find(
      (column) => !columnFilters.some((filter) => filter.id === column.id),
    );
    if (!nextColumn) return;
    table.setColumnFilters([
      ...columnFilters,
      {
        id: nextColumn.id,
        value: {
          operator: getDefaultOperator(getColumnType(nextColumn)),
          value: "",
        } satisfies TMDataGridFilterValue,
      },
    ]);
  }

  return (
    <div className={classes.filterPanel}>
      <Stack gap="xs">
        {columnFilters.map((filter) => {
          const column = table.getColumn(filter.id);
          const value = asFilterValue(filter.value);
          const type = column ? getColumnType(column) : "string";
          const needsValue = operatorNeedsValue(value.operator);

          return (
            <div key={filter.id} className={classes.filterRow}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label="Remove filter"
                onClick={() => removeFilter(filter.id)}
              >
                <CloseIcon size={18} stroke={1.6} />
              </ActionIcon>

              <Select
                label="Column"
                size={controlSize}
                w={160}
                allowDeselect={false}
                data={columnOptions}
                value={filter.id}
                onChange={(next) => next && changeFilterColumn(filter.id, next)}
              />

              <Select
                label="Operator"
                size={controlSize}
                w={170}
                allowDeselect={false}
                data={getOperatorsForType(type).map((operator) => ({
                  value: operator,
                  label: FILTER_OPERATOR_LABELS[operator],
                }))}
                value={value.operator}
                onChange={(next) =>
                  next &&
                  patchFilter(filter.id, {
                    operator: next as TMDataGridFilterOperator,
                  })
                }
              />

              <TextInput
                label="Value"
                size={controlSize}
                w={180}
                type={type === "number" && needsValue ? "number" : "text"}
                disabled={!needsValue}
                placeholder={needsValue ? "Filter value" : ""}
                value={needsValue ? value.value : ""}
                onChange={(event) =>
                  patchFilter(filter.id, { value: event.currentTarget.value })
                }
              />
            </div>
          );
        })}

        <Button
          variant="subtle"
          size="compact-sm"
          style={{ alignSelf: "flex-start" }}
          onClick={addFilter}
        >
          Add filter
        </Button>
      </Stack>
    </div>
  );
}

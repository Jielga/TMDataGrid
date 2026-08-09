import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import classes from "./TMDataGridFilterPanel.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import {
  optionsToComboboxData,
  resolveColumnOptions,
} from "../core/columnOptions";
import {
  getColumnDefaultOperator,
  getColumnLabel,
  getColumnType,
} from "../core/columnUtils";
import {
  type TMDataGridFilterOperator,
  type TMDataGridFilterValue,
  emptyValueForOperator,
  getDefaultOperator,
  getOperatorsForType,
  isTMDataGridFilterValue,
  operatorNeedsValue,
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "../core/filterOperators";
import { CloseIcon } from "./icons";

const FALLBACK_FILTER: TMDataGridFilterValue = { operator: "contains", value: "" };

function asFilterValue(value: unknown): TMDataGridFilterValue {
  return isTMDataGridFilterValue(value) ? value : FALLBACK_FILTER;
}

/**
 * The three value shapes an operator can take. A typed value survives an
 * operator or column change only within its shape — a set is not a range,
 * even though both are arrays.
 */
function valueShape(
  operator: TMDataGridFilterOperator,
): "scalar" | "set" | "range" {
  if (operatorTakesArrayValue(operator)) return "set";
  if (operatorTakesRangeValue(operator)) return "range";
  return "scalar";
}

/**
 * The MUI-style filter surface: one row per active column filter, each row a
 * column / operator / value triple. It only ever reads and writes the table's
 * `columnFilters` state, so a `manualFiltering` grid gets the same panel for
 * free — the state is forwarded to the server instead of a row model.
 */
export function TMDataGridFilterPanel() {
  const { table, ui, labels, controlSize } = useTMDataGridContext();
  const opened = useSelector(ui, (state) => state.filterPanelOpen);
  const columnFilters = useSelector(
    table.store,
    (state) => state.columnFilters,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Clicking away hides the panel, the way any floating surface behaves. On
  // pointerdown rather than click, so a press that starts outside dismisses it
  // even when the pointer is released somewhere else.
  useEffect(() => {
    if (!opened) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      // The toolbar button toggles the panel itself. Closing from here first
      // would leave its click reopening what the user meant to close.
      if (target.closest("[data-dg-filter-toggle]")) return;
      ui.actions.closeFilterPanel();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [opened, ui]);

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
    const operator = target
      ? getColumnDefaultOperator(target)
      : getDefaultOperator("string");
    // The typed value only survives the move while it still fits the new
    // operator — a text needle has no meaning to an `isAnyOf` set, or a set
    // to a text input.
    const value =
      valueShape(operator) === valueShape(current.operator)
        ? current.value
        : emptyValueForOperator(operator);
    table.setColumnFilters(
      columnFilters
        .filter((filter) => filter.id !== toColumnId)
        .map((filter) =>
          filter.id === fromColumnId
            ? {
                id: toColumnId,
                value: { operator, value } satisfies TMDataGridFilterValue,
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

  function changeOperator(columnId: string, operator: TMDataGridFilterOperator) {
    const current = asFilterValue(
      columnFilters.find((filter) => filter.id === columnId)?.value,
    );
    // Same arity rule as changing the column: keep the value across operators
    // of the same shape, reset it across any shape boundary.
    const value =
      valueShape(operator) === valueShape(current.operator)
        ? current.value
        : emptyValueForOperator(operator);
    patchFilter(columnId, { operator, value });
  }

  /** Clears every filter, including half-typed ones the pills never showed. */
  function clearAllFilters() {
    table.setColumnFilters([]);
    // Same exit as removing the last filter row by hand: an empty panel has
    // nothing to show but its own buttons.
    ui.actions.closeFilterPanel();
  }

  function addFilter() {
    const nextColumn = filterableColumns.find(
      (column) => !columnFilters.some((filter) => filter.id === column.id),
    );
    if (!nextColumn) return;
    const operator = getColumnDefaultOperator(nextColumn);
    table.setColumnFilters([
      ...columnFilters,
      {
        id: nextColumn.id,
        value: {
          operator,
          value: emptyValueForOperator(operator),
        } satisfies TMDataGridFilterValue,
      },
    ]);
  }

  const canAddFilter = filterableColumns.some(
    (column) => !columnFilters.some((filter) => filter.id === column.id),
  );

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label={labels.filters}
      className={classes.filterPanel}
      // Escape is what closes a floating surface, and every control that can
      // hold focus in here sits inside this element.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        ui.actions.closeFilterPanel();
      }}
    >
      <div className={classes.filterPanelHeader}>
        <Text size={controlSize} fw={600}>
          {labels.filters}
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={labels.closeFilters}
          onClick={ui.actions.closeFilterPanel}
        >
          <CloseIcon size={16} stroke={1.6} />
        </ActionIcon>
      </div>

      <Stack gap="xs">
        {columnFilters.map((filter) => {
          const column = table.getColumn(filter.id);
          const value = asFilterValue(filter.value);
          const type = column ? getColumnType(column) : "string";
          const needsValue = operatorNeedsValue(value.operator);
          const takesArray = operatorTakesArrayValue(value.operator);
          const takesRange = operatorTakesRangeValue(value.operator);
          const scalarValue = typeof value.value === "string" ? value.value : "";
          const rangeValue: [string, string] = Array.isArray(value.value)
            ? [String(value.value[0] ?? ""), String(value.value[1] ?? "")]
            : ["", ""];
          const inputType =
            type === "number" ? "number" : type === "date" ? "date" : "text";

          return (
            <div key={filter.id} className={classes.filterRow}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label={labels.removeFilter}
                onClick={() => removeFilter(filter.id)}
              >
                <CloseIcon size={18} stroke={1.6} />
              </ActionIcon>

              <Select
                label={labels.filterColumn}
                size={controlSize}
                w={160}
                allowDeselect={false}
                // Both dropdowns render inside the panel: a portalled one is
                // outside it in the DOM, and picking an option would read as a
                // click away and close the panel under the user.
                comboboxProps={{ withinPortal: false }}
                data={columnOptions}
                value={filter.id}
                onChange={(next) => next && changeFilterColumn(filter.id, next)}
              />

              <Select
                label={labels.filterOperator}
                size={controlSize}
                w={170}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
                data={getOperatorsForType(type).map((operator) => ({
                  value: operator,
                  label: labels.operators[operator],
                }))}
                value={value.operator}
                onChange={(next) =>
                  next &&
                  changeOperator(filter.id, next as TMDataGridFilterOperator)
                }
              />

              {takesRange ? (
                // The interval's two ends. Either may stay empty — an open
                // end — and each writes its slot of the `[min, max]` pair.
                <Group gap={4} wrap="nowrap" align="flex-start">
                  <TextInput
                    label={labels.filterFrom}
                    size={controlSize}
                    w={88}
                    type={inputType}
                    value={rangeValue[0]}
                    onChange={(event) =>
                      patchFilter(filter.id, {
                        value: [event.currentTarget.value, rangeValue[1]],
                      })
                    }
                  />
                  <TextInput
                    label={labels.filterTo}
                    size={controlSize}
                    w={88}
                    type={inputType}
                    value={rangeValue[1]}
                    onChange={(event) =>
                      patchFilter(filter.id, {
                        value: [rangeValue[0], event.currentTarget.value],
                      })
                    }
                  />
                </Group>
              ) : takesArray && column ? (
                // The set the cell is tested against. Options come from
                // `meta.options`; a select column that declares none still
                // gets the values present in the data, via the faceted index.
                <MultiSelect
                  label={labels.filterValue}
                  size={controlSize}
                  w={180}
                  comboboxProps={{ withinPortal: false }}
                  searchable
                  data={optionsToComboboxData(
                    resolveColumnOptions({ table, column, fallback: "faceted" }),
                  )}
                  value={Array.isArray(value.value) ? [...value.value] : []}
                  onChange={(next) => patchFilter(filter.id, { value: next })}
                />
              ) : type === "boolean" ? (
                <Select
                  label={labels.filterValue}
                  size={controlSize}
                  w={180}
                  comboboxProps={{ withinPortal: false }}
                  disabled={!needsValue}
                  clearable
                  placeholder={needsValue ? labels.filterValuePlaceholder : ""}
                  data={[
                    { value: "true", label: labels.booleanTrue },
                    { value: "false", label: labels.booleanFalse },
                  ]}
                  value={needsValue && scalarValue !== "" ? scalarValue : null}
                  onChange={(next) =>
                    patchFilter(filter.id, { value: next ?? "" })
                  }
                />
              ) : (
                <TextInput
                  label={labels.filterValue}
                  size={controlSize}
                  w={180}
                  type={needsValue ? inputType : "text"}
                  disabled={!needsValue}
                  placeholder={needsValue ? labels.filterValuePlaceholder : ""}
                  value={needsValue ? scalarValue : ""}
                  onChange={(event) =>
                    patchFilter(filter.id, { value: event.currentTarget.value })
                  }
                />
              )}
            </div>
          );
        })}

        <div className={classes.filterPanelFooter}>
          <Button
            variant="subtle"
            size="compact-sm"
            disabled={!canAddFilter}
            onClick={addFilter}
          >
            {labels.addFilter}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            disabled={columnFilters.length === 0}
            onClick={clearAllFilters}
          >
            {labels.clearAllFilters}
          </Button>
        </div>
      </Stack>
    </div>
  );
}

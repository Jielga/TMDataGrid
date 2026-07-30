import { ActionIcon, Button, Select, Stack, Text, TextInput } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import classes from "./TMDataGridFilterPanel.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getColumnLabel, getColumnType } from "../core/columnUtils";
import {
  type TMDataGridFilterOperator,
  type TMDataGridFilterValue,
  FILTER_OPERATOR_LABELS,
  getDefaultOperator,
  getOperatorsForType,
  isTMDataGridFilterValue,
  operatorNeedsValue,
} from "../core/filterOperators";
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

  const canAddFilter = filterableColumns.some(
    (column) => !columnFilters.some((filter) => filter.id === column.id),
  );

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label="Filters"
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
          Filters
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Close filters"
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
                // Both dropdowns render inside the panel: a portalled one is
                // outside it in the DOM, and picking an option would read as a
                // click away and close the panel under the user.
                comboboxProps={{ withinPortal: false }}
                data={columnOptions}
                value={filter.id}
                onChange={(next) => next && changeFilterColumn(filter.id, next)}
              />

              <Select
                label="Operator"
                size={controlSize}
                w={170}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
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

        <div className={classes.filterPanelFooter}>
          <Button
            variant="subtle"
            size="compact-sm"
            disabled={!canAddFilter}
            onClick={addFilter}
          >
            Add filter
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            disabled={columnFilters.length === 0}
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        </div>
      </Stack>
    </div>
  );
}

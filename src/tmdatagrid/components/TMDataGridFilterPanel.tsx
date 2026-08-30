import { ActionIcon, Button, Select, Stack, TextInput } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import classes from "./TMDataGridFilterPanel.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { resolveColumnOptions } from "../core/columnOptions";
import {
  getColumnDefaultOperator,
  getColumnFilterControl,
  getColumnLabel,
  getColumnType,
} from "../core/columnUtils";
import {
  type TMDataGridFilterOperator,
  type TMDataGridFilterValue,
  emptyValueForOperator,
  filterValueShape,
  getDefaultOperator,
  getOperatorsForType,
  isTMDataGridFilterValue,
  operatorNeedsValue,
} from "../core/filterOperators";
import { CloseIcon } from "./icons";
import { TMDataGridFilterValueInput } from "./filters/TMDataGridFilterValueInput";

const FALLBACK_FILTER: TMDataGridFilterValue = { operator: "contains", value: "" };

function asFilterValue(value: unknown): TMDataGridFilterValue {
  return isTMDataGridFilterValue(value) ? value : FALLBACK_FILTER;
}

export type TMDataGridFilterPanelProps = {
  /**
   * How one filter row is laid out.
   *
   * `"row"` - the default - puts column, operator and value side by side,
   * which wants about 550px. `"stacked"` puts them one under the other, each
   * filling the width, for a host too narrow for that: the sidebar surface
   * uses it, and so should a panel you place in a drawer or a narrow column.
   */
  layout?: "row" | "stacked";
};

/**
 * The MUI-style filter surface: one row per active column filter, each row a
 * column / operator / value triple, over an "Add filter" / "Clear all" footer.
 *
 * A plain block of controls, the way `TMDataGrid.ColumnsPanel` is - it renders
 * whenever it is mounted and knows nothing about floating. The chrome that
 * makes a floating surface (a title, a close button, click-away, Escape)
 * belongs to the popup and the sidebar, so this can equally be dropped into a
 * drawer, a page column or a form. See the `filters.surface` option.
 *
 * It only ever reads and writes the table's `columnFilters` state, so a
 * `manualFiltering` grid gets the same panel for free - the state is forwarded
 * to the server instead of a row model.
 */
export function TMDataGridFilterPanel({
  layout = "row",
}: TMDataGridFilterPanelProps = {}) {
  const { table, ui, labels, controlSize } = useTMDataGridContext();
  const columnFilters = useSelector(
    table.store,
    (state) => state.columnFilters,
  );
  const focusColumnId = useSelector(ui, (state) => state.filterPanelColumnId);
  const panelRef = useRef<HTMLDivElement>(null);
  const stacked = layout === "stacked";

  // Whoever pointed at a column - the column menu, a pill, the toolbar button -
  // meant "let me type here", so the value slot takes the focus. Cleared once
  // taken, which is what lets the same column be pointed at twice.
  useEffect(() => {
    if (focusColumnId === null) return;
    const row = panelRef.current?.querySelector<HTMLElement>(
      `[data-dg-part="filter-row"][data-column-id="${CSS.escape(focusColumnId)}"]`,
    );
    const slot = row?.querySelector<HTMLElement>("[data-dg-filter-value-slot]");
    slot
      ?.querySelector<HTMLElement>(
        "input:not([type='hidden']), textarea, select, [tabindex]:not([tabindex='-1'])",
      )
      ?.focus();
    ui.actions.focusColumnFilter(null);
  }, [focusColumnId, ui]);

  const filterableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanFilter());

  const columnOptions = filterableColumns.map((column) => ({
    value: column.id,
    label: getColumnLabel(column),
  }));

  function removeFilter(columnId: string) {
    table.setColumnFilters(
      columnFilters.filter((filter) => filter.id !== columnId),
    );
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
    // operator - a text needle has no meaning to an `isAnyOf` set, or a set
    // to a text input.
    const value =
      filterValueShape(operator) === filterValueShape(current.operator)
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
    // The row now names a different column; put the caret back in its value
    // slot rather than leaving it on a dropdown whose meaning just changed.
    ui.actions.focusColumnFilter(toColumnId);
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
      filterValueShape(operator) === filterValueShape(current.operator)
        ? current.value
        : emptyValueForOperator(operator);
    patchFilter(columnId, { operator, value });
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
    ui.actions.focusColumnFilter(nextColumn.id);
  }

  const canAddFilter = filterableColumns.some(
    (column) => !columnFilters.some((filter) => filter.id === column.id),
  );

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label={labels.filters}
      data-dg-part="filter-panel"
      data-layout={layout}
      className={classes.filterPanel}
    >
      <Stack gap="xs">
        {columnFilters.map((filter) => {
          const column = table.getColumn(filter.id);
          const value = asFilterValue(filter.value);
          const type = column ? getColumnType(column) : "string";
          const needsValue = operatorNeedsValue(value.operator);
          const scalarValue = typeof value.value === "string" ? value.value : "";
          // Pre-resolved only where options mean something out of the box -
          // a declared set, or a select-shaped column's faceted values. A
          // custom control wanting faceted values elsewhere resolves them
          // itself; resolving here would build the faceted index for every
          // filtered column.
          const options =
            column &&
            (column.columnDef.meta?.options !== undefined ||
              type === "select" ||
              type === "multiSelect")
              ? resolveColumnOptions({ table, column, fallback: "faceted" })
              : [];
          const ValueControl =
            (column === undefined ? undefined : getColumnFilterControl(column)) ??
            TMDataGridFilterValueInput;

          return (
            <div
              key={filter.id}
              // The row is the handle: a `meta.filter.control` renders whatever
              // it likes in the value slot, so the one thing a test can always
              // count on is which row it is in.
              data-dg-part="filter-row"
              data-column-id={filter.id}
              data-layout={layout}
              className={classes.filterRow}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                className={classes.filterRemove}
                aria-label={labels.removeFilter}
                data-dg-part="filter-remove"
                onClick={() => removeFilter(filter.id)}
              >
                <CloseIcon size={18} stroke={1.6} />
              </ActionIcon>

              <div className={classes.filterColumnSlot}>
              <Select
                label={labels.filterColumn}
                size={controlSize}
                w={stacked ? "100%" : 160}
                allowDeselect={false}
                // Both dropdowns render inside the panel: a portalled one is
                // outside it in the DOM, and picking an option would read as a
                // click away and close the popup under the user.
                comboboxProps={{ withinPortal: false }}
                data-dg-part="filter-column"
                data={columnOptions}
                value={filter.id}
                onChange={(next) => next && changeFilterColumn(filter.id, next)}
              />
              </div>

              <div className={classes.filterOperatorSlot}>
              <Select
                label={labels.filterOperator}
                size={controlSize}
                w={stacked ? "100%" : 170}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
                data-dg-part="filter-operator"
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
              </div>

              {/* What the focus effect above aims at. A `meta.filter.control`
                  may render anything, so the slot is the only landmark the
                  panel can count on. */}
              <div className={classes.filterValueSlot} data-dg-filter-value-slot>
                {column ? (
                  // `meta.filter.control` if the column declares one, the
                  // built-in shape-by-operator input otherwise - both through
                  // the same value-only contract.
                  <ValueControl
                    column={column}
                    table={table}
                    operator={value.operator}
                    value={value.value}
                    onChange={(next) => patchFilter(filter.id, { value: next })}
                    options={options}
                    size={controlSize}
                    labels={labels}
                    layout={stacked ? "stacked" : "panel"}
                  />
                ) : (
                  // The column is gone from the definition; the row survives
                  // only to be re-pointed or removed.
                  <TextInput
                    label={labels.filterValue}
                    size={controlSize}
                    w={stacked ? "100%" : 180}
                    data-dg-part="filter-value"
                    disabled={!needsValue}
                    placeholder={needsValue ? labels.filterValuePlaceholder : ""}
                    value={needsValue ? scalarValue : ""}
                    onChange={(event) =>
                      patchFilter(filter.id, {
                        value: event.currentTarget.value,
                      })
                    }
                  />
                )}
              </div>
            </div>
          );
        })}

        <div className={classes.filterPanelFooter}>
          <Button
            variant="subtle"
            size="compact-sm"
            disabled={!canAddFilter}
            data-dg-part="filter-add"
            onClick={addFilter}
          >
            {labels.addFilter}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            disabled={columnFilters.length === 0}
            data-dg-part="filter-clear-all"
            onClick={() => table.setColumnFilters([])}
          >
            {labels.clearAllFilters}
          </Button>
        </div>
      </Stack>
    </div>
  );
}

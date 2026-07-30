import {
  Badge,
  Button,
  Card,
  Fieldset,
  Flex,
  Group,
  Menu,
  Pagination,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import {
  type Dispatch,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  type TMDataGridFilterValue,
  type TMDataGridPersistence,
  type TMDataGridSelectionMode,
  type TMDataGridSize,
  useTMDataGrid,
} from "../tmdatagrid";
import { StarterSnippetModal } from "./StarterSnippetModal";

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  department: string;
  location: string;
  salary: number;
  status: "Active" | "On leave" | "Terminated";
};

const FIRST_NAMES = [
  "Anna", "Erik", "Maria", "Lars", "Sofia", "Johan", "Emma", "Anders",
  "Karin", "Mikael", "Lena", "Patrik", "Helena", "Martin", "Cecilia",
  "Fredrik", "Sara", "Tobias", "Åsa", "Daniel",
];

const LAST_NAMES = [
  "Lindqvist", "Johansson", "Svensson", "Eriksson", "Karlsson", "Nilsson",
  "Petersson", "Gustafsson", "Magnusson", "Olsson", "Persson", "Björk",
  "Lundström", "Holm", "Strand",
];

const DEPARTMENTS = [
  "Engineering", "Product", "Design", "Sales", "HR",
  "Finance", "Marketing", "Operations",
];

const LOCATIONS = ["Stockholm", "Göteborg", "Malmö", "Remote"];

function generateEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[(i * 3 + 7) % LAST_NAMES.length],
    age: 22 + ((i * 17) % 40),
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    location: LOCATIONS[(i * 3 + 1) % LOCATIONS.length],
    salary: 42000 + ((i * 3761 + 17) % 80) * 1000,
    status: i % 10 < 7 ? "Active" : i % 10 < 9 ? "On leave" : "Terminated",
  }));
}

const sek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

/** Keeps a menu item on one line whatever the cell holds. */
const truncate = (value: string, max = 20) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "ID",
    meta: { label: "ID", type: "number", flex: 0.4 },
    minSize: 100,
  }),
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
  }),
  columnHelper.accessor("lastName", {
    header: "Last name",
    minSize: 120,
  }),
  columnHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right", flex: 0.4 },
    minSize: 100,
  }),
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name",
    meta: { label: "Full name" },
    minSize: 160,
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
  }),
  columnHelper.accessor("location", {
    header: "Location",
    minSize: 120,
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    meta: { type: "number", align: "right" },
    minSize: 130,
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    cell: (info) => {
      const value = info.getValue();
      const color =
        value === "Active" ? "green" : value === "On leave" ? "yellow" : "red";
      return (
        <Badge color={color} variant="light" size="sm">
          {value}
        </Badge>
      );
    },
  }),
]);

// Module scope keeps the reference stable across renders.
// The settings key persists every slice in its group; the data key is narrowed
// to two, so page index is not restored on reload.
const persist = {
  dataKey: ["tmdatagrid.employees.data", ["columnFilters", "sorting"]],
  settingsKey: "tmdatagrid.employees.settings",
} satisfies TMDataGridPersistence;

/**
 * Grouped by what they affect, so the panel reads as sections rather than one
 * long row of switches. `key` is the real option name — each switch is passed
 * straight through to `useTMDataGrid`.
 */
const COLUMN_TOGGLES = [
  { key: "enableSorting", label: "Sorting" },
  { key: "enableColumnFilters", label: "Filtering" },
  { key: "enableHiding", label: "Hiding" },
  { key: "enableColumnPinning", label: "Pinning" },
  { key: "enableColumnResizing", label: "Resizing" },
  { key: "enableColumnOrdering", label: "Reordering" },
] as const;

const ROW_TOGGLES = [{ key: "enablePagination", label: "Pagination" }] as const;

const SELECTION_TOGGLES = [
  {
    key: "enableRowSelection",
    label: "Selectable",
    hint: "TanStack's gate — off, no row can be selected at all",
  },
  {
    key: "enableMultiRowSelection",
    label: "Multi-select",
    hint: "Off, rowSelection holds at most one id and the select-all box goes",
  },
] as const;

const FEATURE_TOGGLES = [
  ...SELECTION_TOGGLES,
  ...COLUMN_TOGGLES,
  ...ROW_TOGGLES,
] as const;

type FeatureKey = (typeof FEATURE_TOGGLES)[number]["key"];

const SELECTION_MODES = [
  { value: "checkbox", label: "Checkbox" },
  { value: "row", label: "Row" },
  { value: "checkboxAndHighlight", label: "Checkbox + highlight" },
  { value: "highlight", label: "Highlight" },
] as const satisfies ReadonlyArray<{
  value: TMDataGridSelectionMode;
  label: string;
}>;

/** One switch per option, wired straight to the option name in `key`. */
function FeatureSwitches({
  toggles,
  features,
  setFeatures,
}: {
  toggles: ReadonlyArray<{
    key: FeatureKey;
    label: string;
    hint?: string;
  }>;
  features: Record<FeatureKey, boolean>;
  setFeatures: Dispatch<SetStateAction<Record<FeatureKey, boolean>>>;
}) {
  return toggles.map(({ key, label, hint }) => (
    <Tooltip
      key={key}
      label={hint}
      disabled={hint === undefined}
      withArrow
      multiline
      w={240}
    >
      <Switch
        size="xs"
        label={label}
        checked={features[key]}
        onChange={(event) => {
          // Read before the updater runs — React clears currentTarget once the
          // handler returns.
          const { checked } = event.currentTarget;
          setFeatures((prev) => ({ ...prev, [key]: checked }));
        }}
      />
    </Tooltip>
  ));
}

export function DataGridExample() {
  const data = useMemo(() => generateEmployees(5000), []);
  const [size, setSize] = useState<TMDataGridSize>("md");

  // Stock TanStack options, apart from `enableColumnOrdering` and
  // `enablePagination` which the grid defines itself. Turning one off removes
  // the matching chrome on its own.
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({
    enableRowSelection: true,
    enableMultiRowSelection: true,
    enableSorting: true,
    enableColumnFilters: true,
    enableHiding: true,
    enableColumnPinning: true,
    enableColumnResizing: true,
    enableColumnOrdering: true,
    enablePagination: true,
  });
  const [customPager, setCustomPager] = useState(false);
  const [rowContextMenu, setRowContextMenu] = useState(true);
  const [selectionMode, setSelectionMode] =
    useState<TMDataGridSelectionMode>("checkbox");
  // Undefined follows the mode: off with checkboxes, on when rows select.
  const [showSelectedBackground, setShowSelectedBackground] = useState<
    boolean | undefined
  >(undefined);
  const [snippetOpen, setSnippetOpen] = useState(false);

  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
    // No rowHeight — let the `size` prop drive it.
    meta: { loading: false },
    persist,
    selectionMode,
    showSelectedBackground,
    ...features,
    initialState: {
      sorting: [{ id: "id", desc: false }],
      pagination: { pageIndex: 0, pageSize: 25 },
    },
  });

  // The chrome store and the table store are both subscribable — this is how a
  // consumer reacts to grid state without owning it.
  const selectedCount = useSelector(
    grid.table.store,
    (state) => Object.keys(state.rowSelection).length,
  );
  // The highlighted row is chrome state, so it comes off the ui store instead.
  // A detail panel is exactly what it exists for.
  const highlightedRowId = useSelector(
    grid.ui,
    (state) => state.highlightedRowId,
  );
  const highlightedEmployee = data.find(
    (row) => String(row.id) === highlightedRowId,
  );

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} size="lg">
          Employees{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — 5 000 rows · virtualized · state persisted to localStorage
          </Text>
        </Text>
        {/* Set the switches below to what you want, then take the code. */}
        <Button size="xs" variant="light" onClick={() => setSnippetOpen(true)}>
          Get the code
        </Button>
      </Group>

      <StarterSnippetModal
        opened={snippetOpen}
        onClose={() => setSnippetOpen(false)}
        config={{
          options: features,
          selectionMode,
          size,
          customPager,
          showSelectedBackground,
          rowContextMenu,
        }}
      />

      <Flex gap="sm" wrap="wrap" align="stretch">
        <Fieldset legend="Selection" p="xs" pt={4}>
          <Stack gap={6}>
            <SegmentedControl
              size="xs"
              value={selectionMode}
              onChange={(value) =>
                setSelectionMode(value as TMDataGridSelectionMode)
              }
              data={SELECTION_MODES as unknown as Array<{
                value: string;
                label: string;
              }>}
            />
            <Group gap="md">
              <FeatureSwitches
                toggles={SELECTION_TOGGLES}
                features={features}
                setFeatures={setFeatures}
              />
              <Switch
                size="xs"
                label="Selected background"
                checked={grid.features.showSelectedBackground}
                onChange={(event) =>
                  setShowSelectedBackground(event.currentTarget.checked)
                }
              />
            </Group>
          </Stack>
        </Fieldset>

        <Fieldset legend="Columns" p="xs" pt={4}>
          {/* Capped so six switches wrap to 3 × 2 rather than one long line —
              which is what pushes the other groups off the row. */}
          <Group gap="md" maw={260}>
            <FeatureSwitches
              toggles={COLUMN_TOGGLES}
              features={features}
              setFeatures={setFeatures}
            />
          </Group>
        </Fieldset>

        {/* Size lives here because it drives row height and font size — it is
            row density, not a category of its own. */}
        <Fieldset legend="Rows" p="xs" pt={4}>
          <Stack gap={6}>
            <SegmentedControl
              size="xs"
              value={size}
              onChange={(value) => setSize(value as TMDataGridSize)}
              data={["xs", "sm", "md", "lg", "xl"]}
            />
            <Group gap="md">
              <FeatureSwitches
                toggles={ROW_TOGGLES}
                features={features}
                setFeatures={setFeatures}
              />
              <Switch
                size="xs"
                label="Custom pager"
                disabled={!features.enablePagination}
                checked={customPager}
                onChange={(event) => setCustomPager(event.currentTarget.checked)}
              />
              <Tooltip
                label="Right-click any row — the grid owns the Menu, you fill the dropdown"
                withArrow
                multiline
                w={240}
              >
                <Switch
                  size="xs"
                  label="Context menu"
                  checked={rowContextMenu}
                  onChange={(event) =>
                    setRowContextMenu(event.currentTarget.checked)
                  }
                />
              </Tooltip>
            </Group>
          </Stack>
        </Fieldset>
      </Flex>

      <Flex gap="md" flex={1} mih={0}>
        <TMDataGrid
          {...grid}
          size={size}
          style={{
            flex: 1,
            minHeight: 0,
            // Both backgrounds are CSS variables, changeable without touching
            // the flags that decide whether they apply.
            "--dg-row-selected-bg": "var(--mantine-primary-color-light)",
          }}
        >
          <TMDataGrid.Toolbar>
            <TMDataGrid.SummaryCount />
            {/* Gated on the flag, not just the count: under "highlight" there
                is no selection, and a stale count would still be in state. */}
            {grid.features.rowSelection && selectedCount > 0 && (
              <Badge variant="light" size="sm">
                {selectedCount} selected
              </Badge>
            )}
            <TMDataGrid.Spacer />
            <TMDataGrid.FilterButton />
            <TMDataGrid.ColumnsButton />
          </TMDataGrid.Toolbar>

          <TMDataGrid.Table<Employee>
            // The render prop fills a Mantine dropdown the grid opens at the
            // pointer. `cell` is the one that was right-clicked, which is what
            // makes a per-cell action like "copy" possible at all.
            rowContextMenu={
              rowContextMenu
                ? ({ row, cell }) => {
                    // The raw cell value, not the rendered one: Salary shows
                    // "42 000 kr" but filters and copies as 42000.
                    const value = cell ? String(cell.getValue() ?? "") : "";
                    const canFilter =
                      cell !== null && cell.column.getCanFilter() && value !== "";

                    return (
                      <>
                        <Menu.Label>
                          {row.original.firstName} {row.original.lastName}
                        </Menu.Label>
                        <Menu.Item
                          disabled={!grid.features.highlightRow}
                          onClick={() =>
                            grid.ui.actions.setHighlightedRow(row.id)
                          }
                        >
                          Show details
                        </Menu.Item>
                        <Menu.Item
                          disabled={!cell}
                          onClick={() =>
                            navigator.clipboard.writeText(value)
                          }
                        >
                          Copy cell value
                        </Menu.Item>
                        <Menu.Item
                          disabled={!canFilter}
                          onClick={() => {
                            if (!cell) return;
                            // The operator travels inside the filter value, so
                            // adding a filter is one `setFilterValue` call —
                            // and opening the panel shows what just happened.
                            cell.column.setFilterValue({
                              operator: "equals",
                              value,
                            } satisfies TMDataGridFilterValue);
                            grid.ui.actions.openFilterPanel(cell.column.id);
                          }}
                        >
                          Filter by “{truncate(value)}”
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          disabled={row.original.status === "Terminated"}
                        >
                          Terminate
                        </Menu.Item>
                      </>
                    );
                  }
                : undefined
            }
          />

          {customPager ? (
            // The render prop replaces the built-in pager with any UI built on
            // the distilled pagination API — here Mantine's Pagination.
            <TMDataGrid.Footer
              pagination={(api) => (
                <Pagination
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

        {grid.features.highlightRow && highlightedEmployee && (
          <Card withBorder w={260} p="md">
            <Stack gap="xs">
              <Text fw={600}>
                {highlightedEmployee.firstName} {highlightedEmployee.lastName}
              </Text>
              <Text size="sm" c="dimmed">
                #{highlightedEmployee.id} · {highlightedEmployee.department}
              </Text>
              <Text size="sm">{highlightedEmployee.location}</Text>
              <Text size="sm">{sek(highlightedEmployee.salary)}</Text>
              {/* Clearing the highlight is the consumer's job — the grid only
                  ever sets it, so a second click cannot close this panel. */}
              <Button
                size="xs"
                variant="light"
                onClick={() => grid.ui.actions.setHighlightedRow(null)}
              >
                Close
              </Button>
            </Stack>
          </Card>
        )}
      </Flex>
    </Flex>
  );
}

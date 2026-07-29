import {
  Badge,
  Flex,
  Group,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  type TMDataGridPersistence,
  type TMDataGridSize,
  useTMDataGrid,
} from "../tmdatagrid";

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

const FEATURE_TOGGLES = [
  { key: "enableRowSelection", label: "Row selection" },
  { key: "enableSorting", label: "Sorting" },
  { key: "enableColumnFilters", label: "Filtering" },
  { key: "enableHiding", label: "Hiding" },
  { key: "enableColumnPinning", label: "Pinning" },
  { key: "enableColumnResizing", label: "Resizing" },
  { key: "enableColumnOrdering", label: "Reordering" },
] as const;

type FeatureKey = (typeof FEATURE_TOGGLES)[number]["key"];

export function DataGridExample() {
  const data = useMemo(() => generateEmployees(5000), []);
  const [size, setSize] = useState<TMDataGridSize>("md");

  // Stock TanStack options, apart from `enableColumnOrdering` which the grid
  // defines itself. Turning one off removes the matching chrome on its own.
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({
    enableRowSelection: true,
    enableSorting: true,
    enableColumnFilters: true,
    enableHiding: true,
    enableColumnPinning: true,
    enableColumnResizing: true,
    enableColumnOrdering: true,
  });

  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
    // No rowHeight — let the `size` prop drive it.
    meta: { loading: false },
    persist,
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

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Text fw={600} size="lg">
        Employees{" "}
        <Text component="span" size="sm" c="dimmed" fw={400}>
          — 5 000 rows · virtualized · state persisted to localStorage
        </Text>
      </Text>

      <Group gap="lg" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={size}
          onChange={(value) => setSize(value as TMDataGridSize)}
          data={["xs", "sm", "md", "lg", "xl"]}
        />
        {FEATURE_TOGGLES.map(({ key, label }) => (
          <Switch
            key={key}
            size="xs"
            label={label}
            checked={features[key]}
            onChange={(event) => {
              // Read before the updater runs — React clears currentTarget once
              // the handler returns.
              const { checked } = event.currentTarget;
              setFeatures((prev) => ({ ...prev, [key]: checked }));
            }}
          />
        ))}
      </Group>

      <TMDataGrid {...grid} size={size} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          {selectedCount > 0 && (
            <Badge variant="light" size="sm">
              {selectedCount} selected
            </Badge>
          )}
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
          <TMDataGrid.ColumnsButton />
        </TMDataGrid.Toolbar>

        <TMDataGrid.Table<Employee> />

        <TMDataGrid.Footer pageSizeOptions={[10, 25, 50, 100]} />
      </TMDataGrid>
    </Flex>
  );
}

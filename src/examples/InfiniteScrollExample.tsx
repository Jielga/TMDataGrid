import { Badge, Flex, Group, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "../tmdatagrid";

type Order = {
  id: number;
  customer: string;
  city: string;
  amount: number;
  status: "Paid" | "Pending" | "Overdue";
};

const CUSTOMERS = [
  "Nordkraft AB", "Fjällström & Söner", "Baltic Trade", "Havsvik Logistik",
  "Polarfrakt", "Stadsbygg Syd", "Lindgren Konsult", "Öresund Marin",
];

const CITIES = ["Stockholm", "Göteborg", "Malmö", "Uppsala", "Umeå"];

/** The whole "database": 100 000 rows the fake server pages out of. */
const TOTAL_ROWS = 100_000;
const PAGE_SIZE = 100;

function makeOrder(id: number): Order {
  return {
    id,
    customer: CUSTOMERS[(id * 7) % CUSTOMERS.length],
    city: CITIES[(id * 3 + 1) % CITIES.length],
    amount: 500 + ((id * 631) % 950) * 10,
    status: id % 11 < 7 ? "Paid" : id % 11 < 10 ? "Pending" : "Overdue",
  };
}

/** One page from the "server", after a network's worth of latency. */
function fetchOrders(pageIndex: number): Promise<Order[]> {
  const start = pageIndex * PAGE_SIZE;
  const rows = Array.from(
    { length: Math.min(PAGE_SIZE, TOTAL_ROWS - start) },
    (_, i) => makeOrder(start + i + 1),
  );
  return new Promise((resolve) => setTimeout(() => resolve(rows), 500));
}

const sek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

const columnHelper = createTMDataGridColumnHelper<Order>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "Order",
    meta: { type: "number", flex: 0.4 },
    minSize: 100,
  }),
  columnHelper.accessor("customer", { header: "Customer", minSize: 180 }),
  columnHelper.accessor("city", { header: "City", minSize: 120 }),
  columnHelper.accessor("amount", {
    header: "Amount",
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
        value === "Paid" ? "green" : value === "Pending" ? "yellow" : "red";
      return (
        <Badge color={color} variant="light" size="sm">
          {value}
        </Badge>
      );
    },
  }),
]);

/**
 * Infinite scroll: the grid holds the pages fetched so far, and
 * `onReachEnd` on the Table asks for the next one as the scroll nears the
 * bottom. The virtualizer keeps its position across the append, and
 * `LoadingIndicator` in the toolbar is the fetch's only chrome.
 *
 * Sorting and filtering are off on purpose: the client only ever holds a
 * prefix of the data, so both would run over a fraction of it and lie. A
 * real backend does them server-side (`manualSorting` / `manualFiltering`)
 * and resets the accumulated pages when they change.
 */
export function InfiniteScrollExample() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const nextPageRef = useRef(0);

  const loadNextPage = useCallback(async () => {
    if (nextPageRef.current * PAGE_SIZE >= TOTAL_ROWS) return;
    const pageIndex = nextPageRef.current;
    nextPageRef.current += 1;
    setLoading(true);
    const page = await fetchOrders(pageIndex);
    setOrders((previous) => [...previous, ...page]);
    setLoading(false);
  }, []);

  // Page zero is asked for here, not by the grid: `onReachEnd` stays quiet on
  // an empty grid, since "the end" of nothing is not a scroll position.
  useEffect(() => {
    if (nextPageRef.current === 0) void loadNextPage();
  }, [loadNextPage]);

  const meta = useMemo(
    () => ({ loading, totalRowCount: TOTAL_ROWS }),
    [loading],
  );

  const grid = useTMDataGrid({
    data: orders,
    columns,
    getRowId: (row) => String(row.id),
    meta,
    enableSorting: false,
    enableColumnFilters: false,
    enableGrouping: false,
    selectionMode: "highlight",
  });

  return (
    <Flex direction="column" gap="md" p={{ base: "sm", md: "lg" }} h="100%">
      <Group gap="sm">
        <Text fw={600} size="lg">
          Orders{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — {TOTAL_ROWS.toLocaleString("sv-SE")} rows on the "server", fetched
            {" "}{PAGE_SIZE} at a time as you scroll
          </Text>
        </Text>
      </Group>

      <TMDataGrid {...grid} size="md" style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount>
            {orders.length.toLocaleString("sv-SE")} of{" "}
            {TOTAL_ROWS.toLocaleString("sv-SE")} loaded
          </TMDataGrid.SummaryCount>
          <TMDataGrid.Spacer />
          <TMDataGrid.LoadingIndicator />
        </TMDataGrid.Toolbar>

        <TMDataGrid.Table<Order> onReachEnd={() => void loadNextPage()} />
      </TMDataGrid>
    </Flex>
  );
}

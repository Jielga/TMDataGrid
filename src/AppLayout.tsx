import { Flex, NavLink, Text } from "@mantine/core";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ColorSchemeSwitch } from "./ColorSchemeSwitch";
import { DOCS_PAGES } from "./docs/docsPages";

type NavItem = {
  to: string;
  label: string;
  description: string;
};

const DOCS_LINKS: NavItem[] = DOCS_PAGES.map((page) => ({
  to: `/docs/${page.id}`,
  label: page.label,
  description: page.description,
}));

const EXAMPLE_LINKS: NavItem[] = [
  {
    to: "/data-grid",
    label: "TMDataGrid",
    description: "Compound API · virtual, resize, sort, filter, pin",
  },
];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <Text
        size="xs"
        fw={600}
        c="dimmed"
        px="sm"
        py="xs"
        style={{ letterSpacing: "0.05em" }}
      >
        {title}
      </Text>
      {items.map((item) => (
        <NavLink
          key={item.to}
          component={Link}
          to={item.to}
          label={item.label}
          description={item.description}
          active={pathname === item.to}
          style={{ borderRadius: "var(--mantine-radius-sm)" }}
        />
      ))}
    </>
  );
}

export function AppLayout() {
  return (
    <Flex h="100vh" style={{ overflow: "hidden" }}>
      <nav
        style={{
          width: 230,
          flexShrink: 0,
          borderRight: "1px solid var(--mantine-color-default-border)",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <NavSection title="DOCUMENTATION" items={DOCS_LINKS} />
        <NavSection title="EXAMPLES" items={EXAMPLE_LINKS} />

        <div
          style={{ marginTop: "auto", paddingTop: "var(--mantine-spacing-sm)" }}
        >
          <ColorSchemeSwitch />
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Outlet />
      </main>
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </Flex>
  );
}

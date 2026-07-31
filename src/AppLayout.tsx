import { Burger, Flex, NavLink, Text, Tooltip } from "@mantine/core";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
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

/** Wide enough for the nav to sit open without crowding the page beside it. */
const WIDE_VIEWPORT = "(min-width: 1000px)";

/**
 * Collapsed, the nav keeps a rail wide enough for the burger that reopens it —
 * 230px is a quarter of a narrow window, and a page squeezed into what is left
 * is not a page anyone can judge a grid by.
 */
const NAV_WIDTH_OPEN = 230;
const NAV_WIDTH_RAIL = 44;

function useWideViewport(): boolean {
  const [wide, setWide] = useState(
    () => window.matchMedia(WIDE_VIEWPORT).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(WIDE_VIEWPORT);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return wide;
}

export function AppLayout() {
  const wide = useWideViewport();
  // The viewport decides until someone clicks, and then it is their call — see
  // the same pattern on the example page's options panel.
  const [navOpen, setNavOpen] = useState<boolean | null>(null);
  const open = navOpen ?? wide;

  return (
    <Flex h="100vh" style={{ overflow: "hidden" }}>
      <nav
        style={{
          width: open ? NAV_WIDTH_OPEN : NAV_WIDTH_RAIL,
          flexShrink: 0,
          borderRight: "1px solid var(--mantine-color-default-border)",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <Tooltip label={open ? "Hide navigation" : "Show navigation"} withArrow>
          <Burger
            size="sm"
            opened={open}
            onClick={() => setNavOpen(!open)}
            aria-label={open ? "Hide navigation" : "Show navigation"}
          />
        </Tooltip>

        {open && (
          <>
            <NavSection title="DOCUMENTATION" items={DOCS_LINKS} />
            <NavSection title="EXAMPLES" items={EXAMPLE_LINKS} />
          </>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: "var(--mantine-spacing-sm)",
            // The router devtools badge floats in this corner during dev; the
            // theme switch is what it would land on.
            paddingBottom: import.meta.env.DEV ? 36 : 0,
          }}
        >
          <ColorSchemeSwitch />
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Outlet />
      </main>
      {/* Bottom-left: the grid's pager lives in the opposite corner, and a
          floating badge over it is the one thing you cannot scroll out of the
          way. */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
    </Flex>
  );
}

import { Burger, Flex, NavLink, Text, Tooltip } from "@mantine/core";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { AppHeader } from "./AppHeader";
import {
  DOCS_NAV_TOP,
  docsNavSections,
  docsPageHref,
} from "./docs/docsPages";
import { DocsSearch } from "./docs/DocsSearch";
import { useDocsSearch } from "./docs/useDocsSearch";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      px="sm"
      py="xs"
      style={{ letterSpacing: "0.05em" }}
    >
      {children}
    </Text>
  );
}

const NAV_LINK_STYLE = { borderRadius: "var(--mantine-radius-sm)" };

/**
 * The router marks the active link with `aria-current`, which is what Mantine's
 * NavLink styles — so no link needs an `active` prop of its own. Exact, because
 * the default is a prefix match: without it `/docs` reads as active on every
 * page under it.
 */
const EXACT = { exact: true } as const;

/**
 * One tree: the front page, the playground, then the documentation grouped by
 * section. Child links carry no description — at two dozen entries the second
 * line stops being context and starts being noise, and the index page at
 * `/docs` is where each page gets its sentence.
 */
function DocsNav({ pathname }: { pathname: string }) {
  return (
    <>
      {docsNavSections().map(({ section, pages }) => {
        const hasActiveChild = pages.some(
          (page) => pathname === `/docs/${page.id}`,
        );

        return (
          <NavLink
            key={section}
            label={section}
            // Opens itself when the page you are on lives inside it, so a
            // reload or a deep link never lands with the tree shut.
            defaultOpened={hasActiveChild}
            childrenOffset={12}
            style={NAV_LINK_STYLE}
          >
            {pages.map((page) => (
              <NavLink
                key={page.id}
                component={Link}
                to={`/docs/${page.id}`}
                activeOptions={EXACT}
                label={page.label}
                style={NAV_LINK_STYLE}
              />
            ))}
          </NavLink>
        );
      })}
    </>
  );
}

/** Wide enough for the nav to sit open without crowding the page beside it. */
const WIDE_VIEWPORT = "(min-width: 1000px)";

/**
 * Collapsed, the nav keeps a rail wide enough for the burger that reopens it —
 * 260px is a quarter of a narrow window, and a page squeezed into what is left
 * is not a page anyone can judge a grid by.
 */
const NAV_WIDTH_OPEN = 260;
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
  // the same pattern on the playground's options panel.
  const [navOpen, setNavOpen] = useState<boolean | null>(null);
  const open = navOpen ?? wide;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useDocsSearch();

  return (
    <Flex direction="column" h="100vh" style={{ overflow: "hidden" }}>
      <AppHeader onSearch={search.open} />
      <DocsSearch opened={search.opened} onClose={search.close} />

      <Flex flex={1} style={{ minHeight: 0, overflow: "hidden" }}>
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
          <Tooltip
            label={open ? "Hide navigation" : "Show navigation"}
            withArrow
          >
            <Burger
              size="sm"
              opened={open}
              onClick={() => setNavOpen(!open)}
              aria-label={open ? "Hide navigation" : "Show navigation"}
            />
          </Tooltip>

          {open && (
            <>
              {/* The front page leads the nav, the way a package site starts
                  with its install-and-first-render page. */}
              {DOCS_NAV_TOP.map((page) => (
                <NavLink
                  key={page.id}
                  component={Link}
                  to={docsPageHref(page)}
                  activeOptions={EXACT}
                  label={page.label}
                  description={page.description}
                  style={NAV_LINK_STYLE}
                />
              ))}
              <NavLink
                component={Link}
                to="/playground"
                activeOptions={EXACT}
                label="Playground"
                description="Every feature at once, behind switches"
                style={NAV_LINK_STYLE}
              />

              <SectionLabel>DOCUMENTATION</SectionLabel>
              <NavLink
                component={Link}
                to="/docs"
                activeOptions={EXACT}
                label="All pages"
                style={NAV_LINK_STYLE}
              />
              <DocsNav pathname={pathname} />
            </>
          )}

          {/* The router devtools badge floats in this corner during dev, and
              the nav's last link is what it would land on. */}
          {import.meta.env.DEV && <div style={{ height: 36, flexShrink: 0 }} />}
        </nav>

        <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <Outlet />
        </main>
      </Flex>

      {/* Bottom-left: the grid's pager lives in the opposite corner, and a
          floating badge over it is the one thing you cannot scroll out of the
          way. */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
    </Flex>
  );
}

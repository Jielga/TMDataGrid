import {
  ActionIcon,
  Badge,
  Group,
  Kbd,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBrandGithub,
  IconCheck,
  IconChevronDown,
  IconSearch,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ColorSchemeSwitch } from "./ColorSchemeSwitch";
import classes from "./AppHeader.module.css";
import {
  currentEntry,
  currentLabel,
  DOCS_SLUG,
  docsMenu,
  useDocsManifest,
  versionHref,
  type DocsEntry,
} from "./docsVersions";
import {
  headlineVersion,
  NPM_PAGE,
  REPO_URL,
  useDistTags,
} from "./packageStatus";

/**
 * The site header: what this is, which version, and the way in to everything.
 *
 * The search button is styled as an input rather than being one. A real input
 * here would take focus on click and then have to hand it to the palette's own
 * field; a button opens the palette and the palette handles the typing.
 *
 * The version badge names the copy of the documentation you are reading, not
 * the version on npm. Several copies are published side by side, so "which one
 * is this" is the question the header has to answer; what the registry is
 * serving today is one line inside the menu and the front page's version strip.
 */

const GRID_GLYPH_CELLS = [
  [3, 3],
  [11, 3],
  [3, 11],
  [11, 11],
] as const;

/** A four-cell grid - the product, at 22px. */
function BrandMark() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      aria-hidden
      className={classes.mark}
    >
      <rect x={1} y={1} width={20} height={20} rx={4} className={classes.markFrame} />
      {GRID_GLYPH_CELLS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={8} height={8} rx={1.5} />
      ))}
    </svg>
  );
}

/** One deployed copy, as a link that leaves this bundle for that one. */
function VersionItem({
  entry,
  pathname,
  current,
}: {
  entry: DocsEntry;
  pathname: string;
  current: boolean;
}) {
  return (
    <Menu.Item
      component="a"
      href={versionHref(entry, pathname)}
      // A full page load, not a router navigation: the destination is a
      // separate build with its own base path.
      rightSection={current ? <IconCheck size={14} stroke={2} /> : undefined}
    >
      {entry.label}
    </Menu.Item>
  );
}

function VersionMenu() {
  const manifest = useDocsManifest();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const npmVersion = headlineVersion(useDistTags());
  const { versions, previews } = docsMenu(manifest, DOCS_SLUG);
  const here = currentEntry(manifest, DOCS_SLUG);

  return (
    <Menu shadow="md" width={240} position="bottom-start" withinPortal>
      <Menu.Target>
        <Badge
          component="button"
          type="button"
          size="sm"
          variant="light"
          color="grape"
          // Mantine uppercases a badge by default; a semver string is not a
          // label, and "1.0.0-BETA.0" is not the version anyone installs.
          tt="none"
          rightSection={<IconChevronDown size={12} stroke={2.2} />}
          className={classes.version}
          aria-label="Documentation version"
        >
          {currentLabel(manifest, DOCS_SLUG)}
        </Badge>
      </Menu.Target>

      <Menu.Dropdown>
        {versions.length > 0 && (
          <>
            <Menu.Label>Documentation</Menu.Label>
            {versions.map((entry) => (
              <VersionItem
                key={entry.path}
                entry={entry}
                pathname={pathname}
                current={entry.path === here?.path}
              />
            ))}
          </>
        )}

        {previews.length > 0 && (
          <>
            <Menu.Label>Previews</Menu.Label>
            {previews.map((entry) => (
              <VersionItem
                key={entry.path}
                entry={entry}
                pathname={pathname}
                current={entry.path === here?.path}
              />
            ))}
          </>
        )}

        {versions.length + previews.length > 0 && <Menu.Divider />}
        <Menu.Item
          component="a"
          href={NPM_PAGE}
          target="_blank"
          rel="noreferrer"
        >
          {npmVersion ? `v${npmVersion} on npm` : "This package on npm"}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function AppHeader({ onSearch }: { onSearch: () => void }) {
  return (
    <header className={classes.header}>
      <Group gap="sm" wrap="nowrap" className={classes.brand}>
        <Link to="/" className={classes.brandLink}>
          <BrandMark />
          <Text fw={700} size="sm" className={classes.wordmark}>
            TMDataGrid
          </Text>
        </Link>
        <VersionMenu />
      </Group>

      <UnstyledButton
        onClick={onSearch}
        className={classes.search}
        aria-label="Search the documentation"
      >
        <IconSearch size={15} stroke={1.8} />
        <span className={classes.searchLabel}>Search…</span>
        {/* Not a hint anyone has to have read: the palette answers Ctrl+K
            whether or not this is on screen. */}
        <Kbd size="xs" className={classes.shortcut}>
          Ctrl K
        </Kbd>
      </UnstyledButton>

      <Group gap={4} wrap="nowrap">
        <Tooltip label="GitHub" withArrow>
          <ActionIcon
            component="a"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="GitHub repository"
          >
            <IconBrandGithub size={18} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
        <ColorSchemeSwitch />
      </Group>
    </header>
  );
}

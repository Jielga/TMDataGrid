import {
  ActionIcon,
  Badge,
  Group,
  Kbd,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconBrandGithub, IconSearch } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { ColorSchemeSwitch } from "./ColorSchemeSwitch";
import classes from "./AppHeader.module.css";
import {
  headlineVersion,
  NPM_PAGE,
  REPO_URL,
  useDistTags,
} from "./packageStatus";

/**
 * The site header: what this is, which version, and the way in to everything —
 * the shape every library documentation site has settled on.
 *
 * The search button is styled as an input rather than being one. A real input
 * here would take focus on click and then have to hand it to the palette's
 * own field; a button opens the palette and the palette owns the typing.
 */

const GRID_GLYPH_CELLS = [
  [3, 3],
  [11, 3],
  [3, 11],
  [11, 11],
] as const;

/** A four-cell grid — the product, at 22px. */
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

export function AppHeader({ onSearch }: { onSearch: () => void }) {
  const version = headlineVersion(useDistTags());

  return (
    <header className={classes.header}>
      <Group gap="sm" wrap="nowrap" className={classes.brand}>
        <Link to="/" className={classes.brandLink}>
          <BrandMark />
          <Text fw={700} size="sm" className={classes.wordmark}>
            TMDataGrid
          </Text>
        </Link>
        {version && (
          <Badge
            component="a"
            href={NPM_PAGE}
            target="_blank"
            rel="noreferrer"
            size="sm"
            variant="light"
            color="grape"
            // Mantine uppercases a badge by default; a semver string is not a
            // label, and "1.0.0-BETA.0" is not the version anyone installs.
            tt="none"
            className={classes.version}
          >
            v{version}
          </Badge>
        )}
      </Group>

      <UnstyledButton
        onClick={onSearch}
        className={classes.search}
        aria-label="Search the documentation"
      >
        <IconSearch size={15} stroke={1.8} />
        <span className={classes.searchLabel}>Search…</span>
        {/* Not a hint the reader has to have read: the palette answers Ctrl+K
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

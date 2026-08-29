import {
  ActionIcon,
  Menu,
  ScrollArea,
  Tooltip,
  type MenuProps,
} from "@mantine/core";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getColumnLabel } from "../core/columnUtils";
import { useHideableColumns } from "./useHideableColumns";
import { BurgerIcon, MinusIcon, RestoreIcon } from "./icons";

export type TMDataGridMenuProps = Omit<MenuProps, "children"> & {
  /** The dropdown's content: Mantine `Menu.Item`s and the `TMDataGrid.Menu.*` items. */
  children: ReactNode;
  /** Replaces the burger icon on the trigger. */
  icon?: ReactNode;
  /** Tooltip and `aria-label` of the trigger. Default `labels.menuButton`. */
  label?: string;
};

export type TMDataGridMenuColumnsProps = {
  /** Renders a `Menu.Search` above the toggles. Default `true`. Use `false` inside a `Menu.Sub`. */
  searchable?: boolean;
};

/**
 * Burger menu in the grid's top-right corner, holding whatever the consumer
 * puts in it. Every Mantine `Menu` prop is accepted and wins over the defaults
 * below.
 *
 * It always renders. It cannot know whether its children render anything, so
 * a menu holding only `TMDataGrid.Menu.Columns` on a grid where nothing can be
 * hidden still shows its button over an empty dropdown - leave the menu out of
 * the toolbar in that case.
 */
function TMDataGridMenuRoot({
  children,
  icon,
  label,
  ...menuProps
}: TMDataGridMenuProps) {
  const { labels, controlSize } = useTMDataGridContext();
  const triggerLabel = label ?? labels.menuButton;

  return (
    <Menu
      position="bottom-end"
      shadow="md"
      width={260}
      withinPortal
      {...menuProps}
    >
      <Menu.Target>
        <Tooltip label={triggerLabel} openDelay={400}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={controlSize}
            aria-label={triggerLabel}
            data-dg-part="menu-button"
          >
            {icon ?? <BurgerIcon size={18} stroke={1.6} />}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  );
}

/**
 * The whole column chooser as menu items: a search box, one checkbox item per
 * hideable column, show/hide all, and Reset layout. Renders nothing when no
 * column can be hidden.
 *
 * `searchable` is only for a block at the top level of a dropdown.
 * `Menu.Search` registers on the root menu context (`hasSearch`), which
 * switches off type-ahead and the arrow-key handling of every dropdown of that
 * menu, so a search inside a `Menu.Sub` breaks the parent menu's keyboard
 * behaviour.
 */
export function TMDataGridMenuColumns({
  searchable = true,
}: TMDataGridMenuColumnsProps) {
  const { labels, controlSize } = useTMDataGridContext();
  const { columns } = useHideableColumns();
  const [search, setSearch] = useState("");

  if (columns.length === 0) return null;

  // `Menu.Search` walks every item of the dropdown from the top, so with items
  // placed above this block ArrowDown from the search lands on the first of
  // those - and Enter runs it. When something precedes the block, ArrowDown
  // moves focus to the first listed column instead; when nothing does,
  // Mantine's own walk already starts there and is left alone.
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown") return;
    const dropdown = event.currentTarget.closest('[role="menu"]');
    const first = dropdown?.querySelector('[role^="menuitem"]');
    const firstToggle = dropdown?.querySelector<HTMLElement>(
      '[data-dg-part="columns-toggle"]',
    );
    if (!first || !firstToggle || first === firstToggle) return;
    event.preventDefault();
    firstToggle.focus();
  };

  return (
    <>
      {searchable && (
        <Menu.Search
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={labels.columnsSearchPlaceholder}
          size={controlSize}
          data-dg-part="columns-search"
        />
      )}
      <TMDataGridMenuColumnToggles search={search} />
      <Menu.Divider />
      <TMDataGridMenuShowHideAll />
      <TMDataGridMenuResetLayout />
    </>
  );
}

/**
 * One checkbox item per hideable column, narrowed to `search` when one is
 * given. Renders nothing when no column can be hidden.
 */
export function TMDataGridMenuColumnToggles({ search }: { search?: string }) {
  const { labels } = useTMDataGridContext();
  const { columns, columnVisibility } = useHideableColumns();

  if (columns.length === 0) return null;

  const needle = (search ?? "").trim().toLowerCase();
  const listed = needle
    ? columns.filter((column) =>
        getColumnLabel(column).toLowerCase().includes(needle),
      )
    : columns;

  return (
    <ScrollArea.Autosize mah={260} type="auto">
      {listed.length === 0 ? (
        <Menu.Label>{labels.columnsNoMatch(search ?? "")}</Menu.Label>
      ) : (
        listed.map((column) => (
          <Menu.CheckboxItem
            key={column.id}
            checked={columnVisibility[column.id] !== false}
            onChange={(checked) => column.toggleVisibility(checked)}
            data-dg-part="columns-toggle"
            data-column-id={column.id}
          >
            {getColumnLabel(column)}
          </Menu.CheckboxItem>
        ))
      )}
    </ScrollArea.Autosize>
  );
}

/**
 * Shows or hides every listed column at once. Renders nothing when no column
 * can be hidden.
 */
export function TMDataGridMenuShowHideAll() {
  const { labels } = useTMDataGridContext();
  const { columns, shownCount, setAllVisible } = useHideableColumns();

  if (columns.length === 0) return null;

  const all = shownCount === columns.length;
  // Some shown but not all: a minus instead of a tick, and a click shows all -
  // the same reading as the panel's indeterminate checkbox. The item cannot
  // also say `aria-checked="mixed"`: `Menu.CheckboxItem` writes that attribute
  // from `checked` after the props it is given, so an override never lands.
  const some = shownCount > 0 && !all;

  return (
    <Menu.CheckboxItem
      checked={shownCount > 0}
      checkIcon={some ? <MinusIcon size={14} stroke={1.6} /> : undefined}
      onChange={() => setAllVisible(!all)}
      data-dg-part="columns-toggle-all"
    >
      {labels.columnsShowHideAll}
    </Menu.CheckboxItem>
  );
}

/**
 * Resets the whole layout, not only visibility: order, widths, pinning and
 * grouping go back too. Not `table.resetColumnVisibility()`, which resets to
 * `initialState` - and under persistence the mount built that *from* the
 * persisted payload.
 */
export function TMDataGridMenuResetLayout() {
  const { labels, resetSettings } = useTMDataGridContext();

  return (
    <Menu.Item
      leftSection={<RestoreIcon size={16} stroke={1.6} />}
      onClick={() => resetSettings()}
      data-dg-part="columns-reset"
    >
      {labels.columnsReset}
    </Menu.Item>
  );
}

export const TMDataGridMenu = Object.assign(TMDataGridMenuRoot, {
  Columns: TMDataGridMenuColumns,
  ColumnToggles: TMDataGridMenuColumnToggles,
  ShowHideAll: TMDataGridMenuShowHideAll,
  ResetLayout: TMDataGridMenuResetLayout,
});

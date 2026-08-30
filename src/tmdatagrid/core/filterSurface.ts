/**
 * Where the grid puts its filter controls.
 *
 * | Surface | Where it renders |
 * | --- | --- |
 * | `"popup"` | Floating over the first body rows, under the header |
 * | `"sidebar"` | Beside the table, inside the grid frame |
 * | `"manual"` | Nowhere - the consumer places `TMDataGrid.FilterPanel` |
 *
 * Header filters are not one of these: they are a second row of controls in
 * the header, always visible, and they coexist with any of the three. See
 * {@link TMDataGridFilterOptions.inHeader}.
 */
export type TMDataGridFilterSurface = "popup" | "sidebar" | "manual";

/** Which side of the table the sidebar surface renders on. */
export type TMDataGridFilterSidebarSide = "left" | "right";

/**
 * `filters` on `useTMDataGrid` - everything about where the filter controls
 * are, as opposed to what they do.
 *
 * ```tsx
 * useTMDataGrid({ data, columns, filters: { surface: "sidebar", defaultOpen: true } });
 * ```
 */
export type TMDataGridFilterOptions = {
  /**
   * Which surface `TMDataGrid.Table` renders and `TMDataGrid.FilterButton`
   * toggles. Defaults to `"popup"`, which is what the grid has always shown.
   *
   * Under `"manual"` the table renders no panel and the filter button renders
   * nothing - a consumer's own `<TMDataGrid.FilterPanel />` is the only
   * surface, and it is always visible. Toggle it yourself off
   * `ui.state.filterPanelOpen` if it belongs in a drawer.
   */
  surface?: TMDataGridFilterSurface;
  /** Which side the `"sidebar"` surface sits on. Defaults to `"right"`. */
  sidebarSide?: TMDataGridFilterSidebarSide;
  /** Width of the `"sidebar"` surface, any CSS length. Defaults to `"280px"`. */
  sidebarWidth?: string;
  /**
   * Whether the popup or the sidebar starts open. Defaults to `false`. Read
   * once, at mount, like `initialState`.
   */
  defaultOpen?: boolean;
  /**
   * A second header row holding one value control per filterable column,
   * always visible. Off by default.
   *
   * Independent of `surface` - a grid may have header filters and a popup at
   * once. What it does change is the column chrome: the header's funnel
   * indicator and the column menu's "Filter" item both come off, because
   * their only job was to reveal a control that is now already on screen.
   *
   * A header cell has room for a value and an operator button, not for the
   * panel's column / operator / value triple. Everything else about a filter
   * is unchanged - the same operators, the same `meta.filter.control`, the
   * same `columnFilters` state.
   */
  inHeader?: boolean;
};

/** {@link TMDataGridFilterOptions} with every default filled in. */
export type TMDataGridFilterSettings = Required<TMDataGridFilterOptions>;

export const DEFAULT_FILTER_SETTINGS: TMDataGridFilterSettings = {
  surface: "popup",
  sidebarSide: "right",
  sidebarWidth: "280px",
  defaultOpen: false,
  inHeader: false,
};

/**
 * Fills the defaults in. Field by field rather than by spreading, so an
 * explicit `undefined` - which is what destructuring an absent option group
 * hands over - reads as "not set" rather than overwriting the default with it.
 */
export function resolveFilterOptions(
  options: TMDataGridFilterOptions = {},
): TMDataGridFilterSettings {
  return {
    surface: options.surface ?? DEFAULT_FILTER_SETTINGS.surface,
    sidebarSide: options.sidebarSide ?? DEFAULT_FILTER_SETTINGS.sidebarSide,
    sidebarWidth: options.sidebarWidth ?? DEFAULT_FILTER_SETTINGS.sidebarWidth,
    defaultOpen: options.defaultOpen ?? DEFAULT_FILTER_SETTINGS.defaultOpen,
    inHeader: options.inHeader ?? DEFAULT_FILTER_SETTINGS.inHeader,
  };
}

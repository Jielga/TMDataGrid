import type { TableState } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type GridState = TableState<TMDataGridFeatures>;

/**
 * Persistence deliberately does not use Mantine's `useLocalStorage`.
 *
 * That hook holds a piece of state and returns `[value, setValue]`. Here the
 * table already holds the state and storage only mirrors it, so routing writes
 * through the hook would keep a second copy and trigger a React state update on
 * every change, including every pointer move during a column resize. Its
 * defaults also conflict with this use: `getInitialValueInEffect: true` delivers
 * the stored value after mount, while `initialState` is only read on the first
 * render, and `sync: true` would let two open tabs overwrite each other's
 * column layout.
 *
 * The option vocabulary follows Mantine's: `StorageType` is its type, and
 * `serialize` / `deserialize` behave as they do in `UseStorageOptions`.
 */

/**
 * State slices describing what the user is looking at. Derived from the data,
 * so they can go stale as it changes.
 */
export const DATA_STATE_SLICES = [
  "columnFilters",
  "globalFilter",
  "sorting",
  "pagination",
  // Which groups are open. Keyed by group ids built from the values themselves
  // (`department:Design`), so a restored entry for a group the data no longer
  // produces is simply never looked up.
  "expanded",
] as const satisfies ReadonlyArray<keyof GridState>;

/**
 * State slices describing how the user configured the grid. Independent of the
 * data, and the ones users notice losing.
 */
export const SETTINGS_STATE_SLICES = [
  "columnVisibility",
  "columnSizing",
  "columnOrder",
  "columnPinning",
  // Which columns the rows are grouped by. A settings slice rather than a data
  // one: it names columns, not values, so it survives the data changing under
  // it the way the column layout does.
  "grouping",
] as const satisfies ReadonlyArray<keyof GridState>;

export type TMDataGridDataSlice = (typeof DATA_STATE_SLICES)[number];
export type TMDataGridSettingsSlice = (typeof SETTINGS_STATE_SLICES)[number];

/**
 * A storage key, optionally narrowed to a subset of its group's slices.
 *
 * - `"employees.data"` - persists every slice in the group.
 * - `["employees.data", ["sorting"]]` - persists only the listed slices.
 */
export type TMDataGridPersistKey<TSlice extends string> =
  | string
  | readonly [key: string, slices: readonly TSlice[]];

/** Same values as Mantine's `StorageType`, which the package does not re-export. */
export type TMDataGridStorageMode = "localStorage" | "sessionStorage";

export type TMDataGridPersistence = {
  /** Key for filters, global filter, sorting and pagination. */
  dataKey?: TMDataGridPersistKey<TMDataGridDataSlice>;
  /** Key for column visibility, sizing, order and pinning. */
  settingsKey?: TMDataGridPersistKey<TMDataGridSettingsSlice>;
  /** Which storage area to use. Defaults to `"localStorage"`. */
  storageMode?: TMDataGridStorageMode;
  /** Serializes a payload before it is stored. Defaults to `JSON.stringify`. */
  serialize?: (value: Partial<GridState>) => string;
  /** Parses a stored payload. Defaults to `JSON.parse`. */
  deserialize?: (value: string) => unknown;
};

/**
 * Version stamped into every stored payload, under a key no state slice can
 * collide with. A payload whose version does not match is dropped whole: a
 * migration would be guessing at a shape this code no longer knows, and the
 * cost of dropping is one lost layout. Payloads written before versioning
 * existed (≤0.4.0) have no stamp and are dropped the same way - the 1.0
 * wave's one-time break, named in its changeset.
 */
export const PERSIST_PAYLOAD_VERSION = 1;
const VERSION_FIELD = "__v";

type ResolvedKey = { key: string; slices: ReadonlyArray<keyof GridState> };

function resolveKey<TSlice extends string>(
  entry: TMDataGridPersistKey<TSlice> | undefined,
  defaultSlices: ReadonlyArray<keyof GridState>,
): ResolvedKey | null {
  if (!entry) return null;
  if (typeof entry === "string") return { key: entry, slices: defaultSlices };

  const [key, slices] = entry;
  if (!key) return null;
  // An empty list means nothing was selected, which is not the same as "all".
  return { key, slices: slices as ReadonlyArray<keyof GridState> };
}

function resolveStorage(
  persistence: TMDataGridPersistence | undefined,
): Storage | null {
  if (!persistence) return null;
  // Absent under SSR, and access throws outright in some privacy modes.
  try {
    if (typeof window === "undefined") return null;
    return persistence.storageMode === "sessionStorage"
      ? window.sessionStorage
      : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Shape guards for restored state.
 *
 * A stored payload outlives the code that wrote it: a slice can change shape
 * between releases, and nothing stops anyone from editing storage by hand. The
 * value goes straight into `initialState`, where a wrong shape surfaces as a
 * crash inside TanStack rather than as a bad read here. A slice that fails its
 * guard is dropped; the rest still restore.
 */
function prop(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

const isString = (value: unknown): value is string => typeof value === "string";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isArrayOf(
  value: unknown,
  isItem: (item: unknown) => boolean,
): boolean {
  return Array.isArray(value) && value.every(isItem);
}

function isRecordOf(
  value: unknown,
  isItem: (item: unknown) => boolean,
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(isItem);
}

const hasStringId = (entry: unknown): boolean => isString(prop(entry, "id"));

const SLICE_GUARDS: Record<
  TMDataGridDataSlice | TMDataGridSettingsSlice,
  (value: unknown) => boolean
> = {
  columnFilters: (value) => isArrayOf(value, hasStringId),
  // TanStack leaves the global filter value untyped - the grid's own default
  // filters on a string, but a consumer may store anything here.
  globalFilter: () => true,
  sorting: (value) =>
    isArrayOf(
      value,
      (entry) => hasStringId(entry) && typeof prop(entry, "desc") === "boolean",
    ),
  pagination: (value) => {
    const pageIndex = prop(value, "pageIndex");
    const pageSize = prop(value, "pageSize");
    return (
      isFiniteNumber(pageIndex) &&
      pageIndex >= 0 &&
      isFiniteNumber(pageSize) &&
      pageSize > 0
    );
  },
  // `true` is a legal ExpandedState of its own, meaning every row is open.
  expanded: (value) =>
    value === true || isRecordOf(value, (entry) => typeof entry === "boolean"),
  columnVisibility: (value) =>
    isRecordOf(value, (entry) => typeof entry === "boolean"),
  columnSizing: (value) => isRecordOf(value, isFiniteNumber),
  columnOrder: (value) => isArrayOf(value, isString),
  // Both the current logical shape and the physical one 1.x wrote.
  columnPinning: (value) =>
    (isArrayOf(prop(value, "start"), isString) &&
      isArrayOf(prop(value, "end"), isString)) ||
    (isArrayOf(prop(value, "left"), isString) &&
      isArrayOf(prop(value, "right"), isString)),
  grouping: (value) => isArrayOf(value, isString),
};

/**
 * Settings saved by 1.x used TanStack's old physical `columnPinning` keys.
 * Rewrite them once on read, so nothing downstream sees `left` / `right`.
 */
function normalizeColumnPinning(value: unknown): unknown {
  const left = prop(value, "left");
  const right = prop(value, "right");
  if (left === undefined || right === undefined) return value;
  return { start: left, end: right };
}

function isValidSlice(slice: keyof GridState, value: unknown): boolean {
  const guard = SLICE_GUARDS[slice as keyof typeof SLICE_GUARDS];
  return guard === undefined || guard(value);
}

function readSlices(
  storage: Storage | null,
  resolved: ResolvedKey | null,
  deserialize: (value: string) => unknown,
): Partial<GridState> {
  if (!storage || !resolved) return {};
  try {
    const raw = storage.getItem(resolved.key);
    if (!raw) return {};
    const parsed = deserialize(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const record = parsed as Record<string, unknown>;
    if (record[VERSION_FIELD] !== PERSIST_PAYLOAD_VERSION) return {};
    const restored: Record<string, unknown> = {};
    // Only copy the selected slices. A payload written before the selection was
    // narrowed cannot reintroduce slices the caller has since opted out of.
    for (const slice of resolved.slices) {
      if (!(slice in record)) continue;
      if (!isValidSlice(slice, record[slice])) continue;
      restored[slice] =
        slice === "columnPinning"
          ? normalizeColumnPinning(record[slice])
          : record[slice];
    }
    return restored as Partial<GridState>;
  } catch {
    return {};
  }
}

function writeSlices(
  storage: Storage | null,
  resolved: ResolvedKey | null,
  state: GridState,
  serialize: (value: Partial<GridState>) => string,
): void {
  if (!storage || !resolved) return;
  const payload: Record<string, unknown> = { [VERSION_FIELD]: PERSIST_PAYLOAD_VERSION };
  for (const slice of resolved.slices) payload[slice] = state[slice];
  try {
    storage.setItem(resolved.key, serialize(payload as Partial<GridState>));
  } catch {
    // Quota exceeded or storage disabled. Persistence is best effort.
  }
}

function resolveKeys(persistence: TMDataGridPersistence | undefined) {
  return {
    data: resolveKey(persistence?.dataKey, DATA_STATE_SLICES),
    settings: resolveKey(persistence?.settingsKey, SETTINGS_STATE_SLICES),
  };
}

/** True when at least one key is configured. */
export function hasPersistenceKeys(
  persistence: TMDataGridPersistence | undefined,
): boolean {
  const { data, settings } = resolveKeys(persistence);
  return data !== null || settings !== null;
}

const defaultDeserialize = (value: string): unknown => JSON.parse(value);
const defaultSerialize = (value: Partial<GridState>): string =>
  JSON.stringify(value);

/**
 * The leaf column ids a set of column defs will produce, by TanStack's own
 * derivation: `id`, else `accessorKey` with dots replaced by underscores,
 * else a string `header`. Mirrored here so restored state can be realigned
 * against the columns that will actually exist - deriving ids any other way
 * would realign against names the table never uses.
 */
export function collectLeafColumnIds(
  defs: ReadonlyArray<unknown>,
  into: string[] = [],
): string[] {
  for (const def of defs) {
    if (typeof def !== "object" || def === null) continue;
    const record = def as Record<string, unknown>;
    if (Array.isArray(record.columns) && record.columns.length > 0) {
      collectLeafColumnIds(record.columns, into);
      continue;
    }
    const accessorKey =
      typeof record.accessorKey === "string" ? record.accessorKey : undefined;
    const id =
      (typeof record.id === "string" ? record.id : undefined) ??
      accessorKey?.replaceAll(".", "_") ??
      (typeof record.header === "string" ? record.header : undefined);
    if (id !== undefined) into.push(id);
  }
  return into;
}

/**
 * Drops restored entries that name columns the grid no longer has.
 *
 * A stored layout outlives the column set: a column removed between deploys
 * would otherwise linger forever - a ghost id in the order, a width for
 * nothing, and worse, a *filter or sort that is active but has no column to
 * show for itself*. New columns need no counterpart here: TanStack appends
 * columns missing from `columnOrder` on its own, in definition order.
 */
function realignToColumns(
  restored: Partial<GridState>,
  known: ReadonlySet<string>,
): Partial<GridState> {
  const has = (id: unknown): boolean =>
    typeof id === "string" && known.has(id);
  const keepIds = (values: ReadonlyArray<string>) => values.filter(has);
  const keepKeys = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => has(id)));
  const keepEntries = <T extends { id: string }>(entries: ReadonlyArray<T>) =>
    entries.filter((entry) => has(entry.id));

  const realigned: Partial<GridState> = { ...restored };
  if (restored.columnOrder) realigned.columnOrder = keepIds(restored.columnOrder);
  if (restored.grouping) realigned.grouping = keepIds(restored.grouping);
  if (restored.columnVisibility) {
    realigned.columnVisibility = keepKeys(restored.columnVisibility);
  }
  if (restored.columnSizing) {
    realigned.columnSizing = keepKeys(restored.columnSizing);
  }
  if (restored.columnPinning) {
    realigned.columnPinning = {
      start: keepIds(restored.columnPinning.start ?? []),
      end: keepIds(restored.columnPinning.end ?? []),
    };
  }
  if (restored.sorting) realigned.sorting = keepEntries(restored.sorting);
  if (restored.columnFilters) {
    realigned.columnFilters = keepEntries(restored.columnFilters);
  }
  return realigned;
}

/**
 * State to merge into `initialState`, read once on mount.
 *
 * With `knownColumnIds` - every id the grid is about to construct, generated
 * lanes included - the column-shaped slices are realigned first; see
 * {@link realignToColumns}. Without it the payload is returned as stored.
 */
export function readPersistedState(
  persistence?: TMDataGridPersistence,
  knownColumnIds?: ReadonlyArray<string>,
): Partial<GridState> {
  const storage = resolveStorage(persistence);
  const { data, settings } = resolveKeys(persistence);
  const deserialize = persistence?.deserialize ?? defaultDeserialize;
  const restored = {
    ...readSlices(storage, settings, deserialize),
    ...readSlices(storage, data, deserialize),
  };
  return knownColumnIds === undefined
    ? restored
    : realignToColumns(restored, new Set(knownColumnIds));
}

/** Writes both payloads. Called on every table state change. */
export function writePersistedState(
  state: GridState,
  persistence?: TMDataGridPersistence,
): void {
  const storage = resolveStorage(persistence);
  if (!storage) return;
  const { data, settings } = resolveKeys(persistence);
  const serialize = persistence?.serialize ?? defaultSerialize;
  writeSlices(storage, data, state, serialize);
  writeSlices(storage, settings, state, serialize);
}

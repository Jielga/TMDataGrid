import type { TableState } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type GridState = TableState<TMDataGridFeatures>;

/**
 * Persistence deliberately does not use Mantine's `useLocalStorage`.
 *
 * That hook owns a piece of state and returns `[value, setValue]`. Here the
 * table already owns the state and storage only mirrors it, so routing writes
 * through the hook would keep a second copy and trigger a React state update on
 * every change, including every pointer move during a column resize. Its
 * defaults also work against this use: `getInitialValueInEffect: true` delivers
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
] as const satisfies ReadonlyArray<keyof GridState>;

export type TMDataGridDataSlice = (typeof DATA_STATE_SLICES)[number];
export type TMDataGridSettingsSlice = (typeof SETTINGS_STATE_SLICES)[number];

/**
 * A storage key, optionally narrowed to a subset of its group's slices.
 *
 * - `"employees.data"` — persists every slice in the group.
 * - `["employees.data", ["sorting"]]` — persists only the listed slices.
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
    const restored: Record<string, unknown> = {};
    // Only copy the selected slices. A payload written before the selection was
    // narrowed cannot reintroduce slices the caller has since opted out of.
    for (const slice of resolved.slices) {
      if (slice in record) restored[slice] = record[slice];
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
  const payload: Record<string, unknown> = {};
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

/** State to merge into `initialState`, read once on mount. */
export function readPersistedState(
  persistence?: TMDataGridPersistence,
): Partial<GridState> {
  const storage = resolveStorage(persistence);
  const { data, settings } = resolveKeys(persistence);
  const deserialize = persistence?.deserialize ?? defaultDeserialize;
  return {
    ...readSlices(storage, settings, deserialize),
    ...readSlices(storage, data, deserialize),
  };
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

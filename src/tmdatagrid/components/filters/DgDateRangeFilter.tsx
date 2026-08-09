import { Group, TextInput } from "@mantine/core";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import { operatorTakesRangeValue } from "../../core/filterOperators";
import { TMDataGridFilterValueInput } from "./TMDataGridFilterValueInput";

/**
 * A built-in `meta.filterControl` for `date` columns: a From/To pair of
 * native date inputs writing the `between` pair — no `@mantine/dates`
 * involved, like the built-in date editor. Pair it with
 * `meta.defaultFilterOperator: "between"`; any non-range operator falls back
 * to the standard input.
 */
export function DgDateRangeFilter(args: TMDataGridFilterControlArgs) {
  const { operator, value, onChange, size, labels } = args;
  if (!operatorTakesRangeValue(operator)) {
    return <TMDataGridFilterValueInput {...args} />;
  }

  const pair: [string, string] = Array.isArray(value)
    ? [String(value[0] ?? ""), String(value[1] ?? "")]
    : ["", ""];

  return (
    <Group gap={4} wrap="nowrap" align="flex-start">
      <TextInput
        label={labels.filterFrom}
        size={size}
        w={88}
        type="date"
        value={pair[0]}
        onChange={(event) => onChange([event.currentTarget.value, pair[1]])}
      />
      <TextInput
        label={labels.filterTo}
        size={size}
        w={88}
        type="date"
        value={pair[1]}
        onChange={(event) => onChange([pair[0], event.currentTarget.value])}
      />
    </Group>
  );
}

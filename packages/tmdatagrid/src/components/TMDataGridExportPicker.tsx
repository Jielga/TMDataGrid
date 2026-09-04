import { Button, Checkbox, Group, Modal, Stack } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getColumnLabel } from "../core/columnUtils";
import {
  getExportableColumns,
  type TMDataGridExportPickerRequest,
} from "../core/export";
import { useTMDataGridExport } from "../useTMDataGridExport";

/**
 * The column picker behind `columns="custom"` on the export menu items: every
 * exportable column as a checkbox, the visible ones ticked, and an Export
 * button that downloads the ticked ones.
 *
 * Mounted once by the root and driven by `ui.state.exportPicker`, because the
 * menu item that opens it unmounts with the dropdown on the click. The form
 * inside is keyed on the request, so each opening starts from the visible
 * columns again rather than from the last choice.
 */
export function TMDataGridExportPicker() {
  const { ui, labels } = useTMDataGridContext();
  const request = useSelector(ui, (state) => state.exportPicker);

  return (
    <Modal
      opened={request !== null}
      onClose={() => ui.actions.closeExportPicker()}
      title={labels.exportPickerTitle}
      size="sm"
    >
      {request && <PickerForm request={request} />}
    </Modal>
  );
}

function PickerForm({ request }: { request: TMDataGridExportPickerRequest }) {
  const { table, ui, labels, controlSize } = useTMDataGridContext();
  const { exportAll, exportSelected } = useTMDataGridExport(request.options);
  const columns = getExportableColumns(table);
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        columns
          .filter((column) => column.getIsVisible())
          .map((column) => column.id),
      ),
  );

  const toggle = (columnId: string, on: boolean) =>
    setChecked((previous) => {
      const next = new Set(previous);
      if (on) next.add(columnId);
      else next.delete(columnId);
      return next;
    });

  const confirm = async () => {
    // Render order, whatever order the boxes were ticked in.
    const ids = columns
      .filter((column) => checked.has(column.id))
      .map((column) => column.id);
    const run = request.rows === "selected" ? exportSelected : exportAll;
    await run({ columns: ids });
    ui.actions.closeExportPicker();
  };

  return (
    <Stack gap="sm" data-dg-part="export-picker">
      <Stack gap="xs">
        {columns.map((column) => (
          <Checkbox
            key={column.id}
            size={controlSize}
            label={getColumnLabel(column)}
            checked={checked.has(column.id)}
            onChange={(event) => toggle(column.id, event.currentTarget.checked)}
            data-dg-part="export-column"
            data-column-id={column.id}
          />
        ))}
      </Stack>
      <Group justify="flex-end" gap="xs">
        <Button
          variant="default"
          size={controlSize}
          onClick={() => ui.actions.closeExportPicker()}
          data-dg-part="export-picker-cancel"
        >
          {labels.exportPickerCancel}
        </Button>
        <Button
          size={controlSize}
          disabled={checked.size === 0}
          onClick={() => void confirm()}
          data-dg-part="export-picker-confirm"
        >
          {labels.exportPickerConfirm}
        </Button>
      </Group>
    </Stack>
  );
}

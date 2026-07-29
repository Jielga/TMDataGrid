import { SegmentedControl, useMantineColorScheme } from "@mantine/core";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";

/** Light / dark / system toggle, pinned to the bottom of the sidebar. */
export function ColorSchemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      fullWidth
      size="xs"
      value={colorScheme}
      onChange={(value) => setColorScheme(value as "light" | "dark" | "auto")}
      data={[
        { value: "light", label: <IconSun size={15} stroke={1.6} /> },
        { value: "dark", label: <IconMoon size={15} stroke={1.6} /> },
        { value: "auto", label: <IconDeviceDesktop size={15} stroke={1.6} /> },
      ]}
    />
  );
}

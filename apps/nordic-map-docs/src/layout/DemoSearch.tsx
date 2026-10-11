import { Spotlight } from "@mantine/spotlight";
import type { SpotlightActionData } from "@mantine/spotlight";
import { IconSearch } from "@tabler/icons-react";
import { demos } from "../demos/demoRegistry.ts";

const actions: SpotlightActionData[] = demos.map((demo) => {
  return {
    id: demo.id,
    label: demo.label,
    description: demo.description,
    keywords: [demo.group],
    onClick: () => {
      window.location.hash = demo.id;
    },
  };
});

export function DemoSearch() {
  return (
    <Spotlight
      actions={actions}
      nothingFound="No demos found"
      searchProps={{
        leftSection: <IconSearch size={18} stroke={1.5} />,
        placeholder: "Search demos...",
      }}
    />
  );
}

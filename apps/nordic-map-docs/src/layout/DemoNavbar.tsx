import { AppShell, NavLink, ScrollArea, Stack, Text } from "@mantine/core";
import { demos, groupDemos } from "../demos/demoRegistry.ts";

type DemoNavbarProps = {
  activeDemoId: string | undefined;
  /** Called after a link is clicked, used to close the navbar on mobile */
  onNavigate: () => void;
};

const demoGroups = groupDemos(demos);

export function DemoNavbar({ activeDemoId, onNavigate }: DemoNavbarProps) {
  return (
    <AppShell.Section grow component={ScrollArea} p="sm">
      <Stack gap="md">
        {demoGroups.map((group) => {
          return (
            <Stack key={group.name} gap={2}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" pb={4}>
                {group.name}
              </Text>
              {group.demos.map((demo) => {
                return (
                  <NavLink
                    key={demo.id}
                    component="a"
                    href={`#${demo.id}`}
                    label={demo.label}
                    active={demo.id === activeDemoId}
                    onClick={onNavigate}
                  />
                );
              })}
            </Stack>
          );
        })}
      </Stack>
    </AppShell.Section>
  );
}

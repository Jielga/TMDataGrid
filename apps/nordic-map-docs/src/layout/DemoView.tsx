import { Badge, Center, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { Suspense } from "react";
import type { Demo } from "../demos/demoRegistry.ts";

type DemoViewProps = {
  demo: Demo;
};

export function DemoView({ demo }: DemoViewProps) {
  const DemoComponent = demo.component;

  return (
    <Stack gap="lg" maw={1100}>
      <Stack gap={4}>
        <Group gap="sm">
          <Title order={2}>{demo.label}</Title>
          <Badge variant="light">{demo.group}</Badge>
        </Group>
        <Text c="dimmed">{demo.description}</Text>
      </Stack>

      <Paper withBorder p="lg">
        <Suspense
          fallback={
            <Center mih={120}>
              <Loader size="sm" />
            </Center>
          }
        >
          {/* key resets demo state when switching between demos */}
          <DemoComponent key={demo.id} />
        </Suspense>
      </Paper>
    </Stack>
  );
}

import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { exampleTopicsByCategory } from "./examplePages";

/**
 * The landing page for the examples — every topic as a card, grouped the way
 * the sidebar groups them. It exists because a tree of 24 entries answers
 * "where is the thing I need" badly on a first visit.
 */
export function ExamplesIndexPage() {
  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <Stack gap="xl" p={{ base: "sm", md: "lg" }} maw={1100}>
        <Stack gap={4}>
          <Title order={2}>Examples</Title>
          <Text c="dimmed">
            One demo, one idea, with the source that produced it. For every
            feature at once, see the{" "}
            <Text component={Link} to="/playground" c="blue" inherit>
              playground
            </Text>
            .
          </Text>
        </Stack>

        {exampleTopicsByCategory().map(({ category, topics }) => (
          <Stack key={category} gap="sm">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              {category}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {topics.map((topic) => (
                <Card
                  key={topic.id}
                  component={Link}
                  to={`/examples/${topic.id}`}
                  withBorder
                  padding="md"
                  radius="sm"
                >
                  <Text fw={600} size="sm">
                    {topic.label}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {topic.description}
                  </Text>
                  <Text size="xs" c="dimmed" mt="sm">
                    {topic.demos.length}{" "}
                    {topic.demos.length === 1 ? "demo" : "demos"}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </div>
  );
}

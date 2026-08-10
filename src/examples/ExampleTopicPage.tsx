import { Anchor, Divider, Stack, Text, Title } from "@mantine/core";
import { Link, useParams } from "@tanstack/react-router";
import { Fragment } from "react";
import { DemoBlock } from "./DemoBlock";
import { findExampleTopic } from "./examplePages";

/**
 * One topic: a heading, the reference page it demonstrates, and its demos.
 *
 * The page scrolls; each demo is a fixed height. Anything a demo needs to
 * explain it explains in `examplePages.ts`, which is why there is no prose
 * here at all.
 */
export function ExampleTopicPage() {
  const { topicId } = useParams({ from: "/examples/$topicId" });
  const topic = findExampleTopic(topicId);

  if (!topic) {
    return (
      <Stack p="lg" gap="xs">
        <Title order={2}>Not found</Title>
        <Text c="dimmed">
          No example called “{topicId}”.{" "}
          <Anchor component={Link} to="/examples">
            All examples
          </Anchor>
        </Text>
      </Stack>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <Stack gap="lg" p={{ base: "sm", md: "lg" }} maw={1100}>
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {topic.category}
          </Text>
          <Title order={2}>{topic.label}</Title>
          <Text c="dimmed">{topic.description}</Text>
          {topic.docs && (
            <Text size="sm" mt={4}>
              <Anchor component={Link} to={`/docs/${topic.docs}`}>
                Reference documentation ↗
              </Anchor>
            </Text>
          )}
        </Stack>

        {topic.demos.map((demo, index) => (
          <Fragment key={demo.file}>
            {index > 0 && <Divider />}
            <DemoBlock demo={demo} />
          </Fragment>
        ))}
      </Stack>
    </div>
  );
}

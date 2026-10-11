import { Button, Flex, Group, List, Pill, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { SwedenMap } from "@jielga/nordic-map";
import { cities } from "../cities.ts";

function cityLabel(id: string): string {
  return (
    cities.find((city) => {
      return city.id === id;
    })?.label ?? id
  );
}

export function SwedenMapDemo() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Group align="flex-start" gap="xl" wrap="wrap">
      <Flex h={740}>
        <SwedenMap
          pins={cities}
          selected={selected}
          onSelectionChange={setSelected}
        />
        <SwedenMap
          pins={cities}
          background="transparent"
          landFill="#0b1f3a"
          borderColor="transparent"
          selected={selected}
          pinRadius={3}
          pinColor="yellow"
          onSelectionChange={setSelected}
        />
      </Flex>

      <Stack gap="md" maw={360}>
        <List size="sm" spacing={4}>
          <List.Item>
            Drag a box to select pins. Shift, Ctrl or Cmd + drag adds to the
            selection.
          </List.Item>
          <List.Item>
            Click a pin to toggle it. Click the empty map to clear.
          </List.Item>
          <List.Item>
            Mouse wheel or pinch to zoom. Right mouse drag or two fingers to
            pan.
          </List.Item>
        </List>

        <Group justify="space-between">
          <Text fw={500}>Selected ({selected.length})</Text>
          <Button
            variant="subtle"
            size="compact-sm"
            disabled={selected.length === 0}
            onClick={() => {
              setSelected([]);
            }}
          >
            Clear
          </Button>
        </Group>

        {selected.length === 0 ? (
          <Text size="sm" c="dimmed">
            No pins selected
          </Text>
        ) : (
          <Pill.Group>
            {selected.map((id) => {
              return (
                <Pill
                  key={id}
                  withRemoveButton
                  onRemove={() => {
                    setSelected((current) => {
                      return current.filter((item) => {
                        return item !== id;
                      });
                    });
                  }}
                >
                  {cityLabel(id)}
                </Pill>
              );
            })}
          </Pill.Group>
        )}
      </Stack>
    </Group>
  );
}

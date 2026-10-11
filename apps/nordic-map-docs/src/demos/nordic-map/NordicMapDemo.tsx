import { Box, Button, Group, List, Pill, Slider, Stack, Tabs, Text, useComputedColorScheme } from "@mantine/core";
import { useState } from "react";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { cities } from "../cities.ts";
import { ColorControls } from "./ColorControls.tsx";
import { LayerControl } from "./LayerControl.tsx";
import { toVisibility } from "./layerSetting.ts";
import type { LayerSetting } from "./layerSetting.ts";
import { darkColors, lightColors } from "./mapColors.ts";
import type { MapColors } from "./mapColors.ts";

const allZooms: LayerSetting = { enabled: true, range: [1, 50] };

function cityLabel(id: string): string {
  return (
    cities.find((city) => {
      return city.id === id;
    })?.label ?? id
  );
}

export function NordicMapDemo() {
  // Read on the first render, so a dark page does not start with the light colors
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [border, setBorder] = useState<LayerSetting>(allZooms);
  const [borderWidth, setBorderWidth] = useState(1);
  const [roads, setRoads] = useState<LayerSetting>(allZooms);
  const [roadLabels, setRoadLabels] = useState<LayerSetting>(allZooms);
  // The map follows the site's light or dark scheme until colors are picked here
  const [pickedColors, setPickedColors] = useState<MapColors | null>(null);
  const colors = pickedColors ?? (colorScheme === "dark" ? darkColors : lightColors);

  return (
    <Group align="flex-start" gap="xl" wrap="wrap">
      <Box h={740} miw={320} style={{ flex: "1 1 420px" }}>
        <NordicMap
          source={swedenOsmSource}
          label="Map of Sweden"
          pins={cities}
          selected={selected}
          onSelectionChange={setSelected}
          showBorder={toVisibility(border)}
          borderWidth={borderWidth}
          showRoads={toVisibility(roads)}
          showRoadLabels={toVisibility(roadLabels)}
          onZoomChange={setZoom}
          {...colors}
        />
      </Box>

      <Stack gap="sm" w={320}>
        <Text size="sm" c="dimmed">
          Zoom {zoom.toFixed(1)}×
        </Text>

        <Tabs defaultValue="layers" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="layers">Layers</Tabs.Tab>
            <Tabs.Tab value="colors">Colors</Tabs.Tab>
            <Tabs.Tab value="selection">Pins ({selected.length})</Tabs.Tab>
            <Tabs.Tab value="help">Help</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="layers" pt="md">
            <LayerControl label="Swedish coast and border" value={border} onChange={setBorder} />
            <Stack gap={4} pb="lg">
              <Text size="sm">Border width: {borderWidth} px</Text>
              <Slider
                size="sm"
                min={0.25}
                max={3}
                step={0.25}
                thumbLabel="Border width"
                value={borderWidth}
                onChange={setBorderWidth}
                label={(value) => {
                  return `${value} px`;
                }}
              />
            </Stack>
            <LayerControl label="Roads" value={roads} onChange={setRoads} />
            <LayerControl label="Road signs" value={roadLabels} onChange={setRoadLabels} />
            <Text size="xs" c="dimmed">
              Road signs only show where the roads show too.
            </Text>
          </Tabs.Panel>

          <Tabs.Panel value="colors" pt="md">
            <ColorControls value={colors} onChange={setPickedColors} />
          </Tabs.Panel>

          <Tabs.Panel value="selection" pt="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm">Drag a box on the map, or click pins.</Text>
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
          </Tabs.Panel>

          <Tabs.Panel value="help" pt="md">
            <Stack gap="sm">
              <List size="sm" spacing={4}>
                <List.Item>Drag a box to select pins. Shift, Ctrl or Cmd + drag adds to the selection.</List.Item>
                <List.Item>Click a pin to toggle it. Click the empty map to clear.</List.Item>
                <List.Item>Mouse wheel, trackpad pinch or two fingers to zoom, up to 50 times.</List.Item>
                <List.Item>
                  Right mouse drag, Space + drag or two fingers to pan. Let go while moving and the map glides.
                </List.Item>
                <List.Item>Keyboard: + and - zoom, arrow keys pan, 0 shows the whole map.</List.Item>
              </List>
              <Text size="sm" c="dimmed">
                OpenStreetMap data in three detail levels. Zoom in to see national and regional roads, ring roads
                around the big cities, smaller lakes and a finer coastline.
              </Text>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Group>
  );
}

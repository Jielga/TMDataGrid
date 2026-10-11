import { Alert, Code, Stack, Text, Title } from "@mantine/core";

const INSTALL = "npm install @jielga/nordic-map";

const STYLES = `import "@mantine/core/styles.css";
import "@jielga/nordic-map/styles.css";`;

const USAGE = `import { NordicMap, swedenOsmSource, type NordicMapPin } from "@jielga/nordic-map";
import { useState } from "react";

const pins: NordicMapPin[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm" },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg" },
];

export function Offices() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div style={{ height: 600 }}>
      <NordicMap
        source={swedenOsmSource}
        label="Offices"
        pins={pins}
        selected={selected}
        onSelectionChange={setSelected}
      />
    </div>
  );
}`;

/** The front page: installation and a first map. The demos are in the sidebar. */
export function WelcomeView() {
  return (
    <Stack gap="md" maw={760}>
      <Title order={2}>Getting started</Title>
      <Text>
        React components that render offline maps of the Nordic countries, with GPS pins and drag selection. The map
        data ships with the package, so no tile server or API key is needed.
      </Text>
      <Alert variant="light" title="Not published yet">
        The package is not on npm yet. The demos in the sidebar run the current source.
      </Alert>

      <Title order={3}>Installation</Title>
      <Code block>{INSTALL}</Code>
      <Text>
        Peer dependencies: <Code>react</Code> and <Code>react-dom</Code> (19.1 or later), <Code>@mantine/core</Code>{" "}
        and <Code>@tabler/icons-react</Code>. Import the stylesheet once, after Mantine&apos;s, and render the maps
        inside a <Code>MantineProvider</Code>:
      </Text>
      <Code block>{STYLES}</Code>

      <Title order={3}>A first map</Title>
      <Text>
        <Code>NordicMap</Code> fills its container, so give the container a height:
      </Text>
      <Code block>{USAGE}</Code>
      <Text>
        Define <Code>source</Code> outside the component; a new object on every render reloads every map cell.
      </Text>

      <Title order={3}>Data licenses</Title>
      <Text>
        The OpenStreetMap data is © OpenStreetMap contributors, under the Open Database License (ODbL). A map that shows
        it must credit &quot;© OpenStreetMap contributors&quot;; <Code>swedenOsmSource</Code> sets this credit, and{" "}
        <Code>NordicMap</Code> shows it in the corner. The Natural Earth data that <Code>SwedenMap</Code> draws is in
        the public domain.
      </Text>
    </Stack>
  );
}

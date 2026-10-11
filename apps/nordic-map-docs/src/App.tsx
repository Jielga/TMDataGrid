import { MantineProvider } from "@mantine/core";
import { AppLayout } from "./layout/AppLayout.tsx";
import { theme } from "./theme.ts";

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <AppLayout />
    </MantineProvider>
  );
}

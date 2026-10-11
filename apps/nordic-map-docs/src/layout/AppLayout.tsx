import { AppShell } from "@mantine/core";
import { useDisclosure, useHash } from "@mantine/hooks";
import { findDemo } from "../demos/demoRegistry.ts";
import { AppHeader } from "./AppHeader.tsx";
import { DemoNavbar } from "./DemoNavbar.tsx";
import { DemoSearch } from "./DemoSearch.tsx";
import { DemoView } from "./DemoView.tsx";
import { WelcomeView } from "./WelcomeView.tsx";

export function AppLayout() {
  const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] = useDisclosure();
  const [hash] = useHash();
  const activeDemo = findDemo(hash.replace(/^#/, ""));

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !navbarOpened } }}
      padding="lg"
    >
      {/* The shared header draws its own border. */}
      <AppShell.Header withBorder={false}>
        <AppHeader navbarOpened={navbarOpened} onToggleNavbar={toggleNavbar} />
      </AppShell.Header>

      <AppShell.Navbar>
        <DemoNavbar activeDemoId={activeDemo?.id} onNavigate={closeNavbar} />
      </AppShell.Navbar>

      <AppShell.Main>{activeDemo ? <DemoView demo={activeDemo} /> : <WelcomeView />}</AppShell.Main>

      <DemoSearch />
    </AppShell>
  );
}

import { Burger } from "@mantine/core";
import { SiteHeader } from "docs-shell/SiteHeader.tsx";
import { SearchButton } from "./SearchButton.tsx";

type AppHeaderProps = {
  navbarOpened: boolean;
  onToggleNavbar: () => void;
};

/** The shared site header, with the navigation toggle for narrow screens and the demo search. */
export function AppHeader({ navbarOpened, onToggleNavbar }: AppHeaderProps) {
  return (
    <SiteHeader
      site="nordic-map"
      start={
        <Burger
          opened={navbarOpened}
          onClick={onToggleNavbar}
          hiddenFrom="sm"
          size="sm"
          aria-label="Toggle navigation"
        />
      }
    >
      <SearchButton />
    </SiteHeader>
  );
}

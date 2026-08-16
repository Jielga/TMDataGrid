import { Badge, Group } from "@mantine/core";
import {
  buildColor,
  NPM_PAGE,
  useBuildStatus,
  useDistTags,
} from "./packageStatus";

/**
 * Version and build state for the front page.
 *
 * While the package is in prerelease the `beta` tag is ahead of `latest`, and
 * both are worth showing here — `latest` alone reads as abandoned, `beta` alone
 * hides what `npm install` actually gives you. The header shows only the
 * headline one.
 */
export function ProjectStatus() {
  const tags = useDistTags();
  const build = useBuildStatus();

  const showBeta = tags?.beta && tags.beta !== tags.latest;

  return (
    <Group gap="xs">
      {tags?.latest && (
        <Badge
          component="a"
          href={NPM_PAGE}
          variant="light"
          color="gray"
          style={{ cursor: "pointer" }}
        >
          npm {tags.latest}
        </Badge>
      )}
      {showBeta && (
        <Badge
          component="a"
          href={`${NPM_PAGE}/v/${tags.beta}`}
          variant="light"
          color="grape"
          style={{ cursor: "pointer" }}
        >
          beta {tags.beta}
        </Badge>
      )}
      {build && (
        <Badge
          component="a"
          href={build.url}
          variant="light"
          color={buildColor(build.conclusion)}
          style={{ cursor: "pointer" }}
        >
          build {build.conclusion.replace(/_/g, " ")}
        </Badge>
      )}
    </Group>
  );
}

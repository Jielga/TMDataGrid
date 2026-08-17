import { Text } from "@mantine/core";
import { useEffect, useState } from "react";
import classes from "./DocsToc.module.css";
import { extractHeadings } from "./headings";

/**
 * The table of contents rail: every `##` and `###` on the page, as deep links.
 *
 * Plain `<a href="#slug">` rather than router links - the target is on this
 * page, so the browser's own anchor handling scrolls the article and writes
 * the hash, which is exactly the shareable deep link that is wanted. The
 * router only wants to hear about navigation between pages.
 */

/**
 * Marks the heading the reader is at. `rootMargin` pulls the observation band
 * up to a strip near the top of the viewport, so the active entry is the
 * heading you are reading under rather than whichever one is merely on screen.
 */
function useActiveHeading(slugKey: string): string | undefined {
  const [active, setActive] = useState<string>();

  // The comma-joined slugs rather than the array: a fresh array every render
  // would re-observe every render, and slugs cannot contain a comma.
  useEffect(() => {
    const headings = slugKey
      .split(",")
      .map((slug) => document.getElementById(slug))
      .filter((element) => element !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [slugKey]);

  return active;
}

export function DocsToc({ source }: { source: string }) {
  const headings = extractHeadings(source);
  const active = useActiveHeading(
    headings.map((heading) => heading.slug).join(","),
  );

  // One heading is not a table of contents, it is a duplicate of the title.
  if (headings.length < 2) return null;

  return (
    <nav className={classes.rail} aria-label="On this page">
      <Text className={classes.label} size="xs" fw={600} c="dimmed">
        ON THIS PAGE
      </Text>
      <ul className={classes.list}>
        {headings.map((heading) => (
          <li key={heading.slug}>
            <a
              href={`#${heading.slug}`}
              className={classes.link}
              data-level={heading.level}
              data-active={heading.slug === active || undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

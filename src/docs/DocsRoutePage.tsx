import { Text } from "@mantine/core";
import { useParams } from "@tanstack/react-router";
import { DocsPage } from "./DocsPage";
import { findDocsPage } from "./docsPages";

/** Route component for `/docs/$docId`. */
export function DocsRoutePage() {
  const { docId } = useParams({ from: "/docs/$docId" });
  const page = findDocsPage(docId);

  if (!page) {
    return (
      <Text p="xl" c="dimmed">
        No documentation page named “{docId}”.
      </Text>
    );
  }

  return <DocsPage source={page.source} />;
}

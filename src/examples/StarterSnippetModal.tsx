import { Button, Code, Group, Modal, Text } from "@mantine/core";
import { useState } from "react";
import {
  buildStarterSnippet,
  type StarterSnippetConfig,
} from "./starterSnippet";

/** Deprecated but still the widest-reaching copy path. Returns whether it took. */
function copyViaTextarea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  // Off-screen rather than hidden: `display: none` is not selectable, and
  // execCommand("copy") copies the selection.
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/**
 * "Give me this table as code" — renders the current switch positions as the
 * smallest file that reproduces them, ready to paste.
 */
export function StarterSnippetModal({
  config,
  opened,
  onClose,
}: {
  config: StarterSnippetConfig;
  opened: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const snippet = buildStarterSnippet(config);

  /**
   * `navigator.clipboard` is the good path but it is refused more often than it
   * looks: it needs a secure context, so serving the example over plain http on
   * a LAN address loses it, and it throws if the document is not focused. The
   * execCommand fallback survives both. A silent no-op on a Copy button is the
   * one outcome worth ruling out.
   */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setStatus("copied");
    } catch {
      setStatus(copyViaTextarea(snippet) ? "copied" : "failed");
    }
    // Long enough to read, short enough that the button is ready again if the
    // paste went somewhere wrong.
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Starter code for this configuration"
      size="lg"
    >
      <Text size="sm" c="dimmed" mb="xs">
        Only what differs from a default is included, so leaving every switch
        alone gives you the shortest version.
      </Text>

      <Code block style={{ maxHeight: "55vh", overflow: "auto" }}>
        {snippet}
      </Code>

      <Group justify="flex-end" mt="md">
        {status === "failed" && (
          <Text size="xs" c="orange">
            Clipboard blocked — select the code above and copy it.
          </Text>
        )}
        <Button size="xs" variant="default" onClick={onClose}>
          Close
        </Button>
        <Button
          size="xs"
          color={status === "failed" ? "orange" : undefined}
          onClick={copy}
        >
          {status === "copied" ? "Copied" : "Copy"}
        </Button>
      </Group>
    </Modal>
  );
}

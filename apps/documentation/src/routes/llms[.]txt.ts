import { createFileRoute } from "@tanstack/react-router";

import { source } from "@/lib/source";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const pageLines = source
          .getPages()
          .map(
            (page) =>
              `- [${page.data.title}](${page.url}): ${page.data.description}`
          );
        const lines = ["# Documentation", "", ...pageLines];
        return new Response(lines.join("\n"));
      },
    },
  },
});

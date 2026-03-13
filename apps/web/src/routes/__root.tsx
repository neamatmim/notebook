/// <reference types="vite/client" />
// import { Devtools } from "@notebook/devtools";
import { Toaster } from "@notebook/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import type { orpc } from "@/utils/orpc";

import appCss from "@/styles.css?url";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  shellComponent: RootLayout,
  component: RootDocument,
  head: () => ({
    meta: [
      {
        charSet: "utf8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Notebook",
      },
    ],
    links: [
      {
        href: appCss,
        rel: "stylesheet",
      },
    ],
  }),
});

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootDocument() {
  return (
    <>
      <div className="grid h-svh grid-rows-[auto_1fr]">
        <Outlet />
      </div>
      <Toaster richColors />
      {/* <Devtools /> */}
    </>
  );
}

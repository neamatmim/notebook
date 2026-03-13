import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

export function Devtools() {
  return (
    <TanStackDevtools
      config={{
        position: "top-left",
      }}
      plugins={[
        {
          name: "TanStack Query",
          render: <ReactQueryDevtoolsPanel />,
        },
        {
          name: "TanStack Router",
          render: <TanStackRouterDevtoolsPanel />,
        },
        // {
        //   name: "TanStack Form",
        //   render: <ReactFormDevtoolsPanel />,
        // },
      ]}
    />
  );
}

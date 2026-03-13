import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

// import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
// import "./styles.css";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
import { orpc, queryClient } from "./utils/orpc";

export const getRouter = () => {
  //  const queryClient = new QueryClient();
  const router = createRouter({
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    context: { orpc, queryClient },
    defaultNotFoundComponent: () => <div>Not Found</div>,
    defaultPendingComponent: () => <Loader />,
    defaultPreloadStaleTime: 0,
    // defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
  });
  // setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

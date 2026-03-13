import { createFileRoute, Outlet } from "@tanstack/react-router";

function CycleCountsLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_app/inventory/cycle-counts")({
  component: CycleCountsLayout,
});

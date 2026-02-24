import { createFileRoute, Outlet } from "@tanstack/react-router";

function CycleCountsLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/inventory/cycle-counts")({
  component: CycleCountsLayout,
});

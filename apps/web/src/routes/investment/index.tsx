import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  DollarSign,
  FolderOpen,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  draft: "bg-gray-100 text-gray-700",
  funding: "bg-yellow-100 text-yellow-700",
};

function InvestmentOverview() {
  const { data: projects, isLoading } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: { limit: 10, offset: 0 },
    })
  );

  const activeProjects =
    projects?.items.filter((p) => p.status === "active") ?? [];
  const totalRaised =
    projects?.items.reduce((sum, p) => sum + Number(p.raisedAmount), 0) ?? 0;

  const kpis = [
    {
      icon: FolderOpen,
      label: "Total Projects",
      value: isLoading ? "…" : String(projects?.total ?? 0),
    },
    {
      icon: TrendingUp,
      label: "Active Projects",
      value: isLoading ? "…" : String(activeProjects.length),
    },
    {
      icon: DollarSign,
      label: "Total Capital Raised",
      value: isLoading ? "…" : `$${totalRaised.toLocaleString()}`,
    },
    {
      icon: BarChart3,
      label: "Funding Projects",
      value: isLoading
        ? "…"
        : String(
            projects?.items.filter((p) => p.status === "funding").length ?? 0
          ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Investment Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Target</th>
                    <th className="py-2 pr-3 font-medium">Raised</th>
                    <th className="py-2 pr-3 font-medium">Risk</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects?.items.map((project) => (
                    <tr key={project.id} className="hover:bg-muted/40 border-b">
                      <td className="py-2 pr-3 font-medium">{project.name}</td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {project.type.replaceAll("_", " ")}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        ${Number(project.targetAmount).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        ${Number(project.raisedAmount).toLocaleString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {project.riskLevel?.replaceAll("_", " ") ?? "—"}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[project.status] ?? ""}`}
                        >
                          {project.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!projects?.items.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No projects yet. Create your first investment project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/investment/")({
  component: InvestmentOverview,
});

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Calendar, CheckSquare, FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

function AccountingOverview() {
  const { data: summary, isLoading } = useQuery(
    orpc.accounting.settings.summary.queryOptions({ input: {} })
  );

  const kpis = [
    {
      icon: BookOpen,
      label: "Chart of Accounts",
      value: isLoading ? "…" : String(summary?.accountCount ?? 0),
    },
    {
      icon: Calendar,
      label: "Current Fiscal Year",
      value: isLoading ? "…" : (summary?.currentFiscalYearName ?? "None set"),
    },
    {
      icon: CheckSquare,
      label: "Open Periods",
      value: isLoading ? "…" : String(summary?.openPeriodCount ?? 0),
    },
    {
      icon: FileText,
      label: "Posted Journal Entries",
      value: isLoading ? "…" : String(summary?.totalPostedEntries ?? 0),
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Accounting Overview</h1>
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
    </div>
  );
}

export const Route = createFileRoute("/accounting/")({
  component: AccountingOverview,
});

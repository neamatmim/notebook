import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

function ReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { data: projects } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: { limit: 100, offset: 0 },
    })
  );

  const { data: summary, isLoading: summaryLoading } = useQuery({
    ...orpc.investment.reports.projectSummary.queryOptions({
      input: { projectId: selectedProjectId },
    }),
    enabled: !!selectedProjectId,
  });

  const { data: cashFlow, isLoading: cashFlowLoading } = useQuery({
    ...orpc.investment.reports.cashFlowStatement.queryOptions({
      input: { projectId: selectedProjectId },
    }),
    enabled: !!selectedProjectId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Investment Reports</h1>
        <Select
          value={selectedProjectId || "__none__"}
          onValueChange={(v) =>
            setSelectedProjectId(v === "__none__" ? "" : (v ?? ""))
          }
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select project</SelectItem>
            {projects?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedProjectId && (
        <p className="text-muted-foreground py-12 text-center">
          Select a project to view its financial metrics.
        </p>
      )}

      {selectedProjectId && summaryLoading && (
        <p className="text-muted-foreground py-12 text-center">Loading…</p>
      )}

      {summary && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Invested
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${summary.totalInvested.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Funding Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.fundingPercentage.toFixed(1)}%
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.min(summary.fundingPercentage, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Investors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.activeInvestorCount}
                </div>
                <p className="text-muted-foreground text-xs">
                  of {summary.investorCount} total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Distributions Paid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${summary.totalDistributionsPaid.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Metrics */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  ROI (Return on Investment)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold ${summary.roi >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {summary.roi.toFixed(2)}%
                </div>
                <p className="text-muted-foreground text-xs">
                  Based on distributions paid vs. invested
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  IRR (Internal Rate of Return)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold ${summary.irr >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {summary.irr !== 0 ? `${summary.irr.toFixed(2)}%` : "—"}
                </div>
                {summary.hurdleRate !== null && (
                  <p className="text-muted-foreground text-xs">
                    Hurdle rate: {summary.hurdleRate}%
                    {summary.irr >= summary.hurdleRate ? (
                      <span className="ml-1 text-green-600">
                        ✓ Exceeds hurdle
                      </span>
                    ) : (
                      <span className="ml-1 text-red-600">✗ Below hurdle</span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  NPV (Net Present Value)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold ${summary.npv >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {summary.npv !== 0
                    ? `$${summary.npv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "—"}
                </div>
                <p className="text-muted-foreground text-xs">
                  Using{" "}
                  {summary.project.discountRate
                    ? `${Number(summary.project.discountRate)}%`
                    : "10%"}{" "}
                  discount rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Milestone Completion */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Milestone Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(summary.milestoneCompletionAvg, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium">
                  {summary.milestoneCompletionAvg.toFixed(1)}% average
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Cash Flow Statement */}
      {selectedProjectId && cashFlow && cashFlow.periods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash Flow Statement</CardTitle>
          </CardHeader>
          <CardContent>
            {cashFlowLoading ? (
              <p className="text-muted-foreground py-4 text-center">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Proj. Inflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Proj. Outflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Actual Inflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Actual Outflow
                      </th>
                      <th className="py-2 font-medium text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.periods.map((period) => (
                      <tr
                        key={period.id}
                        className="hover:bg-muted/40 border-b"
                      >
                        <td className="text-muted-foreground py-2 pr-3">
                          {period.periodNumber}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {new Date(period.periodDate).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          ${period.projectedInflow.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          ${period.projectedOutflow.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          ${period.actualInflow.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          ${period.actualOutflow.toLocaleString()}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${period.varianceInflow - period.varianceOutflow >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          $
                          {(
                            period.varianceInflow - period.varianceOutflow
                          ).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/investment/reports")({
  component: ReportsPage,
});

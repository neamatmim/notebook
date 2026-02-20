import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

type ReportTab = "balance-sheet" | "profit-loss" | "trial-balance";

function toApiDate(d: string, endOfDay = false): string {
  return endOfDay ? `${d}T23:59:59.999Z` : `${d}T00:00:00.000Z`;
}

function fmtDollar(v: string | number | null | undefined): string {
  if (v === null || v === undefined) {
    return "$0.00";
  }
  return `$${Number(v).toFixed(2)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function exportCSV(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("trial-balance");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [asOf, setAsOf] = useState(today());

  const tbQuery = useQuery(
    orpc.accounting.reports.trialBalance.queryOptions({
      input: { from: toApiDate(from), to: toApiDate(to, true) },
      enabled: tab === "trial-balance",
    })
  );

  const plQuery = useQuery(
    orpc.accounting.reports.profitAndLoss.queryOptions({
      input: { from: toApiDate(from), to: toApiDate(to, true) },
      enabled: tab === "profit-loss",
    })
  );

  const bsQuery = useQuery(
    orpc.accounting.reports.balanceSheet.queryOptions({
      input: { asOf: toApiDate(asOf, true) },
      enabled: tab === "balance-sheet",
    })
  );

  const handleExportTB = () => {
    if (!tbQuery.data) {
      return;
    }
    const rows = [
      ["Code", "Account", "Type", "Debit", "Credit", "Balance"],
      ...tbQuery.data.rows.map((r) => [
        r.code,
        r.name,
        r.type,
        Number(r.totalDebit).toFixed(2),
        Number(r.totalCredit).toFixed(2),
        Number(r.balance).toFixed(2),
      ]),
    ];
    exportCSV("trial-balance.csv", rows);
  };

  const handleExportPL = () => {
    if (!plQuery.data) {
      return;
    }
    const rows = [
      ["Code", "Account", "Balance"],
      ["--- Revenue ---"],
      ...plQuery.data.revenue.map((r) => [
        r.code,
        r.name,
        Number(r.balance).toFixed(2),
      ]),
      ["--- Expenses ---"],
      ...plQuery.data.expenses.map((r) => [
        r.code,
        r.name,
        Number(r.balance).toFixed(2),
      ]),
    ];
    exportCSV("profit-loss.csv", rows);
  };

  const handleExportBS = () => {
    if (!bsQuery.data) {
      return;
    }
    const rows = [
      ["Section", "Code", "Account", "Balance"],
      ...bsQuery.data.assets.map((r) => [
        "Asset",
        r.code,
        r.name,
        Number(r.balance).toFixed(2),
      ]),
      ...bsQuery.data.liabilities.map((r) => [
        "Liability",
        r.code,
        r.name,
        Number(r.balance).toFixed(2),
      ]),
      ...bsQuery.data.equity.map((r) => [
        "Equity",
        r.code,
        r.name,
        Number(r.balance).toFixed(2),
      ]),
    ];
    exportCSV("balance-sheet.csv", rows);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Financial Reports</h1>

      {/* Tab selector */}
      <div className="flex gap-2">
        {(
          [
            ["trial-balance", "Trial Balance"],
            ["profit-loss", "Profit & Loss"],
            ["balance-sheet", "Balance Sheet"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Date range (shared for TB/P&L) or asOf (for BS) */}
      {tab !== "balance-sheet" ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Period:</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-36"
          />
          <span className="text-sm">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-36"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">As of:</span>
          <Input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="w-36"
          />
        </div>
      )}

      {/* Trial Balance */}
      {tab === "trial-balance" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trial Balance</CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportTB}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {tbQuery.isLoading ? (
              <p className="text-muted-foreground py-8 text-center">Loading…</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Account</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 text-right font-medium">Debit</th>
                    <th className="py-2 pr-3 text-right font-medium">Credit</th>
                    <th className="py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {tbQuery.data?.rows.map((r) => (
                    <tr key={r.accountId} className="border-b">
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {r.code}
                      </td>
                      <td className="py-1.5 pr-3">{r.name}</td>
                      <td className="text-muted-foreground py-1.5 pr-3 capitalize">
                        {r.type}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        {Number(r.totalDebit) > 0
                          ? fmtDollar(r.totalDebit)
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        {Number(r.totalCredit) > 0
                          ? fmtDollar(r.totalCredit)
                          : "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {fmtDollar(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={3} className="py-2">
                      Totals
                    </td>
                    <td className="py-2 text-right font-mono">
                      {fmtDollar(
                        tbQuery.data?.rows.reduce(
                          (s, r) => s + Number(r.totalDebit),
                          0
                        )
                      )}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {fmtDollar(
                        tbQuery.data?.rows.reduce(
                          (s, r) => s + Number(r.totalCredit),
                          0
                        )
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {(() => {
                        const totalDR =
                          tbQuery.data?.rows.reduce(
                            (s, r) => s + Number(r.totalDebit),
                            0
                          ) ?? 0;
                        const totalCR =
                          tbQuery.data?.rows.reduce(
                            (s, r) => s + Number(r.totalCredit),
                            0
                          ) ?? 0;
                        return Math.abs(totalDR - totalCR) < 0.01 ? (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            Balanced ✓
                          </span>
                        ) : (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            Out of balance
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profit & Loss */}
      {tab === "profit-loss" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Profit & Loss</CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportPL}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {plQuery.isLoading ? (
              <p className="text-muted-foreground py-8 text-center">Loading…</p>
            ) : (
              <div className="space-y-6">
                {/* Revenue */}
                <div>
                  <h3 className="mb-2 font-semibold text-green-700">Revenue</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {plQuery.data?.revenue.map((r) => (
                        <tr key={r.accountId} className="border-b">
                          <td className="py-1.5 pr-3 font-mono text-xs">
                            {r.code}
                          </td>
                          <td className="py-1.5">{r.name}</td>
                          <td className="py-1.5 text-right font-mono">
                            {fmtDollar(r.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td colSpan={2} className="py-2">
                          Total Revenue
                        </td>
                        <td className="py-2 text-right font-mono text-green-700">
                          {fmtDollar(plQuery.data?.totalRevenue)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Expenses */}
                <div>
                  <h3 className="mb-2 font-semibold text-red-700">Expenses</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {plQuery.data?.expenses.map((r) => (
                        <tr key={r.accountId} className="border-b">
                          <td className="py-1.5 pr-3 font-mono text-xs">
                            {r.code}
                          </td>
                          <td className="py-1.5">{r.name}</td>
                          <td className="py-1.5 text-right font-mono">
                            {fmtDollar(r.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td colSpan={2} className="py-2">
                          Total Expenses
                        </td>
                        <td className="py-2 text-right font-mono text-red-700">
                          {fmtDollar(plQuery.data?.totalExpenses)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Net Income */}
                <div
                  className={`rounded-lg p-4 ${(plQuery.data?.netIncome ?? 0) >= 0 ? "bg-green-50" : "bg-red-50"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">Net Income</span>
                    <span
                      className={`font-bold text-lg ${(plQuery.data?.netIncome ?? 0) >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      {fmtDollar(plQuery.data?.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Balance Sheet */}
      {tab === "balance-sheet" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Balance Sheet</CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportBS}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {bsQuery.isLoading ? (
              <p className="text-muted-foreground py-8 text-center">Loading…</p>
            ) : (
              <div className="space-y-6">
                {(
                  [
                    {
                      key: "assets",
                      label: "Assets",
                      color: "text-blue-700",
                      data: bsQuery.data?.assets,
                      total: bsQuery.data?.totalAssets,
                    },
                    {
                      key: "liabilities",
                      label: "Liabilities",
                      color: "text-red-700",
                      data: bsQuery.data?.liabilities,
                      total: bsQuery.data?.totalLiabilities,
                    },
                    {
                      key: "equity",
                      label: "Equity",
                      color: "text-purple-700",
                      data: bsQuery.data?.equity,
                      total: bsQuery.data?.totalEquity,
                    },
                  ] as const
                ).map((section) => (
                  <div key={section.key}>
                    <h3 className={`mb-2 font-semibold ${section.color}`}>
                      {section.label}
                    </h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {section.data?.map((r) => (
                          <tr key={r.accountId} className="border-b">
                            <td className="py-1.5 pr-3 font-mono text-xs">
                              {r.code}
                            </td>
                            <td className="py-1.5">{r.name}</td>
                            <td className="py-1.5 text-right font-mono">
                              {fmtDollar(r.balance)}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td colSpan={2} className="py-2">
                            Total {section.label}
                          </td>
                          <td
                            className={`py-2 text-right font-mono ${section.color}`}
                          >
                            {fmtDollar(section.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Balance check */}
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span>
                      Assets:{" "}
                      <strong>{fmtDollar(bsQuery.data?.totalAssets)}</strong>
                    </span>
                    <span>=</span>
                    <span>
                      Liabilities:{" "}
                      <strong>
                        {fmtDollar(bsQuery.data?.totalLiabilities)}
                      </strong>
                    </span>
                    <span>+</span>
                    <span>
                      Equity:{" "}
                      <strong>{fmtDollar(bsQuery.data?.totalEquity)}</strong>
                    </span>
                    {(() => {
                      const a = bsQuery.data?.totalAssets ?? 0;
                      const l = bsQuery.data?.totalLiabilities ?? 0;
                      const e = bsQuery.data?.totalEquity ?? 0;
                      return Math.abs(a - (l + e)) < 0.01 ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Balanced ✓
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/accounting/reports")({
  component: ReportsPage,
});

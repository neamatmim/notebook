import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/utils/orpc";
import { formatPaymentMethod } from "@/utils/print-receipt";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toApiRange(range: { from: string; to: string }) {
  return {
    from: `${range.from}T00:00:00.000Z`,
    to: `${range.to}T23:59:59.999Z`,
  };
}

function formatDollar(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `$${Number(value).toFixed(2)}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function tickDollar(v: number): string {
  if (v >= 1000) {
    return `$${(v / 1000).toFixed(0)}k`;
  }
  return `$${v}`;
}

function ReportsPage() {
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    return { from: toDateStr(from), to: toDateStr(to) };
  });

  const apiRange = toApiRange(range);

  const summaryQuery = useQuery(
    orpc.pos.analytics.salesSummary.queryOptions({ input: apiRange })
  );
  const byDayQuery = useQuery(
    orpc.pos.analytics.salesByDay.queryOptions({ input: apiRange })
  );
  const byMethodQuery = useQuery(
    orpc.pos.analytics.salesByPaymentMethod.queryOptions({ input: apiRange })
  );
  const topProdQuery = useQuery(
    orpc.pos.analytics.topProducts.queryOptions({
      input: { ...apiRange, limit: 10 },
    })
  );

  const summary = summaryQuery.data;
  const byDay = byDayQuery.data ?? [];
  const byMethod = byMethodQuery.data ?? [];
  const topProds = topProdQuery.data ?? [];

  const chartData = byDay.map((row) => ({
    date: formatDateLabel(row.date),
    revenue: Number(row.totalSales ?? 0),
  }));

  const paymentData = byMethod.map((row) => ({
    method: formatPaymentMethod(row.method),
    amount: Number(row.totalAmount ?? 0),
  }));

  function applyPreset(days: number) {
    const to = new Date();
    const from = new Date();
    if (days === 0) {
      setRange({ from: toDateStr(to), to: toDateStr(to) });
    } else {
      from.setDate(to.getDate() - (days - 1));
      setRange({ from: toDateStr(from), to: toDateStr(to) });
    }
  }

  function handleExport() {
    const lines: string[][] = [
      ["Sales Report", range.from, "to", range.to],
      [],
      ["Summary"],
      ["Metric", "Value"],
      ["Total Revenue", String(summary?.totalSales ?? "0")],
      ["Transactions", String(summary?.totalTransactions ?? "0")],
      ["Avg Order Value", String(summary?.averageTransactionValue ?? "0")],
      ["Tax", String(summary?.totalTax ?? "0")],
      ["Discounts", String(summary?.totalDiscount ?? "0")],
      [],
      ["Top Products"],
      ["Rank", "Product", "SKU", "Qty Sold", "Revenue"],
      ...topProds.map((p, i) => [
        String(i + 1),
        p.productName ?? "",
        p.productSku ?? "",
        String(p.totalQuantitySold ?? "0"),
        String(p.totalRevenue ?? "0"),
      ]),
      [],
      ["Payment Methods"],
      ["Method", "Total Amount", "Transactions"],
      ...byMethod.map((m) => [
        formatPaymentMethod(m.method),
        String(m.totalAmount ?? "0"),
        String(m.transactionCount ?? "0"),
      ]),
    ];

    const csv = lines.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `sales-report-${range.from}-${range.to}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">Sales Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => applyPreset(0)}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset(7)}>
            7 days
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset(30)}>
            30 days
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset(90)}>
            90 days
          </Button>
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded border bg-background px-2 py-1 text-sm"
            aria-label="Start date"
          />
          <span className="text-muted-foreground text-sm">→</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded border bg-background px-2 py-1 text-sm"
            aria-label="End date"
          />
          <Button size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDollar(summary?.totalSales)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary?.totalTransactions ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg Order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDollar(summary?.averageTransactionValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tax Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDollar(summary?.totalTax)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDollar(summary?.totalDiscount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Daily Sales Trend */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No data for this period
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={tickDollar}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toFixed(2)}`,
                      "Revenue",
                    ]}
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No payment data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={paymentData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={tickDollar}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="method"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={84}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toFixed(2)}`,
                      "Amount",
                    ]}
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {topProds.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No product data for this period
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-12 py-2 pr-4 text-left font-medium text-muted-foreground">
                      Rank
                    </th>
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                      Product
                    </th>
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="py-2 pr-4 text-right font-medium text-muted-foreground">
                      Qty Sold
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topProds.map((p, i) => (
                    <tr
                      key={p.productId}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-2 pr-4 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="py-2 pr-4 font-medium">{p.productName}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {p.productSku}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {Number(p.totalQuantitySold)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        ${Number(p.totalRevenue).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/pos/reports")({
  component: ReportsPage,
});

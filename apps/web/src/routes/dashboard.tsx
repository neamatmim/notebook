import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/functions/get-user";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  component: DashboardPage,
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
});

const today = new Date();
const todayStart = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate()
).toISOString();
const todayEnd = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  23,
  59,
  59
).toISOString();

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  color = "text-muted-foreground",
}: {
  color?: string;
  href: string;
  icon: React.ElementType;
  label: string;
  sub?: string;
  value: string | number;
}) {
  return (
    <Link to={href}>
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            {label}
          </CardTitle>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function DashboardPage() {
  const { session } = Route.useRouteContext();

  const [
    todaySales,
    accountingSummary,
    pendingExpenses,
    approvedInvestors,
    pendingKyc,
    activeProjects,
    productCount,
    pendingPOs,
  ] = useQueries({
    queries: [
      orpc.pos.analytics.salesSummary.queryOptions({
        input: { from: todayStart, to: todayEnd },
      }),
      orpc.accounting.settings.summary.queryOptions({ input: {} }),
      orpc.accounting.expenses.list.queryOptions({
        input: { limit: 1, offset: 0, status: "pending" },
      }),
      orpc.investment.investors.list.queryOptions({
        input: { kycStatus: "approved", limit: 1, offset: 0 },
      }),
      orpc.investment.investors.list.queryOptions({
        input: { kycStatus: "pending", limit: 1, offset: 0 },
      }),
      orpc.investment.projects.list.queryOptions({
        input: { limit: 1, offset: 0, status: "active" },
      }),
      orpc.inventory.products.list.queryOptions({
        input: { limit: 1, offset: 0 },
      }),
      orpc.inventory.purchaseOrders.list.queryOptions({
        input: { limit: 1, offset: 0 },
      }),
    ],
  });

  const salesTotal = Number(todaySales.data?.totalSales ?? 0);
  const salesCount = Number(todaySales.data?.totalTransactions ?? 0);

  const dateStr = today.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {session?.user.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{dateStr}</p>
      </div>

      {/* Action alerts */}
      {((pendingKyc.data?.total ?? 0) > 0 ||
        (pendingExpenses.data?.pagination.total ?? 0) > 0) && (
        <div className="flex flex-col gap-2">
          {(pendingKyc.data?.total ?? 0) > 0 && (
            <Link to="/investment/investors">
              <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{pendingKyc.data?.total}</strong> investor
                  {(pendingKyc.data?.total ?? 0) > 1 ? "s" : ""} awaiting KYC
                  review
                </span>
              </div>
            </Link>
          )}
          {(pendingExpenses.data?.pagination.total ?? 0) > 0 && (
            <Link to="/accounting/expenses">
              <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-600 dark:text-blue-400">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{pendingExpenses.data?.pagination.total}</strong>{" "}
                  expense
                  {(pendingExpenses.data?.pagination.total ?? 0) > 1
                    ? "s"
                    : ""}{" "}
                  pending approval
                </span>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={ShoppingCart}
            label="Sales Today"
            value={`$${salesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            sub={`${salesCount} transaction${salesCount !== 1 ? "s" : ""}`}
            href="/pos/sales"
            color="text-emerald-500"
          />
          <StatCard
            icon={DollarSign}
            label="Pending Expenses"
            value={pendingExpenses.data?.pagination.total ?? "—"}
            sub="Awaiting approval"
            href="/accounting/expenses"
            color="text-blue-500"
          />
          <StatCard
            icon={Users}
            label="Pending KYC"
            value={pendingKyc.data?.total ?? "—"}
            sub="Investors to review"
            href="/investment/investors"
            color="text-yellow-500"
          />
          <StatCard
            icon={Package}
            label="Purchase Orders"
            value={pendingPOs.data?.pagination.total ?? "—"}
            sub="All time"
            href="/inventory/purchase-orders"
            color="text-purple-500"
          />
        </div>
      </div>

      {/* Module overview */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          Modules
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={BookOpen}
            label="Journal Entries"
            value={accountingSummary.data?.totalPostedEntries ?? "—"}
            sub={
              accountingSummary.data?.currentFiscalYearName
                ? `FY: ${accountingSummary.data.currentFiscalYearName}`
                : "Posted"
            }
            href="/accounting/journal-entries"
            color="text-blue-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Active Projects"
            value={activeProjects.data?.total ?? "—"}
            sub={`${approvedInvestors.data?.total ?? 0} active investors`}
            href="/investment/projects"
            color="text-emerald-500"
          />
          <StatCard
            icon={Package}
            label="Products"
            value={productCount.data?.pagination.total ?? "—"}
            sub="In inventory"
            href="/inventory/products"
            color="text-purple-500"
          />
          <StatCard
            icon={BookOpen}
            label="Chart of Accounts"
            value={accountingSummary.data?.accountCount ?? "—"}
            sub={`${accountingSummary.data?.openPeriodCount ?? 0} open period${(accountingSummary.data?.openPeriodCount ?? 0) !== 1 ? "s" : ""}`}
            href="/accounting/chart-of-accounts"
            color="text-orange-500"
          />
        </div>
      </div>

      {/* Module quick-access */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
              description: "Manage stock, suppliers, purchase orders",
              href: "/inventory",
              icon: Package,
              title: "Inventory",
            },
            {
              color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              description: "Sales, returns, customers, shifts",
              href: "/pos",
              icon: ShoppingCart,
              title: "Point of Sale",
            },
            {
              color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              description: "Accounts, journals, expenses, reports",
              href: "/accounting",
              icon: BookOpen,
              title: "Accounting",
            },
            {
              color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
              description: "Projects, investors, capital calls",
              href: "/investment",
              icon: TrendingUp,
              title: "Investment",
            },
          ].map(({ href, icon: Icon, title, description, color }) => (
            <Link key={href} to={href}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardContent className="pt-4">
                  <div className={`mb-3 inline-flex rounded-lg p-2 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

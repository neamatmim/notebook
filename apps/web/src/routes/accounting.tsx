import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  DollarSign,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from "lucide-react";

import { getUser } from "@/functions/get-user";

const navigation = [
  { href: "/accounting", icon: LayoutDashboard, name: "Overview" },
  {
    href: "/accounting/chart-of-accounts",
    icon: BookOpen,
    name: "Chart of Accounts",
  },
  {
    href: "/accounting/journal-entries",
    icon: FileText,
    name: "Journal Entries",
  },
  { href: "/accounting/expenses", icon: DollarSign, name: "Expenses" },
  { href: "/accounting/reports", icon: BarChart3, name: "Reports" },
  { href: "/accounting/settings", icon: Settings, name: "Settings" },
] as const;

function AccountingLayout() {
  return (
    <div className="flex h-full">
      <div className="bg-card w-64 border-r">
        <div className="flex h-16 items-center border-b px-4">
          <TrendingUp className="h-8 w-8 text-indigo-600" />
          <span className="ml-2 text-xl font-semibold">Accounting</span>
        </div>
        <nav className="mt-5 space-y-1 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
              }}
              inactiveProps={{
                className:
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
              }}
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium"
            >
              <item.icon
                className="mr-3 h-5 w-5 flex-shrink-0"
                aria-hidden="true"
              />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-hidden">
        <main className="h-full overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/accounting")({
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  component: AccountingLayout,
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
});

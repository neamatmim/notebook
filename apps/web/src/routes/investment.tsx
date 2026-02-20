import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  BarChart3,
  CheckSquare,
  CreditCard,
  DollarSign,
  FolderOpen,
  Layers,
  LayoutDashboard,
  PhoneCall,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

import { getUser } from "@/functions/get-user";

const navigation = [
  { href: "/investment", icon: LayoutDashboard, name: "Overview" },
  { href: "/investment/projects", icon: FolderOpen, name: "Projects" },
  { href: "/investment/investors", icon: Users, name: "Investors" },
  { href: "/investment/milestones", icon: CheckSquare, name: "Milestones" },
  {
    href: "/investment/distributions",
    icon: DollarSign,
    name: "Distributions",
  },
  { href: "/investment/reports", icon: BarChart3, name: "Reports" },
  { href: "/investment/share-classes", icon: Layers, name: "Share Classes" },
  { href: "/investment/shareholders", icon: UserCheck, name: "Shareholders" },
  { href: "/investment/capital-calls", icon: PhoneCall, name: "Capital Calls" },
  { href: "/investment/payments", icon: CreditCard, name: "Payments" },
] as const;

function InvestmentLayout() {
  return (
    <div className="flex h-full">
      <div className="bg-card w-64 border-r">
        <div className="flex h-16 items-center border-b px-4">
          <TrendingUp className="h-8 w-8 text-emerald-600" />
          <span className="ml-2 text-xl font-semibold">Investment</span>
        </div>
        <nav className="mt-5 space-y-1 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
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

export const Route = createFileRoute("/investment")({
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  component: InvestmentLayout,
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
});

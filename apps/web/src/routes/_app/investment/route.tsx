import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart3,
  CheckSquare,
  CreditCard,
  DollarSign,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  PhoneCall,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
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
  { href: "/investment/cash-flows", icon: TrendingUp, name: "Cash Flows" },
  { href: "/investment/capital-calls", icon: PhoneCall, name: "Capital Calls" },
  { href: "/investment/investments", icon: Wallet, name: "Investments" },
  { href: "/investment/payments", icon: CreditCard, name: "Payments" },
  { href: "/investment/fee-schedules", icon: Receipt, name: "Fee Schedules" },
  { href: "/investment/fee-invoices", icon: FileText, name: "Fee Invoices" },
];

function InvestmentLayout() {
  return (
    <AppSidebar
      menus={navigation}
      header={{ icon: TrendingUp, title: "Investment" }}
    />
  );
}

export const Route = createFileRoute("/_app/investment")({
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

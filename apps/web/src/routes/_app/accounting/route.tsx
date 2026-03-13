import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  DollarSign,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/_app/accounting")({
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
];

function AccountingLayout() {
  return (
    <AppSidebar
      menus={navigation}
      header={{ icon: BookOpen, title: "Accounting" }}
    />
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart2,
  Clock,
  CreditCard,
  Gift,
  History,
  RotateCcw,
  ShoppingCart,
  Tag,
  UserCog,
  Users,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { getUser } from "@/functions/get-user";

const navigation = [
  { href: "/pos", icon: ShoppingCart, name: "Point of Sale" },
  { href: "/pos/sales", icon: History, name: "Sales History" },
  { href: "/pos/customers", icon: Users, name: "Customers" },
  { href: "/pos/returns", icon: RotateCcw, name: "Returns" },
  { href: "/pos/gift-cards", icon: Gift, name: "Gift Cards" },
  { href: "/pos/discounts", icon: Tag, name: "Discounts" },
  { href: "/pos/employees", icon: UserCog, name: "Employees" },
  { href: "/pos/shifts", icon: Clock, name: "Shifts" },
  { href: "/pos/reports", icon: BarChart2, name: "Reports" },
];

function POSLayout() {
  return (
    <AppSidebar
      menus={navigation}
      header={{ icon: CreditCard, title: "Point of Sale" }}
    />
  );
}

export const Route = createFileRoute("/_app/pos")({
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  component: POSLayout,
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
});

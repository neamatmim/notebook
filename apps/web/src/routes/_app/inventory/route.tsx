import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
  FolderTree,
  History,
  Layers,
  MapPin,
  Package,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { getUser } from "@/functions/get-user";
export const Route = createFileRoute("/_app/inventory")({
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  component: InventoryLayout,
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
});

const navigation = [
  { href: "/inventory", icon: BarChart3, name: "Overview" },
  { href: "/inventory/products", icon: Package, name: "Products" },
  { href: "/inventory/categories", icon: FolderTree, name: "Categories" },
  { href: "/inventory/suppliers", icon: Truck, name: "Suppliers" },
  {
    href: "/inventory/purchase-orders",
    icon: ShoppingCart,
    name: "Purchase Orders",
  },
  {
    href: "/inventory/stock-movements",
    icon: TrendingUp,
    name: "Stock Movements",
  },
  {
    href: "/inventory/stock-levels",
    icon: Database,
    name: "Stock Levels",
  },
  { href: "/inventory/variants", icon: Boxes, name: "Variants" },
  { href: "/inventory/batches", icon: Layers, name: "Batches" },
  {
    href: "/inventory/cycle-counts",
    icon: ClipboardList,
    name: "Cycle Counts",
  },
  { href: "/inventory/locations", icon: MapPin, name: "Locations" },
  { href: "/inventory/audit-log", icon: History, name: "Audit Log" },
  { href: "/inventory/settings", icon: Settings, name: "Settings" },
];

function InventoryLayout() {
  return (
    <AppSidebar
      menus={navigation}
      header={{ icon: Package, title: "Inventory" }}
    />
  );
}

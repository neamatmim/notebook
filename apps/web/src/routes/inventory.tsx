import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  BarChart3,
  FolderTree,
  MapPin,
  Package,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";

import { getUser } from "@/functions/get-user";

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
  { href: "/inventory/locations", icon: MapPin, name: "Locations" },
  { href: "/inventory/settings", icon: Settings, name: "Settings" },
] as const;

function InventoryLayout() {
  return (
    <div className="flex h-full">
      <div className="bg-card w-64 border-r">
        <div className="flex h-16 items-center border-b px-4">
          <Package className="h-8 w-8 text-blue-600" />
          <span className="ml-2 text-xl font-semibold">Inventory</span>
        </div>
        <nav className="mt-5 space-y-1 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
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

export const Route = createFileRoute("/inventory")({
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

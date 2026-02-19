import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  CreditCard,
  Gift,
  History,
  RotateCcw,
  ShoppingCart,
  Users,
} from "lucide-react";

import { getUser } from "@/functions/get-user";

const navigation = [
  { href: "/pos", icon: ShoppingCart, name: "Point of Sale" },
  { href: "/pos/sales", icon: History, name: "Sales History" },
  { href: "/pos/customers", icon: Users, name: "Customers" },
  { href: "/pos/returns", icon: RotateCcw, name: "Returns" },
  { href: "/pos/gift-cards", icon: Gift, name: "Gift Cards" },
] as const;

function POSLayout() {
  return (
    <div className="flex h-full">
      <div className="bg-card w-64 border-r">
        <div className="flex h-16 items-center border-b px-4">
          <CreditCard className="h-8 w-8 text-green-600" />
          <span className="ml-2 text-xl font-semibold">Point of Sale</span>
        </div>
        <nav className="mt-5 space-y-1 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300",
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

export const Route = createFileRoute("/pos")({
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

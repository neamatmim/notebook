import { Separator } from "@notebook/ui/components/separator";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@notebook/ui/components/sidebar";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  BookOpen,
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import UserMenu from "@/components/user-menu";
const modules = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    href: "/inventory",
    icon: Package,
    label: "Inventory",
  },
  { href: "/pos", icon: ShoppingCart, label: "POS" },
  {
    href: "/accounting",
    icon: BookOpen,
    label: "Accounting",
  },
  {
    href: "/investment",
    icon: TrendingUp,
    label: "Investment",
  },
] as const;
export const Route = createFileRoute("/_app")({
  component: AppLayout,
});
function AppLayout() {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <AppHeader />
        <div className="flex flex-1">
          <Outlet />
        </div>
      </SidebarProvider>
    </div>
  );
}

function AppHeader() {
  return (
    // <header className="flex h-16 shrink-0 items-center border-b gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      {/* <div className="flex items-center gap-2 px-4"> */}
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2" />
        <nav className="flex items-center gap-1">
          {modules.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              to={href}
              activeProps={{
                className: "bg-primary/10 text-primary",
              }}
              inactiveProps={{
                className:
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

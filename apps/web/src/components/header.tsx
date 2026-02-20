import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import UserMenu from "./user-menu";

const modules = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    segment: "dashboard",
  },
  {
    href: "/inventory",
    icon: Package,
    label: "Inventory",
    segment: "inventory",
  },
  { href: "/pos", icon: ShoppingCart, label: "POS", segment: "pos" },
  {
    href: "/accounting",
    icon: BookOpen,
    label: "Accounting",
    segment: "accounting",
  },
  {
    href: "/investment",
    icon: TrendingUp,
    label: "Investment",
    segment: "investment",
  },
] as const;

export default function Header() {
  const location = useRouterState({ select: (s) => s.location.pathname });
  const activeSegment = location.split("/")[1] ?? "";

  return (
    <header className="bg-card border-b">
      <div className="flex h-14 items-center gap-6 px-4">
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-md">
            <BookOpen className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="text-foreground text-sm font-semibold tracking-tight">
            Notebook
          </span>
        </Link>

        <div className="h-5 w-px bg-border" />

        <nav className="flex items-center gap-1">
          {modules.map(({ href, icon: Icon, label, segment }) => {
            const isActive = activeSegment === segment;
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

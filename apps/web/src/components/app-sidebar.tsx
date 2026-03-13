import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notebook/ui/components/sidebar";
import { Link, Outlet } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function AppSidebar({
  header,
  menus,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  header: { icon: LucideIcon; title: string };
  menus: { href: string; icon: LucideIcon; name: string }[];
}) {
  return (
    <>
      <Sidebar
        className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
        {...props}
      >
        <SidebarHeader className="p-0">
          <div className="flex h-16 items-center border-b px-4">
            <header.icon className="size-8 text-indigo-600" />
            <span className="ml-2 text-xl font-semibold">{header.title}</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu className="gap-1">
              {menus.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    render={(menuProps) => (
                      <Link
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
                        {...menuProps}
                        // className="group flex items-center px-2 py-2 text-sm font-medium"
                      >
                        <item.icon
                          className="mr-3 size-5 flex-shrink-0"
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    )}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="p-4">
        <Outlet />
      </SidebarInset>
    </>
  );
}

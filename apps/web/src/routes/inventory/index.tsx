import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

function InventoryOverview() {
  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({ input: { limit: 1 } })
  );
  const suppliersQuery = useQuery(
    orpc.inventory.suppliers.list.queryOptions({ input: { limit: 1 } })
  );
  const purchaseOrdersQuery = useQuery(
    orpc.inventory.purchaseOrders.list.queryOptions({ input: { limit: 1 } })
  );
  const movementsQuery = useQuery(
    orpc.inventory.stock.movements.queryOptions({ input: { limit: 5 } })
  );
  const lowStockQuery = useQuery(
    orpc.inventory.stock.lowStock.queryOptions({ input: { limit: 5 } })
  );
  const expiringSoonQuery = useQuery(
    orpc.inventory.stock.expiringSoon.queryOptions({ input: { limit: 5 } })
  );

  const totalProducts = productsQuery.data?.pagination.total ?? 0;
  const totalSuppliers = suppliersQuery.data?.pagination.total ?? 0;
  const totalPurchaseOrders = purchaseOrdersQuery.data?.pagination.total ?? 0;
  const lowStockProducts = lowStockQuery.data?.items ?? [];
  const movements = movementsQuery.data?.items ?? [];
  const expiringSoonItems = expiringSoonQuery.data?.items ?? [];

  const stats = [
    {
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      color: "text-blue-600 dark:text-blue-400",
      href: "/inventory/products" as const,
      icon: Package,
      name: "Total Products",
      value: totalProducts.toString(),
    },
    {
      bgColor: "bg-green-50 dark:bg-green-950/20",
      color: "text-green-600 dark:text-green-400",
      href: "/inventory/suppliers" as const,
      icon: Users,
      name: "Active Suppliers",
      value: totalSuppliers.toString(),
    },
    {
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      color: "text-orange-600 dark:text-orange-400",
      href: "/inventory/purchase-orders" as const,
      icon: ShoppingCart,
      name: "Purchase Orders",
      value: totalPurchaseOrders.toString(),
    },
    {
      bgColor: "bg-red-50 dark:bg-red-950/20",
      color: "text-red-600 dark:text-red-400",
      href: "/inventory/products" as const,
      icon: AlertTriangle,
      name: "Low Stock Items",
      value: (lowStockQuery.data?.total ?? 0).toString(),
    },
    {
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      color: "text-amber-600 dark:text-amber-400",
      href: "/inventory/batches" as const,
      icon: Clock,
      name: "Expiring Soon",
      value: (expiringSoonQuery.data?.total ?? 0).toString(),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Inventory Overview</h1>
        <p className="text-muted-foreground">
          Track your inventory performance and stock levels
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.name} className="transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-muted-foreground text-sm font-medium">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </div>
              </div>
              <div className="mt-4">
                <Link to={stat.href}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Recent Stock Movements
            </CardTitle>
            <CardDescription>
              Latest inventory transactions and movements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {movementsQuery.isLoading ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Loading...
              </p>
            ) : movements.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No stock movements yet
              </p>
            ) : (
              <div className="space-y-4">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="bg-muted flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {movement.type}: {movement.product?.name ?? "Unknown"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {movement.location?.name ?? "N/A"} &bull;{" "}
                          {movement.reason}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        movement.quantity > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {movement.quantity > 0
                        ? `+${movement.quantity}`
                        : movement.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertCircle className="mr-2 h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Products that need restocking</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockQuery.isLoading ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Loading...
              </p>
            ) : lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No low stock alerts
              </p>
            ) : (
              <div className="space-y-4">
                {lowStockProducts.map((item) => (
                  <div
                    key={item.stockLevelId}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-muted-foreground text-xs">
                        SKU: {item.sku}
                      </p>
                      <p className="mt-0.5 text-xs text-red-600">
                        {item.locationName ?? "Default"} —{" "}
                        {item.totalStock ?? 0} / {item.reorderPoint} reorder
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-300">
                      low stock
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-amber-600">
              <Clock className="mr-2 h-5 w-5" />
              Expiring Soon
            </CardTitle>
            <CardDescription>
              Batches expiring within the next 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expiringSoonQuery.isLoading ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Loading...
              </p>
            ) : expiringSoonItems.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No batches expiring soon
              </p>
            ) : (
              <div className="space-y-4">
                {expiringSoonItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.productName ?? "Unknown"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.locationName ?? "No location"} &bull; Qty:{" "}
                        {item.remainingQuantity}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      {item.expirationDate
                        ? new Date(item.expirationDate).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/inventory/")({
  component: InventoryOverview,
});

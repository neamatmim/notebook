import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Package, Plus } from "lucide-react";
import { useState } from "react";

import { POFormDialog } from "@/components/po-form-dialog";
import { POReceiveDialog } from "@/components/po-receive-dialog";
import { POViewDialog } from "@/components/po-view-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function PurchaseOrdersPage() {
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);

  const ordersQuery = useQuery(
    orpc.inventory.purchaseOrders.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "poNumber",
      header: "PO Number",
    },
    {
      accessorKey: "supplier",
      cell: ({ row }) => row.original.supplier?.name ?? "—",
      header: "Supplier",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const { status } = row.original;
        const colors: Record<string, string> = {
          approved:
            "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300",
          cancelled:
            "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
          draft:
            "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
          ordered:
            "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
          partial:
            "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
          pending:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
          received:
            "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${(status ? colors[status] : undefined) ?? colors.draft}`}
          >
            {status}
          </span>
        );
      },
      header: "Status",
    },
    {
      accessorKey: "totalAmount",
      cell: ({ row }) => `$${Number(row.original.totalAmount ?? 0).toFixed(2)}`,
      header: "Total",
    },
    {
      accessorKey: "orderDate",
      cell: ({ row }) =>
        row.original.orderDate
          ? new Date(row.original.orderDate).toLocaleDateString()
          : "—",
      header: "Order Date",
    },
    {
      accessorKey: "expectedDate",
      cell: ({ row }) =>
        row.original.expectedDate
          ? new Date(row.original.expectedDate).toLocaleDateString()
          : "—",
      header: "Expected Date",
    },
    {
      accessorKey: "paymentDueDate",
      cell: ({ row }) => {
        const { paymentDueDate, paymentStatus } = row.original;
        if (!paymentDueDate) {
          return "—";
        }
        const isOverdue =
          new Date(paymentDueDate) < new Date() && paymentStatus !== "paid";
        return (
          <div className="flex items-center gap-1">
            <span>{new Date(paymentDueDate).toLocaleDateString()}</span>
            {isOverdue && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-300">
                overdue
              </span>
            )}
          </div>
        );
      },
      header: "Due Date",
    },
    {
      accessorKey: "paymentStatus",
      cell: ({ row }) => {
        const status = row.original.paymentStatus ?? "unpaid";
        const colors: Record<string, string> = {
          overdue:
            "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
          paid: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
          partially_paid:
            "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
          unpaid:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[status] ?? colors.unpaid}`}
          >
            {status}
          </span>
        );
      },
      header: "Payment",
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewId(row.original.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {row.original.status !== "received" &&
            row.original.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700"
                onClick={() => setReceiveId(row.original.id)}
              >
                <Package className="h-4 w-4" />
              </Button>
            )}
        </div>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Track purchase orders from suppliers
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(pageIndex) => setPage(pageIndex)}
        loading={ordersQuery.isLoading}
      />

      <POFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <POViewDialog poId={viewId} onClose={() => setViewId(null)} />

      <POReceiveDialog poId={receiveId} onClose={() => setReceiveId(null)} />
    </div>
  );
}

export const Route = createFileRoute("/inventory/purchase-orders")({
  component: PurchaseOrdersPage,
});

import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Eye, Package, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { POFormDialog } from "@/components/po-form-dialog";
import { POReceiveDialog } from "@/components/po-receive-dialog";
import { POViewDialog } from "@/components/po-view-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

type POStatus =
  | "approved"
  | "cancelled"
  | "draft"
  | "ordered"
  | "partial"
  | "pending"
  | "received";

const STATUS_TABS: { label: string; value: POStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Ordered", value: "ordered" },
  { label: "Partial", value: "partial" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

function PurchaseOrdersPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<POStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);

  const checkReordersMutation = useMutation(
    orpc.inventory.stock.checkReorders.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        if (data.created > 0) {
          toast.success(
            `Reorder check complete — ${data.created} draft PO${data.created > 1 ? "s" : ""} created`
          );
          queryClient.invalidateQueries({
            queryKey: orpc.inventory.purchaseOrders.list.queryOptions({
              input: {},
            }).queryKey,
          });
        } else {
          toast.info(
            `Reorder check complete — no new POs needed (${data.lowStockCount} low-stock item${data.lowStockCount !== 1 ? "s" : ""} already have open POs or no supplier)`
          );
        }
      },
    })
  );

  const ordersQuery = useQuery(
    orpc.inventory.purchaseOrders.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    })
  );

  const markOrderedMutation = useMutation(
    orpc.inventory.purchaseOrders.markOrdered.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Purchase order marked as ordered");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list.queryOptions({
            input: {},
          }).queryKey,
        });
      },
    })
  );

  const deletePOMutation = useMutation(
    orpc.inventory.purchaseOrders.delete.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Purchase order deleted");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list.queryOptions({
            input: {},
          }).queryKey,
        });
      },
    })
  );

  const cancelPOMutation = useMutation(
    orpc.inventory.purchaseOrders.cancel.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Purchase order cancelled");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list.queryOptions({
            input: {},
          }).queryKey,
        });
      },
    })
  );

  const approveMutation = useMutation(
    orpc.inventory.purchaseOrders.approve.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Purchase order approved");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list.queryOptions({
            input: {},
          }).queryKey,
        });
      },
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
      cell: ({ row }) => {
        const { id, status } = row.original;
        const canApprove = status === "draft" || status === "pending";
        const canMarkOrdered = status === "approved";
        const canReceive =
          status === "approved" || status === "ordered" || status === "partial";
        const canCancel = status !== "received" && status !== "cancelled";
        const canDelete = status === "draft" || status === "pending";
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setViewId(id)}>
              <Eye className="h-4 w-4" />
            </Button>
            {canApprove && (
              <Button
                size="sm"
                variant="outline"
                className="text-cyan-600 hover:text-cyan-700"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id })}
                title="Approve PO"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canMarkOrdered && (
              <Button
                size="sm"
                variant="outline"
                className="text-blue-600 hover:text-blue-700"
                disabled={markOrderedMutation.isPending}
                onClick={() => markOrderedMutation.mutate({ id })}
                title="Mark as Ordered"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            {canReceive && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700"
                onClick={() => setReceiveId(id)}
                title="Receive goods"
              >
                <Package className="h-4 w-4" />
              </Button>
            )}
            {canCancel && !canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={cancelPOMutation.isPending}
                onClick={() => cancelPOMutation.mutate({ id })}
                title="Cancel PO"
              >
                ✕
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={deletePOMutation.isPending}
                onClick={() => deletePOMutation.mutate({ id })}
                title="Delete PO"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={checkReordersMutation.isPending}
            onClick={() => checkReordersMutation.mutate()}
          >
            {checkReordersMutation.isPending ? "Checking…" : "Check Reorders"}
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(0);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
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

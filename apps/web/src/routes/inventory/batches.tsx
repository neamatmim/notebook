import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BatchCreateDialog } from "@/components/batch-create-dialog";
import { BatchEditDialog } from "@/components/batch-edit-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

type BatchStatus = "all" | "active" | "expired" | "expiring_soon" | "depleted";

const statusTabs: { label: string; value: BatchStatus }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Expiring Soon", value: "expiring_soon" },
  { label: "Expired", value: "expired" },
  { label: "Depleted", value: "depleted" },
];

function expiryColor(status: string): string {
  if (status === "expired") {
    return "text-red-600 font-semibold";
  }
  if (status === "expiring_soon") {
    return "text-amber-600 font-semibold";
  }
  return "text-foreground";
}

function BatchesPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<BatchStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<{
    expirationDate: Date | null;
    id: string;
    lotNumber: string | null;
    notes: string | null;
    productName: string | null;
  } | null>(null);

  const batchesQuery = useQuery(
    orpc.inventory.stock.batches.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, status },
    })
  );

  const writeOffMutation = useMutation(
    orpc.inventory.stock.writeOffBatch.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Batch written off successfully");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.batches
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.expiringSoon
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.movements
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
      },
    })
  );

  const items = batchesQuery.data?.items ?? [];
  const total = batchesQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  type BatchRow = (typeof items)[number];

  const columns: ColumnDef<BatchRow>[] = [
    {
      accessorKey: "lotNumber",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.lotNumber ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
      ),
      header: "Lot #",
    },
    {
      accessorKey: "product",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.productName ?? "Unknown"}
          </div>
          <div className="text-muted-foreground text-sm">
            {row.original.productSku ?? ""}
            {row.original.variantName ? ` · ${row.original.variantName}` : ""}
          </div>
        </div>
      ),
      header: "Product",
    },
    {
      accessorKey: "locationName",
      cell: ({ row }) => row.original.locationName ?? "—",
      header: "Location",
    },
    {
      accessorKey: "receivedAt",
      cell: ({ row }) => new Date(row.original.receivedAt).toLocaleDateString(),
      header: "Received",
    },
    {
      accessorKey: "expirationDate",
      cell: ({ row }) => {
        const { expirationDate, status: batchStatus } = row.original;
        if (!expirationDate) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className={expiryColor(batchStatus)}>
            {new Date(expirationDate).toLocaleDateString()}
          </span>
        );
      },
      header: "Expires",
    },
    {
      accessorKey: "quantity",
      cell: ({ row }) => (
        <span>
          {row.original.remainingQuantity} / {row.original.originalQuantity}
        </span>
      ),
      header: "Qty (remaining/original)",
    },
    {
      accessorKey: "unitCost",
      cell: ({ row }) => `$${Number(row.original.unitCost).toFixed(2)}`,
      header: "Unit Cost",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const { status: batchStatus } = row.original;
        const colors: Record<string, string> = {
          active: "bg-green-100 text-green-800",
          depleted: "bg-gray-100 text-gray-600",
          expired: "bg-red-100 text-red-800",
          expiring_soon: "bg-amber-100 text-amber-800",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[batchStatus] ?? colors.active}`}
          >
            {batchStatus.replace("_", " ")}
          </span>
        );
      },
      header: "Status",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const { id, status: batchStatus, remainingQuantity } = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditBatch({
                  expirationDate: row.original.expirationDate,
                  id,
                  lotNumber: row.original.lotNumber,
                  notes: row.original.notes,
                  productName: row.original.productName,
                })
              }
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {batchStatus === "expired" && remainingQuantity > 0 && (
              <Button
                size="sm"
                variant="destructive"
                disabled={writeOffMutation.isPending}
                onClick={() => writeOffMutation.mutate({ batchId: id })}
              >
                Write Off
              </Button>
            )}
          </div>
        );
      },
      header: "Actions",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Batches / Lots</h1>
          <p className="text-muted-foreground">
            View and manage inventory batches with expiration tracking
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Batch
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
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
        loading={batchesQuery.isLoading}
      />

      <BatchCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <BatchEditDialog batch={editBatch} onClose={() => setEditBatch(null)} />
    </div>
  );
}

export const Route = createFileRoute("/inventory/batches")({
  component: BatchesPage,
});

import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CycleCountCreateDialog } from "@/components/cycle-count-create-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

type CycleCountStatus = "cancelled" | "completed" | "draft" | "in_progress";

const statusColors: Record<CycleCountStatus, string> = {
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-800",
};

function CycleCountsPage() {
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useQuery(
    orpc.inventory.cycleCount.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const cancelMutation = useMutation(
    orpc.inventory.cycleCount.cancel.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Cycle count cancelled");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.cycleCount.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
      },
    })
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  type Row = (typeof items)[number];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <Link
          to="/inventory/cycle-counts/$id"
          params={{ id: row.original.id }}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.name}
        </Link>
      ),
      header: "Name",
    },
    {
      accessorKey: "locationName",
      cell: ({ row }) => row.original.locationName ?? "All locations",
      header: "Location",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const s = row.original.status as CycleCountStatus;
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[s] ?? statusColors.draft}`}
          >
            {s.replace("_", " ")}
          </span>
        );
      },
      header: "Status",
    },
    {
      id: "progress",
      cell: ({ row }) => {
        const { countedLines, totalLines } = row.original;
        return `${countedLines} / ${totalLines} counted`;
      },
      header: "Progress",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Created",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const { id, status } = row.original;
        const isActive = status === "draft" || status === "in_progress";
        return (
          <div className="flex items-center gap-2">
            <Link
              to="/inventory/cycle-counts/$id"
              params={{ id }}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              View
            </Link>
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate({ id })}
              >
                Cancel
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
          <h1 className="text-2xl font-bold">Cycle Counts</h1>
          <p className="text-muted-foreground">
            Conduct physical inventory counts and apply variance adjustments
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Count
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
        loading={listQuery.isLoading}
      />

      <CycleCountCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/cycle-counts/")({
  component: CycleCountsPage,
});

import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { ReturnFormDialog } from "@/components/return-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function ReturnsPage() {
  const [page, setPage] = useState(0);
  const [returnFormOpen, setReturnFormOpen] = useState(false);

  const returnsQuery = useQuery(
    orpc.pos.returns.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const items = returnsQuery.data?.items ?? [];
  const total = returnsQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "returnNumber",
      header: "Return #",
    },
    {
      accessorKey: "originalSale",
      cell: ({ row }) => row.original.originalSale?.receiptNumber ?? "—",
      header: "Original Sale",
    },
    {
      accessorKey: "customer",
      cell: ({ row }) => {
        const c = row.original.customer;
        return c?.firstName ? `${c.firstName} ${c.lastName ?? ""}`.trim() : "—";
      },
      header: "Customer",
    },
    {
      accessorKey: "reason",
      cell: ({ row }) => (
        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
          {row.original.reason.replaceAll("_", " ")}
        </span>
      ),
      header: "Reason",
    },
    {
      accessorKey: "totalRefundAmount",
      cell: ({ row }) =>
        `$${Number(row.original.totalRefundAmount ?? 0).toFixed(2)}`,
      header: "Refund Amount",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const { status } = row.original;
        const colors: Record<string, string> = {
          approved: "bg-green-100 text-green-800",
          pending: "bg-yellow-100 text-yellow-800",
          rejected: "bg-red-100 text-red-800",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${(status ? colors[status] : undefined) ?? colors.pending}`}
          >
            {status}
          </span>
        );
      },
      header: "Status",
    },
    {
      accessorKey: "returnDate",
      cell: ({ row }) =>
        row.original.returnDate
          ? new Date(row.original.returnDate).toLocaleString()
          : "—",
      header: "Date",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="text-muted-foreground">
            View and manage product returns
          </p>
        </div>
        <Button onClick={() => setReturnFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Process Return
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
        loading={returnsQuery.isLoading}
      />

      <ReturnFormDialog
        open={returnFormOpen}
        onClose={() => setReturnFormOpen(false)}
      />
    </div>
  );
}

export const Route = createFileRoute("/pos/returns")({
  component: ReturnsPage,
});

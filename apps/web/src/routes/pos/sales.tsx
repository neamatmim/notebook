import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { useState } from "react";

import { SaleViewDialog } from "@/components/sale-view-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function SalesPage() {
  const [page, setPage] = useState(0);
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);

  const salesQuery = useQuery(
    orpc.pos.sales.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const items = salesQuery.data?.items ?? [];
  const total = salesQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "receiptNumber",
      header: "Receipt #",
    },
    {
      accessorKey: "customer",
      cell: ({ row }) => {
        const c = row.original.customer;
        return c?.firstName
          ? `${c.firstName} ${c.lastName ?? ""}`.trim()
          : "Walk-in";
      },
      header: "Customer",
    },
    {
      accessorKey: "totalAmount",
      cell: ({ row }) => `$${Number(row.original.totalAmount ?? 0).toFixed(2)}`,
      header: "Total",
    },
    {
      accessorKey: "taxAmount",
      cell: ({ row }) => `$${Number(row.original.taxAmount ?? 0).toFixed(2)}`,
      header: "Tax",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
          {row.original.status}
        </span>
      ),
      header: "Status",
    },
    {
      accessorKey: "location",
      cell: ({ row }) => row.original.location?.name ?? "—",
      header: "Location",
    },
    {
      accessorKey: "saleDate",
      cell: ({ row }) =>
        row.original.saleDate
          ? new Date(row.original.saleDate).toLocaleString()
          : "—",
      header: "Date",
    },
    {
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setViewSaleId(row.original.id)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sales History</h1>
        <p className="text-muted-foreground">
          View completed sales transactions
        </p>
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
        loading={salesQuery.isLoading}
      />

      <SaleViewDialog saleId={viewSaleId} onClose={() => setViewSaleId(null)} />
    </div>
  );
}

export const Route = createFileRoute("/pos/sales")({
  component: SalesPage,
});

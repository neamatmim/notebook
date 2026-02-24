import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { MarkDamagedDialog } from "@/components/mark-damaged-dialog";
import { StockAdjustDialog } from "@/components/stock-adjust-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

type MovementType =
  | "adjustment"
  | "cycle_count"
  | "damaged"
  | "expired"
  | "purchase"
  | "return"
  | "sale"
  | "transfer";

const TYPE_TABS: { label: string; value: MovementType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Purchase", value: "purchase" },
  { label: "Sale", value: "sale" },
  { label: "Transfer", value: "transfer" },
  { label: "Adjustment", value: "adjustment" },
  { label: "Damaged", value: "damaged" },
  { label: "Expired", value: "expired" },
  { label: "Return", value: "return" },
  { label: "Cycle Count", value: "cycle_count" },
];

function StockMovementsPage() {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [damagedOpen, setDamagedOpen] = useState(false);

  const movementsQuery = useQuery(
    orpc.inventory.stock.movements.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        type: typeFilter === "all" ? undefined : typeFilter,
      },
    })
  );

  const items = movementsQuery.data?.items ?? [];
  const total = movementsQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "product",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.product?.name ?? "Unknown"}
          </div>
          <div className="text-muted-foreground text-sm">
            {row.original.product?.sku ?? ""}
          </div>
        </div>
      ),
      header: "Product",
    },
    {
      accessorKey: "type",
      cell: ({ row }) => {
        const { type } = row.original;
        const colors: Record<string, string> = {
          adjustment: "bg-yellow-100 text-yellow-800",
          cycle_count: "bg-purple-100 text-purple-800",
          damaged: "bg-red-100 text-red-800",
          expired: "bg-orange-100 text-orange-800",
          purchase: "bg-blue-100 text-blue-800",
          return: "bg-indigo-100 text-indigo-800",
          sale: "bg-green-100 text-green-800",
          transfer: "bg-gray-100 text-gray-800",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[type] ?? colors.adjustment}`}
          >
            {type}
          </span>
        );
      },
      header: "Type",
    },
    {
      accessorKey: "quantity",
      cell: ({ row }) => {
        const qty = row.original.quantity;
        return (
          <span
            className={`font-semibold ${qty > 0 ? "text-green-600" : "text-red-600"}`}
          >
            {qty > 0 ? `+${qty}` : qty}
          </span>
        );
      },
      header: "Quantity",
    },
    {
      accessorKey: "previousQuantity",
      cell: ({ row }) =>
        `${row.original.previousQuantity} → ${row.original.newQuantity}`,
      header: "Stock Change",
    },
    {
      accessorKey: "location",
      cell: ({ row }) => row.original.location?.name ?? "—",
      header: "Location",
    },
    {
      accessorKey: "reason",
      header: "Reason",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      header: "Date",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground">
            Track all inventory stock changes and movements
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setDamagedOpen(true)}
          >
            Mark Damaged
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setAdjustOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adjust Stock
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setTypeFilter(tab.value);
              setPage(0);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              typeFilter === tab.value
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
        loading={movementsQuery.isLoading}
      />

      <StockAdjustDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
      />

      <MarkDamagedDialog
        open={damagedOpen}
        onClose={() => setDamagedOpen(false)}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/stock-movements")({
  component: StockMovementsPage,
});

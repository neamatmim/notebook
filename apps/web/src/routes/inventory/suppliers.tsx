import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { SupplierFormDialog } from "@/components/supplier-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

type SupplierStatus = "active" | "inactive" | "suspended";
const STATUS_TABS: { label: string; value: SupplierStatus | "all" }[] = [
  { label: "Active & Suspended", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Inactive", value: "inactive" },
];

const PAGE_SIZE = 20;

function SuppliersPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "all">(
    "all"
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    city?: string;
    contactName?: string;
    country?: string;
    email?: string;
    name: string;
    notes?: string;
    paymentTerms?: string;
    paymentTermsDays?: number | null;
    phone?: string;
    status?: "active" | "inactive" | "suspended";
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const suppliersQuery = useQuery(
    orpc.inventory.suppliers.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.inventory.suppliers.delete.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Supplier deleted");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.suppliers.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteId(null);
      },
    })
  );

  const items = suppliersQuery.data?.items ?? [];
  const total = suppliersQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "contactName",
      cell: ({ row }) => row.original.contactName ?? "—",
      header: "Contact",
    },
    {
      accessorKey: "email",
      cell: ({ row }) => row.original.email ?? "—",
      header: "Email",
    },
    {
      accessorKey: "phone",
      cell: ({ row }) => row.original.phone ?? "—",
      header: "Phone",
    },
    {
      accessorKey: "city",
      cell: ({ row }) =>
        [row.original.city, row.original.country].filter(Boolean).join(", ") ||
        "—",
      header: "Location",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const s = (row.original.status ?? "active") as SupplierStatus;
        const colors: Record<SupplierStatus, string> = {
          active:
            "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
          inactive:
            "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
          suspended:
            "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[s]}`}
          >
            {s}
          </span>
        );
      },
      header: "Status",
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditId(row.original.id);
              setEditData({
                city: row.original.city ?? undefined,
                contactName: row.original.contactName ?? undefined,
                country: row.original.country ?? undefined,
                email: row.original.email ?? undefined,
                name: row.original.name,
                notes: row.original.notes ?? undefined,
                paymentTerms: row.original.paymentTerms ?? undefined,
                paymentTermsDays: row.original.paymentTermsDays,
                phone: row.original.phone ?? undefined,
                status: row.original.status ?? "active",
              });
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage your suppliers and vendors
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            setEditId(null);
            setEditData(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <div className="mb-4 flex gap-1 border-b">
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
        loading={suppliersQuery.isLoading}
      />

      <SupplierFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
          setEditData(null);
        }}
        editId={editId}
        editData={editData}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate({ id: deleteId });
          }
        }}
        title="Delete Supplier"
        description="Are you sure you want to delete this supplier? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/suppliers")({
  component: SuppliersPage,
});

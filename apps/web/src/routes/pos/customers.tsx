import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const customersQuery = useQuery(
    orpc.pos.customers.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        query: searchQuery || undefined,
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.pos.customers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.pos.customers.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteId(null);
      },
    })
  );

  const items = customersQuery.data?.items ?? [];
  const total = customersQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "customerNumber",
      header: "Customer #",
    },
    {
      accessorKey: "firstName",
      cell: ({ row }) =>
        `${row.original.firstName ?? ""} ${row.original.lastName ?? ""}`.trim() ||
        "—",
      header: "Name",
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
      accessorKey: "type",
      cell: ({ row }) => {
        const { type } = row.original;
        const colors: Record<string, string> = {
          employee: "bg-purple-100 text-purple-800",
          regular: "bg-gray-100 text-gray-800",
          vip: "bg-yellow-100 text-yellow-800",
          wholesale: "bg-blue-100 text-blue-800",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[type] ?? colors.regular}`}
          >
            {type}
          </span>
        );
      },
      header: "Type",
    },
    {
      accessorKey: "totalSpent",
      cell: ({ row }) => `$${Number(row.original.totalSpent ?? 0).toFixed(2)}`,
      header: "Total Spent",
    },
    {
      accessorKey: "loyaltyPoints",
      header: "Loyalty Points",
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditId(row.original.id);
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
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => {
            setEditId(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Search customers by name, email, or phone..."
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(0);
        }}
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(pageIndex) => setPage(pageIndex)}
        loading={customersQuery.isLoading}
      />

      <CustomerFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
        }}
        editId={editId}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate({ id: deleteId });
          }
        }}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/pos/customers")({
  component: CustomersPage,
});

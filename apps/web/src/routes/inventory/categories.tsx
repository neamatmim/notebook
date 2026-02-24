import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { CategoryFormDialog } from "@/components/category-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function CategoriesPage() {
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    description?: string;
    name: string;
    parentId?: string;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const categoriesQuery = useQuery(
    orpc.inventory.categories.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const deleteMutation = useMutation(
    orpc.inventory.categories.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.categories.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteId(null);
      },
    })
  );

  const items = categoriesQuery.data?.items ?? [];
  const total = categoriesQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
      header: "Description",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Created",
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
                description: row.original.description ?? undefined,
                name: row.original.name,
                parentId: row.original.parentId ?? undefined,
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
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage product categories</p>
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
          Add Category
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
        loading={categoriesQuery.isLoading}
      />

      <CategoryFormDialog
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
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/categories")({
  component: CategoriesPage,
});

import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { ProductViewDialog } from "@/components/product-view-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        query: searchQuery || undefined,
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.inventory.products.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Product deleted");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.products.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteProductId(null);
      },
    })
  );

  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const openCreate = () => {
    setEditProductId(null);
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    setEditProductId(id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditProductId(null);
  };

  const columns: ColumnDef<(typeof products)[number]>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => {
        const count = Number(row.original.variantCount ?? 0);
        return (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span>SKU: {row.original.sku}</span>
              {count > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {count} variant{count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        );
      },
      header: "Product",
    },
    {
      accessorKey: "category",
      cell: ({ row }) => row.original.category?.name ?? "—",
      header: "Category",
    },
    {
      accessorKey: "sellingPrice",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            ${Number(row.original.sellingPrice ?? 0).toFixed(2)}
          </div>
          <div className="text-muted-foreground text-sm">
            Cost: ${Number(row.original.costPrice ?? 0).toFixed(2)}
          </div>
        </div>
      ),
      header: "Price",
    },
    {
      accessorKey: "supplier",
      cell: ({ row }) => row.original.supplier?.name ?? "—",
      header: "Supplier",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const s = row.original.status ?? "active";
        const colors: Record<string, string> = {
          active:
            "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
          discontinued:
            "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
          inactive:
            "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[s] ?? colors.active}`}
          >
            {s}
          </span>
        );
      },
      header: "Status",
    },
    {
      cell: ({ row }) => (
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewProductId(row.original.id)}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEdit(row.original.id)}
            title="Edit product"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setDeleteProductId(row.original.id)}
            title="Delete product"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  const deleteProduct = products.find((p) => p.id === deleteProductId);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchPlaceholder="Search products by name or SKU..."
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
        loading={productsQuery.isLoading}
      />

      <ProductFormDialog
        open={formOpen}
        onClose={closeForm}
        editProductId={editProductId}
      />

      <ProductViewDialog
        productId={viewProductId}
        onClose={() => setViewProductId(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteProductId)}
        onClose={() => setDeleteProductId(null)}
        onConfirm={() => {
          if (deleteProductId) {
            deleteMutation.mutate({ id: deleteProductId });
          }
        }}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteProduct?.name ?? "this product"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/products")({
  component: ProductsPage,
});

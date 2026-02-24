import type { ColumnDef } from "@tanstack/react-table";
import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc, queryClient } from "@/utils/orpc";

const PAGE_SIZE = 20;

interface VariantFormData {
  attributeType: string;
  attributeValue: string;
  barcode: string;
  costPrice: string;
  name: string;
  productId: string;
  sellingPrice: string;
  sku: string;
}

const emptyForm: VariantFormData = {
  attributeType: "",
  attributeValue: "",
  barcode: "",
  costPrice: "",
  name: "",
  productId: "",
  sellingPrice: "",
  sku: "",
};

function VariantFormDialog({
  editData,
  editId,
  onClose,
  open,
  preselectedProductId,
}: {
  editData?: Partial<VariantFormData> | null;
  editId?: string | null;
  onClose: () => void;
  open: boolean;
  preselectedProductId?: string;
}) {
  const [form, setForm] = useState<VariantFormData>(emptyForm);
  const isEdit = Boolean(editId);

  const productsQuery = useQuery({
    ...orpc.inventory.products.list.queryOptions({
      input: { limit: 100, offset: 0 },
    }),
    enabled: open,
  });

  useEffect(() => {
    if (editData && editId) {
      setForm({
        attributeType: editData.attributeType ?? "",
        attributeValue: editData.attributeValue ?? "",
        barcode: editData.barcode ?? "",
        costPrice: editData.costPrice ?? "",
        name: editData.name ?? "",
        productId: editData.productId ?? "",
        sellingPrice: editData.sellingPrice ?? "",
        sku: editData.sku ?? "",
      });
    } else if (!editId) {
      setForm({ ...emptyForm, productId: preselectedProductId ?? "" });
    }
  }, [editId, editData, preselectedProductId]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.products.variants.listAll
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.products.variants.list
        .queryOptions({ input: { productId: form.productId } })
        .queryKey.slice(0, 2),
    });
  };

  const createMutation = useMutation(
    orpc.inventory.products.variants.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Variant created");
        invalidate();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.inventory.products.variants.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Variant updated");
        invalidate();
        onClose();
      },
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      attributeType: form.attributeType || undefined,
      attributeValue: form.attributeValue || undefined,
      barcode: form.barcode || undefined,
      costPrice: form.costPrice || undefined,
      name: form.name,
      productId: form.productId,
      sellingPrice: form.sellingPrice || undefined,
      sku: form.sku,
    };
    if (isEdit && editId) {
      updateMutation.mutate({ ...payload, id: editId });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = <K extends keyof VariantFormData>(
    key: K,
    value: VariantFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Variant" : "Add Variant"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update variant details."
              : "Add a new variant to a product."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="var-product">
              Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.productId || "__none__"}
              onValueChange={(v) =>
                set("productId", v === "__none__" ? "" : (v ?? ""))
              }
              disabled={isEdit}
            >
              <SelectTrigger id="var-product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select product</SelectItem>
                {(productsQuery.data?.items ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="var-name">
                Variant Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="var-name"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Red / Large"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-sku">
                SKU <span className="text-red-500">*</span>
              </Label>
              <Input
                id="var-sku"
                required
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="Unique SKU"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-attr-type">Attribute Type</Label>
              <Input
                id="var-attr-type"
                value={form.attributeType}
                onChange={(e) => set("attributeType", e.target.value)}
                placeholder="e.g. color, size"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-attr-val">Attribute Value</Label>
              <Input
                id="var-attr-val"
                value={form.attributeValue}
                onChange={(e) => set("attributeValue", e.target.value)}
                placeholder="e.g. Red, XL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-cost">Cost Price ($)</Label>
              <Input
                id="var-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => set("costPrice", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-sell">Selling Price ($)</Label>
              <Input
                id="var-sell"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => set("sellingPrice", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-barcode">Barcode</Label>
              <Input
                id="var-barcode"
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.productId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantsPage() {
  const [page, setPage] = useState(0);
  const [productFilter, setProductFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<VariantFormData> | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({
      input: { limit: 100, offset: 0 },
    })
  );

  const variantsQuery = useQuery(
    orpc.inventory.products.variants.listAll.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        productId: productFilter || undefined,
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.inventory.products.variants.delete.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Variant deleted");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.products.variants.listAll
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteId(null);
      },
    })
  );

  const items = variantsQuery.data?.items ?? [];
  const total = variantsQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  type Row = (typeof items)[number];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "productName",
      header: "Product",
    },
    {
      accessorKey: "sku",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.sku}</span>
      ),
      header: "SKU",
    },
    {
      accessorKey: "name",
      header: "Variant Name",
    },
    {
      accessorKey: "attributeType",
      cell: ({ row }) => {
        const { attributeType, attributeValue } = row.original;
        if (!attributeType) {
          return "—";
        }
        return `${attributeType}: ${attributeValue ?? ""}`;
      },
      header: "Attribute",
    },
    {
      accessorKey: "costPrice",
      cell: ({ row }) =>
        row.original.costPrice
          ? `$${Number(row.original.costPrice).toFixed(2)}`
          : "—",
      header: "Cost",
    },
    {
      accessorKey: "sellingPrice",
      cell: ({ row }) =>
        row.original.sellingPrice
          ? `$${Number(row.original.sellingPrice).toFixed(2)}`
          : "—",
      header: "Price",
    },
    {
      accessorKey: "stockQuantity",
      cell: ({ row }) => row.original.stockQuantity ?? 0,
      header: "Stock",
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
                attributeType: row.original.attributeType ?? "",
                attributeValue: row.original.attributeValue ?? "",
                barcode: row.original.barcode ?? "",
                costPrice: row.original.costPrice ?? "",
                name: row.original.name,
                productId: row.original.productId,
                sellingPrice: row.original.sellingPrice ?? "",
                sku: row.original.sku,
              });
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
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
          <h1 className="text-2xl font-bold">Product Variants</h1>
          <p className="text-muted-foreground">
            Manage variants across all products
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={productFilter || "__all__"}
            onValueChange={(v) => {
              setProductFilter(v === "__all__" ? "" : (v ?? ""));
              setPage(0);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All products</SelectItem>
              {(productsQuery.data?.items ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setEditId(null);
              setEditData(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Variant
          </Button>
        </div>
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
        loading={variantsQuery.isLoading}
      />

      <VariantFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
          setEditData(null);
        }}
        editId={editId}
        editData={editData}
        preselectedProductId={productFilter}
      />

      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Variant</DialogTitle>
            <DialogDescription>
              This variant will be deactivated and removed from the product.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate({ id: deleteId });
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/inventory/variants")({
  component: VariantsPage,
});

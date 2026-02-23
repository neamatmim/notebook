import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { queryClient, orpc } from "@/utils/orpc";

interface ProductFormData {
  barcode: string;
  categoryId: string;
  costPrice: string;
  description: string;
  minStockLevel: number;
  name: string;
  notes: string;
  reorderPoint: number;
  reorderQuantity: number;
  sellingPrice: string;
  sku: string;
  supplierId: string;
  taxable: boolean;
  unit: string;
}

const emptyForm: ProductFormData = {
  barcode: "",
  categoryId: "",
  costPrice: "",
  description: "",
  minStockLevel: 0,
  name: "",
  notes: "",
  reorderPoint: 0,
  reorderQuantity: 0,
  sellingPrice: "",
  sku: "",
  supplierId: "",
  taxable: true,
  unit: "pcs",
};

interface ProductFormDialogProps {
  editProductId?: string | null;
  onClose: () => void;
  open: boolean;
}

export function ProductFormDialog({
  open,
  onClose,
  editProductId,
}: ProductFormDialogProps) {
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const isEdit = Boolean(editProductId);

  const categoriesQuery = useQuery(
    orpc.inventory.categories.list.queryOptions({
      input: { limit: 100 },
    })
  );

  const suppliersQuery = useQuery(
    orpc.inventory.suppliers.list.queryOptions({
      input: { limit: 100 },
    })
  );

  const productQuery = useQuery(
    orpc.inventory.products.get.queryOptions({
      enabled: Boolean(editProductId),
      input: { id: editProductId! },
    })
  );

  useEffect(() => {
    if (editProductId && productQuery.data) {
      const p = productQuery.data;
      setForm({
        barcode: p.barcode ?? "",
        categoryId: p.category?.id ?? "",
        costPrice: p.costPrice ?? "",
        description: p.description ?? "",
        minStockLevel: p.minStockLevel ?? 0,
        name: p.name,
        notes: p.notes ?? "",
        reorderPoint: p.reorderPoint ?? 0,
        reorderQuantity: p.reorderQuantity ?? 0,
        sellingPrice: p.sellingPrice ?? "",
        sku: p.sku,
        supplierId: p.supplier?.id ?? "",
        taxable: p.taxable ?? true,
        unit: p.unit ?? "pcs",
      });
    } else if (!editProductId) {
      setForm(emptyForm);
    }
  }, [editProductId, productQuery.data]);

  const invalidateProducts = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.products.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
  };

  const createMutation = useMutation(
    orpc.inventory.products.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Product created");
        invalidateProducts();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.inventory.products.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Product updated");
        invalidateProducts();
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.products.get.queryOptions({
            input: { id: editProductId! },
          }).queryKey,
        });
        onClose();
      },
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload = {
      barcode: form.barcode || undefined,
      categoryId: form.categoryId || undefined,
      costPrice: form.costPrice || undefined,
      description: form.description || undefined,
      minStockLevel: form.minStockLevel,
      name: form.name,
      notes: form.notes || undefined,
      reorderPoint: form.reorderPoint || undefined,
      reorderQuantity: form.reorderQuantity || undefined,
      sellingPrice: form.sellingPrice || undefined,
      sku: form.sku,
      supplierId: form.supplierId || undefined,
      taxable: form.taxable,
      unit: form.unit,
    };

    if (isEdit && editProductId) {
      updateMutation.mutate({ ...payload, id: editProductId });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = <K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isLoading = isEdit && productQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details below."
              : "Fill in the details to create a new product."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Product name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">
                  SKU <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sku"
                  required
                  value={form.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  placeholder="e.g., PROD-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Selling Price</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.sellingPrice}
                  onChange={(e) => updateField("sellingPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costPrice}
                  onChange={(e) => updateField("costPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">Category</Label>
                <select
                  id="categoryId"
                  value={form.categoryId}
                  onChange={(e) => updateField("categoryId", e.target.value)}
                  className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                >
                  <option value="">No category</option>
                  {(categoriesQuery.data?.items ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier</Label>
                <select
                  id="supplierId"
                  value={form.supplierId}
                  onChange={(e) => updateField("supplierId", e.target.value)}
                  className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                >
                  <option value="">No supplier</option>
                  {(suppliersQuery.data?.items ?? []).map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={(e) => updateField("barcode", e.target.value)}
                  placeholder="Barcode"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <select
                  id="unit"
                  value={form.unit}
                  onChange={(e) => updateField("unit", e.target.value)}
                  className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                >
                  <option value="pcs">Pieces</option>
                  <option value="kg">Kilograms</option>
                  <option value="lbs">Pounds</option>
                  <option value="m">Meters</option>
                  <option value="ft">Feet</option>
                  <option value="box">Box</option>
                  <option value="pack">Pack</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStockLevel">Min Stock Level</Label>
                <Input
                  id="minStockLevel"
                  type="number"
                  min="0"
                  value={form.minStockLevel}
                  onChange={(e) =>
                    updateField("minStockLevel", Number(e.target.value))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  value={form.reorderPoint}
                  onChange={(e) =>
                    updateField("reorderPoint", Number(e.target.value))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
                <Input
                  id="reorderQuantity"
                  type="number"
                  min="0"
                  value={form.reorderQuantity}
                  onChange={(e) =>
                    updateField("reorderQuantity", Number(e.target.value))
                  }
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="taxable"
                  checked={form.taxable}
                  onCheckedChange={(checked) =>
                    updateField("taxable", Boolean(checked))
                  }
                />
                <Label htmlFor="taxable">Taxable</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Product description..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Internal notes..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

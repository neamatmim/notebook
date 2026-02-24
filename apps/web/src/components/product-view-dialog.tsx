import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, orpc } from "@/utils/orpc";

interface ProductViewDialogProps {
  onClose: () => void;
  productId: string | null;
}

interface VariantFormState {
  attributeType: string;
  attributeValue: string;
  barcode: string;
  costPrice: string;
  editId: string | null;
  name: string;
  sellingPrice: string;
  sku: string;
}

const emptyVariantForm: VariantFormState = {
  attributeType: "",
  attributeValue: "",
  barcode: "",
  costPrice: "",
  editId: null,
  name: "",
  sellingPrice: "",
  sku: "",
};

export function ProductViewDialog({
  productId,
  onClose,
}: ProductViewDialogProps) {
  const [variantForm, setVariantForm] = useState<VariantFormState | null>(null);

  const productQuery = useQuery(
    orpc.inventory.products.get.queryOptions({
      enabled: Boolean(productId),
      input: { id: productId! },
    })
  );

  const stockQuery = useQuery(
    orpc.inventory.products.stock.queryOptions({
      enabled: Boolean(productId),
      input: { productId: productId! },
    })
  );

  const variantsQuery = useQuery(
    orpc.inventory.products.variants.list.queryOptions({
      enabled: Boolean(productId),
      input: { productId: productId! },
    })
  );

  const invalidateVariants = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.products.variants.list
        .queryOptions({ input: { productId: productId! } })
        .queryKey.slice(0, 2),
    });
  };

  const createVariantMutation = useMutation(
    orpc.inventory.products.variants.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Variant created");
        invalidateVariants();
        setVariantForm(null);
      },
    })
  );

  const updateVariantMutation = useMutation(
    orpc.inventory.products.variants.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Variant updated");
        invalidateVariants();
        setVariantForm(null);
      },
    })
  );

  const deleteVariantMutation = useMutation(
    orpc.inventory.products.variants.delete.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Variant deleted");
        invalidateVariants();
      },
    })
  );

  const handleVariantSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!variantForm || !productId) {
      return;
    }
    const payload = {
      attributeType: variantForm.attributeType || undefined,
      attributeValue: variantForm.attributeValue || undefined,
      barcode: variantForm.barcode || undefined,
      costPrice: variantForm.costPrice || undefined,
      name: variantForm.name,
      sellingPrice: variantForm.sellingPrice || undefined,
      sku: variantForm.sku,
    };
    if (variantForm.editId) {
      updateVariantMutation.mutate({ ...payload, id: variantForm.editId });
    } else {
      createVariantMutation.mutate({ ...payload, productId });
    }
  };

  const p = productQuery.data;
  const stockData = stockQuery.data ?? [];
  const variants = variantsQuery.data ?? [];
  const { isLoading } = productQuery;

  return (
    <Dialog
      open={Boolean(productId)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Product Details</DialogTitle>
          <DialogDescription>
            {p ? `${p.name} (${p.sku})` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : p ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Name" value={p.name} />
              <InfoField label="SKU" value={p.sku} />
              <InfoField label="Status" value={p.status ?? "active"} />
              <InfoField label="Category" value={p.category?.name} />
              <InfoField
                label="Selling Price"
                value={
                  p.sellingPrice
                    ? `$${Number(p.sellingPrice).toFixed(2)}`
                    : undefined
                }
              />
              <InfoField
                label="Cost Price"
                value={
                  p.costPrice ? `$${Number(p.costPrice).toFixed(2)}` : undefined
                }
              />
              <InfoField label="Supplier" value={p.supplier?.name} />
              <InfoField label="Barcode" value={p.barcode} />
              <InfoField label="Unit" value={p.unit} />
              <InfoField label="Taxable" value={p.taxable ? "Yes" : "No"} />
              <InfoField
                label="Min Stock Level"
                value={String(p.minStockLevel ?? 0)}
              />
              <InfoField
                label="Reorder Point"
                value={p.reorderPoint ? String(p.reorderPoint) : undefined}
              />
            </div>

            {p.description && (
              <div>
                <span className="text-muted-foreground text-xs font-medium">
                  Description
                </span>
                <p className="mt-1 text-sm">{p.description}</p>
              </div>
            )}

            {p.notes && (
              <div>
                <span className="text-muted-foreground text-xs font-medium">
                  Notes
                </span>
                <p className="mt-1 text-sm">{p.notes}</p>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Stock Levels</CardTitle>
              </CardHeader>
              <CardContent>
                {stockQuery.isLoading ? (
                  <p className="text-muted-foreground text-xs">Loading...</p>
                ) : stockData.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No stock records found
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stockData.map((stock, i) => (
                      <div
                        key={`${stock.locationId}-${stock.variantId}-${i}`}
                        className="bg-muted flex items-center justify-between rounded p-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">
                            {stock.locationName ?? "Default"}
                          </span>
                          {stock.variantName && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({stock.variantName})
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">
                            {stock.quantity}
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">
                            qty
                          </span>
                          {(stock.reservedQuantity ?? 0) > 0 && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({stock.reservedQuantity} reserved)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Variants</CardTitle>
                  {!variantForm && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setVariantForm({ ...emptyVariantForm, editId: null })
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Variant
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {variantForm && (
                  <form
                    onSubmit={handleVariantSubmit}
                    className="bg-muted/50 space-y-3 rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {variantForm.editId ? "Edit Variant" : "New Variant"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setVariantForm(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          required
                          value={variantForm.name}
                          onChange={(e) =>
                            setVariantForm((f) =>
                              f ? { ...f, name: e.target.value } : f
                            )
                          }
                          placeholder="e.g., Red / Large"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          SKU <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          required
                          value={variantForm.sku}
                          onChange={(e) =>
                            setVariantForm((f) =>
                              f ? { ...f, sku: e.target.value } : f
                            )
                          }
                          placeholder="e.g., PROD-001-RED"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Attribute Type</Label>
                        <Input
                          value={variantForm.attributeType}
                          onChange={(e) =>
                            setVariantForm((f) =>
                              f ? { ...f, attributeType: e.target.value } : f
                            )
                          }
                          placeholder="e.g., Color"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Attribute Value</Label>
                        <Input
                          value={variantForm.attributeValue}
                          onChange={(e) =>
                            setVariantForm((f) =>
                              f ? { ...f, attributeValue: e.target.value } : f
                            )
                          }
                          placeholder="e.g., Red"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cost Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variantForm.costPrice}
                          onChange={(e) =>
                            setVariantForm((f) =>
                              f ? { ...f, costPrice: e.target.value } : f
                            )
                          }
                          placeholder="0.00"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Selling Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variantForm.sellingPrice}
                          onChange={(e) =>
                            setVariantForm((f) =>
                              f ? { ...f, sellingPrice: e.target.value } : f
                            )
                          }
                          placeholder="0.00"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setVariantForm(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={
                          createVariantMutation.isPending ||
                          updateVariantMutation.isPending
                        }
                      >
                        {(createVariantMutation.isPending ||
                          updateVariantMutation.isPending) && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {variantForm.editId ? "Save" : "Add"}
                      </Button>
                    </div>
                  </form>
                )}

                {variantsQuery.isLoading ? (
                  <p className="text-muted-foreground text-xs">Loading…</p>
                ) : variants.length === 0 && !variantForm ? (
                  <p className="text-muted-foreground text-xs">
                    No variants defined
                  </p>
                ) : (
                  <div className="space-y-1">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className="bg-muted flex items-center justify-between rounded p-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{v.name}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-xs">
                            {v.sku}
                          </span>
                          {v.attributeType && v.attributeValue && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {v.attributeType}: {v.attributeValue}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {v.sellingPrice && (
                            <span className="text-muted-foreground text-xs">
                              ${Number(v.sellingPrice).toFixed(2)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              setVariantForm({
                                attributeType: v.attributeType ?? "",
                                attributeValue: v.attributeValue ?? "",
                                barcode: v.barcode ?? "",
                                costPrice: v.costPrice ?? "",
                                editId: v.id,
                                name: v.name,
                                sellingPrice: v.sellingPrice ?? "",
                                sku: v.sku,
                              })
                            }
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                            disabled={deleteVariantMutation.isPending}
                            onClick={() =>
                              deleteVariantMutation.mutate({ id: v.id })
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-muted-foreground text-xs">
              Created: {new Date(p.createdAt).toLocaleString()}
              {p.updatedAt && (
                <span className="ml-4">
                  Updated: {new Date(p.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

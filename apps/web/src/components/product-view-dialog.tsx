import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/utils/orpc";

interface ProductViewDialogProps {
  onClose: () => void;
  productId: string | null;
}

export function ProductViewDialog({
  productId,
  onClose,
}: ProductViewDialogProps) {
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

  const p = productQuery.data;
  const stockData = stockQuery.data ?? [];
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

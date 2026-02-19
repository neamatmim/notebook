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

interface POViewDialogProps {
  onClose: () => void;
  poId: string | null;
}

export function POViewDialog({ poId, onClose }: POViewDialogProps) {
  const poQuery = useQuery(
    orpc.inventory.purchaseOrders.get.queryOptions({
      enabled: Boolean(poId),
      input: { id: poId! },
    })
  );

  const po = poQuery.data;

  return (
    <Dialog
      open={Boolean(poId)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Purchase Order Details</DialogTitle>
          <DialogDescription>
            {po ? `PO: ${po.poNumber}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {poQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : po ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Info label="PO Number" value={po.poNumber} />
              <Info label="Status" value={po.status} />
              <Info label="Supplier" value={po.supplier?.name} />
              <Info
                label="Order Date"
                value={
                  po.orderDate
                    ? new Date(po.orderDate).toLocaleDateString()
                    : undefined
                }
              />
              <Info
                label="Expected Date"
                value={
                  po.expectedDate
                    ? new Date(po.expectedDate).toLocaleDateString()
                    : undefined
                }
              />
              <Info
                label="Received Date"
                value={
                  po.receivedDate
                    ? new Date(po.receivedDate).toLocaleDateString()
                    : undefined
                }
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {po.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-muted flex items-center justify-between rounded p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          {item.product?.name ?? "Unknown"}
                        </span>
                        {item.product?.sku && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({item.product.sku})
                          </span>
                        )}
                        {item.variant?.name && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            — {item.variant.name}
                          </span>
                        )}
                        <span className="text-muted-foreground ml-2 text-xs">
                          x{item.quantity} @ ${Number(item.unitCost).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">
                          ${Number(item.totalCost).toFixed(2)}
                        </span>
                        {item.receivedQuantity > 0 && (
                          <div className="text-xs text-green-600">
                            Received: {item.receivedQuantity}/{item.quantity}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(po.subtotal).toFixed(2)}</span>
              </div>
              {Number(po.shippingCost) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>${Number(po.shippingCost).toFixed(2)}</span>
                </div>
              )}
              {Number(po.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${Number(po.taxAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-semibold">
                <span>Total</span>
                <span>${Number(po.totalAmount).toFixed(2)}</span>
              </div>
            </div>

            {po.notes && (
              <div className="text-muted-foreground border-t pt-3 text-sm">
                <span className="font-medium">Notes:</span> {po.notes}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

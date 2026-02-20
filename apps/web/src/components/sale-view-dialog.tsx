import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/utils/orpc";
import { printReceipt } from "@/utils/print-receipt";

interface SaleViewDialogProps {
  onClose: () => void;
  saleId: string | null;
}

export function SaleViewDialog({ saleId, onClose }: SaleViewDialogProps) {
  const saleQuery = useQuery(
    orpc.pos.sales.get.queryOptions({
      enabled: Boolean(saleId),
      input: { id: saleId! },
    })
  );

  const s = saleQuery.data;

  const handlePrint = () => {
    if (!s) {
      return;
    }
    printReceipt({
      receiptNumber: s.receiptNumber,
      saleDate: s.saleDate ?? new Date(),
      locationName: s.location?.name,
      employeeName: s.employee?.firstName
        ? `${s.employee.firstName} ${s.employee.lastName ?? ""}`.trim()
        : undefined,
      customerName: s.customer?.firstName
        ? `${s.customer.firstName} ${s.customer.lastName ?? ""}`.trim()
        : undefined,
      customerEmail: s.customer?.email,
      customerPhone: s.customer?.phone,
      items: s.items.map((item) => ({
        name: item.product?.name ?? "Unknown",
        sku: item.product?.sku ?? "",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payments: s.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        cardLast4: p.cardLast4,
        cardType: p.cardType,
      })),
      subtotal: Number(s.subtotal),
      discountAmount: Number(s.discountAmount),
      taxAmount: Number(s.taxAmount),
      totalAmount: Number(s.totalAmount),
      amountPaid: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      changeGiven: Number(s.changeGiven ?? 0),
      notes: s.notes,
    });
  };

  return (
    <Dialog
      open={Boolean(saleId)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sale Details</DialogTitle>
          <DialogDescription>
            {s ? `Receipt: ${s.receiptNumber}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {saleQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : s ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Receipt #" value={s.receiptNumber} />
              <Info label="Status" value={s.status} />
              <Info
                label="Customer"
                value={
                  s.customer?.firstName
                    ? `${s.customer.firstName} ${s.customer.lastName ?? ""}`.trim()
                    : "Walk-in"
                }
              />
              <Info label="Location" value={s.location?.name} />
              <Info
                label="Date"
                value={
                  s.saleDate ? new Date(s.saleDate).toLocaleString() : undefined
                }
              />
              <Info
                label="Employee"
                value={
                  s.employee?.firstName
                    ? `${s.employee.firstName} ${s.employee.lastName ?? ""}`.trim()
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
                  {s.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-muted flex items-center justify-between rounded p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          {item.product?.name ?? "Unknown"}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          x{item.quantity} @ $
                          {Number(item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                      <span className="font-semibold">
                        ${Number(item.totalPrice).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {s.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-muted flex items-center justify-between rounded p-2 text-sm"
                    >
                      <span className="capitalize">
                        {payment.method.replaceAll("_", " ")}
                      </span>
                      <span className="font-semibold">
                        ${Number(payment.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(s.subtotal).toFixed(2)}</span>
              </div>
              {Number(s.discountAmount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-${Number(s.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>${Number(s.taxAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base border-t pt-1">
                <span>Total</span>
                <span>${Number(s.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : null}

        {s && (
          <DialogFooter>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        )}
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

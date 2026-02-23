import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, orpc } from "@/utils/orpc";

interface POViewDialogProps {
  onClose: () => void;
  poId: string | null;
}

const paymentStatusColors: Record<string, string> = {
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  partially_paid:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  unpaid:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
};

const PAYMENT_METHODS = [
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Check", value: "check" },
  { label: "Cash", value: "cash" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Other", value: "other" },
] as const;

export function POViewDialog({ poId, onClose }: POViewDialogProps) {
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const poQuery = useQuery(
    orpc.inventory.purchaseOrders.get.queryOptions({
      enabled: Boolean(poId),
      input: { id: poId! },
    })
  );

  const recordPaymentMutation = useMutation(
    orpc.inventory.purchaseOrders.recordPayment.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Payment recorded successfully");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.get
            .queryOptions({ input: { id: poId! } })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setShowRecordPayment(false);
        setPaymentAmount("");
        setPaymentNotes("");
        setPaymentMethod("");
      },
    })
  );

  const po = poQuery.data;

  function openRecordPayment() {
    if (!po) {
      return;
    }
    const remaining = Number(po.totalAmount ?? 0) - Number(po.amountPaid ?? 0);
    setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setPaymentNotes("");
    setShowRecordPayment(true);
  }

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
                        {(item.receivedQuantity ?? 0) > 0 && (
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

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Payment</span>
                {po.paymentStatus !== "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openRecordPayment}
                  >
                    Record Payment
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs font-medium">
                    Payment Due
                  </span>
                  <p className="font-medium">
                    {po.paymentDueDate
                      ? new Date(po.paymentDueDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">
                    Status
                  </span>
                  <p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${paymentStatusColors[po.paymentStatus ?? "unpaid"] ?? paymentStatusColors.unpaid}`}
                    >
                      {po.paymentStatus ?? "unpaid"}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">
                    Amount Paid
                  </span>
                  <p className="font-medium">
                    ${Number(po.amountPaid ?? 0).toFixed(2)} of $
                    {Number(po.totalAmount ?? 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">
                    Paid At
                  </span>
                  <p className="font-medium">
                    {po.paidAt ? new Date(po.paidAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>

              {showRecordPayment && (
                <div className="bg-muted space-y-3 rounded p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="payment-amount" className="text-xs">
                        Amount
                      </Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="payment-date" className="text-xs">
                        Payment Date
                      </Label>
                      <Input
                        id="payment-date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="payment-method" className="text-xs">
                        Payment Method
                      </Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={(v) => setPaymentMethod(v ?? "")}
                      >
                        <SelectTrigger id="payment-method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="payment-notes" className="text-xs">
                        Notes
                      </Label>
                      <Input
                        id="payment-notes"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        recordPaymentMutation.isPending ||
                        !paymentAmount ||
                        Number(paymentAmount) <= 0
                      }
                      onClick={() => {
                        if (!poId) {
                          return;
                        }
                        recordPaymentMutation.mutate({
                          amount: paymentAmount,
                          id: poId,
                          notes: paymentNotes || undefined,
                          paymentDate: paymentDate
                            ? new Date(paymentDate).toISOString()
                            : undefined,
                          paymentMethod:
                            (paymentMethod as
                              | "bank_transfer"
                              | "check"
                              | "cash"
                              | "credit_card"
                              | "other"
                              | undefined) || undefined,
                        });
                      }}
                    >
                      {recordPaymentMutation.isPending && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Confirm Payment
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRecordPayment(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {po.payments && po.payments.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment History
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-1 pr-3 font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="pb-1 pr-3 font-medium text-muted-foreground">
                            Amount
                          </th>
                          <th className="pb-1 pr-3 font-medium text-muted-foreground">
                            Method
                          </th>
                          <th className="pb-1 font-medium text-muted-foreground">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.payments.map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">
                              {new Date(p.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="py-1.5 pr-3 font-medium">
                              ${Number(p.amount).toFixed(2)}
                            </td>
                            <td className="py-1.5 pr-3 capitalize">
                              {p.paymentMethod
                                ? p.paymentMethod.replace("_", " ")
                                : "—"}
                            </td>
                            <td className="py-1.5 text-muted-foreground">
                              {p.notes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

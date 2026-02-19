import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
}

type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "mobile_payment"
  | "gift_card";

interface CheckoutDialogProps {
  cart: CartItem[];
  locationId: string;
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
  subtotal: number;
  tax: number;
  total: number;
}

export function CheckoutDialog({
  open,
  onClose,
  onSuccess,
  cart,
  locationId,
  subtotal,
  tax,
  total,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

  const customersQuery = useQuery(
    orpc.pos.customers.list.queryOptions({
      enabled: open,
      input: { limit: 100 },
    })
  );

  const saleMutation = useMutation(
    orpc.pos.sales.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Sale completed! Receipt: ${data.receiptNumber}`);
        queryClient.invalidateQueries({
          queryKey: orpc.pos.sales.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setPaymentMethod("cash");
        setAmountTendered("");
        setCustomerId("");
        setNotes("");
        onSuccess();
      },
    })
  );

  const paymentAmount = Number(amountTendered) || total;
  const change =
    paymentMethod === "cash" ? Math.max(0, paymentAmount - total) : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (paymentMethod === "cash" && paymentAmount < total) {
      toast.error("Insufficient payment amount");
      return;
    }

    saleMutation.mutate({
      customerId: customerId || undefined,
      discountAmount: "0",
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
      })),
      locationId,
      notes: notes || undefined,
      payments: [
        {
          amount:
            paymentMethod === "cash"
              ? paymentAmount.toString()
              : total.toString(),
          method: paymentMethod,
        },
      ],
    });
  };

  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>
            Complete the sale — Total: ${total.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Items ({cart.reduce((s, i) => s + i.quantity, 0)})
              </span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["cash", "Cash"],
                  ["credit_card", "Credit"],
                  ["debit_card", "Debit"],
                ] as const
              ).map(([method, label]) => (
                <Button
                  key={method}
                  type="button"
                  variant={paymentMethod === method ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(method)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["mobile_payment", "Mobile"],
                  ["gift_card", "Gift Card"],
                ] as const
              ).map(([method, label]) => (
                <Button
                  key={method}
                  type="button"
                  variant={paymentMethod === method ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(method)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <Label htmlFor="amount-tendered">Amount Tendered</Label>
              <Input
                id="amount-tendered"
                type="number"
                step="0.01"
                min={total}
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder={total.toFixed(2)}
              />
              {quickAmounts.length > 0 && (
                <div className="flex gap-2">
                  {quickAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAmountTendered(amount.toString())}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              )}
              {change > 0 && (
                <p className="text-sm font-semibold text-green-600">
                  Change: ${change.toFixed(2)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="checkout-customer">Customer (Optional)</Label>
            <select
              id="checkout-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
            >
              <option value="">Walk-in Customer</option>
              {(customersQuery.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.customerNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-notes">Notes (Optional)</Label>
            <Textarea
              id="checkout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sale notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saleMutation.isPending || cart.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {saleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Complete Sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

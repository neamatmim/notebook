import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { ReceiptItem } from "@/utils/print-receipt";

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
import { printReceipt } from "@/utils/print-receipt";

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
  | "gift_card"
  | "store_credit"
  | "on_account";

type DueCollectMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "mobile_payment"
  | "check"
  | "gift_card"
  | "store_credit";

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

interface SuccessData {
  receiptNumber: string;
  saleDate: Date;
  customerName?: string;
  items: ReceiptItem[];
  payments: { method: string; amount: number }[];
  amountPaid: number;
  changeGiven: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  dueAdded?: number;
  dueCollected?: number;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  credit_card: "Credit",
  debit_card: "Debit",
  mobile_payment: "Mobile",
  gift_card: "Gift Card",
  store_credit: "Store Credit",
  on_account: "On Account",
};

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
  const [paymentLines, setPaymentLines] = useState<
    { method: PaymentMethod; amount: string; giftCardNumber?: string }[]
  >([]);
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod>("cash");
  const [pendingAmount, setPendingAmount] = useState("");
  const [pendingGiftCardNumber, setPendingGiftCardNumber] = useState("");
  const [searchedGiftCardNumber, setSearchedGiftCardNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [collectDueEnabled, setCollectDueEnabled] = useState(false);
  const [collectDueAmount, setCollectDueAmount] = useState("");
  const [collectDueMethod, setCollectDueMethod] =
    useState<DueCollectMethod>("cash");
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    amount: number;
    code: string;
    name: string;
  } | null>(null);
  const [manualDiscount, setManualDiscount] = useState("");

  const customersQuery = useQuery(
    orpc.pos.customers.list.queryOptions({
      enabled: open,
      input: { limit: 100 },
    })
  );

  const giftCardQuery = useQuery(
    orpc.pos.giftCards.balance.queryOptions({
      enabled: searchedGiftCardNumber.length > 0,
      input: { cardNumber: searchedGiftCardNumber },
      retry: false,
    })
  );

  const validateDiscountMutation = useMutation(
    orpc.pos.discounts.validate.mutationOptions({
      onSuccess: (data) => {
        setAppliedDiscount({
          amount: Number(data.discountAmount),
          code: discountCode.trim(),
          name: data.discount.name,
        });
        setDiscountCode("");
        toast.success(`Discount applied: ${data.discount.name}`);
      },
      onError: (e) => toast.error(e.message ?? "Invalid discount code."),
    })
  );

  // Pre-fill the amount with the full total when the dialog opens
  useEffect(() => {
    if (open) {
      setPendingAmount(total.toFixed(2));
    }
  }, [open, total]);

  const selectedCustomer = customersQuery.data?.items.find(
    (c) => c.id === customerId
  );
  const availableCredit = Number(selectedCustomer?.creditBalance ?? 0);
  const availableDue = Number(selectedCustomer?.dueBalance ?? 0);
  const availablePoints = selectedCustomer?.loyaltyPoints ?? 0;

  const codeDiscountAmount = appliedDiscount?.amount ?? 0;
  const manualDiscountAmount = Math.min(
    Math.max(0, Number(manualDiscount) || 0),
    total
  );
  // 100 points = $1. Cap so points can't push total below what code+manual already covers.
  const loyaltyDiscount = loyaltyPointsToRedeem / 100;
  const totalDiscountAmount =
    codeDiscountAmount + manualDiscountAmount + loyaltyDiscount;
  const effectiveTotal = Math.max(0, total - totalDiscountAmount);
  const maxRedeemablePoints = Math.min(
    availablePoints,
    Math.floor(effectiveTotal * 100)
  );

  const allocatedTotal = paymentLines.reduce((s, l) => s + Number(l.amount), 0);
  const remaining = Math.max(0, effectiveTotal - allocatedTotal);
  const change = Math.max(0, allocatedTotal - effectiveTotal);
  const pendingAmountNum = Number(pendingAmount);
  // Count the pending (not-yet-added) amount toward canSubmit so the button
  // enables as soon as the amount field is filled — clicking "Add Payment" is
  // optional; the pending line is auto-added on submit.
  const tentativeTotal = allocatedTotal + Math.max(pendingAmountNum, 0);
  const canSubmit =
    (tentativeTotal >= effectiveTotal || effectiveTotal === 0) &&
    (paymentLines.length > 0 || pendingAmountNum > 0 || effectiveTotal === 0);

  const storeCreditUsed = paymentLines
    .filter((l) => l.method === "store_credit")
    .reduce((s, l) => s + Number(l.amount), 0);
  const remainingCredit = Math.max(0, availableCredit - storeCreditUsed);

  const quickAmounts = [
    Math.ceil(remaining),
    Math.ceil(remaining / 5) * 5,
    Math.ceil(remaining / 10) * 10,
    Math.ceil(remaining / 20) * 20,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= remaining && v > 0);

  const resetForm = () => {
    setPaymentLines([]);
    setPendingMethod("cash");
    setPendingAmount("");
    setPendingGiftCardNumber("");
    setSearchedGiftCardNumber("");
    setCustomerId("");
    setNotes("");
    setSuccessData(null);
    setCollectDueEnabled(false);
    setCollectDueAmount("");
    setCollectDueMethod("cash");
    setLoyaltyPointsToRedeem(0);
    setDiscountCode("");
    setAppliedDiscount(null);
    setManualDiscount("");
  };

  const handleCloseFromSuccess = () => {
    resetForm();
    onSuccess();
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    setPendingMethod(method);
    if (method !== "gift_card") {
      setPendingGiftCardNumber("");
      setSearchedGiftCardNumber("");
    }
    if (method === "store_credit") {
      setPendingAmount(Math.min(remainingCredit, remaining).toFixed(2));
    } else if (method === "gift_card") {
      // Amount will be set after card is checked; leave blank for now
      setPendingAmount("");
    } else {
      setPendingAmount(
        remaining > 0 ? remaining.toFixed(2) : effectiveTotal.toFixed(2)
      );
    }
  };

  const handleAddPayment = () => {
    const amount = Number(pendingAmount);
    if (!pendingAmount || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (pendingMethod === "gift_card") {
      if (!pendingGiftCardNumber.trim()) {
        toast.error("Enter the gift card number.");
        return;
      }
      if (!giftCardQuery.data) {
        toast.error("Check the gift card balance first.");
        return;
      }
      if (Number(giftCardQuery.data.currentBalance) < amount) {
        toast.error(
          `Gift card balance is $${Number(giftCardQuery.data.currentBalance).toFixed(2)}.`
        );
        return;
      }
    }
    setPaymentLines((prev) => [
      ...prev,
      {
        method: pendingMethod,
        amount: pendingAmount,
        giftCardNumber:
          pendingMethod === "gift_card"
            ? pendingGiftCardNumber.trim()
            : undefined,
      },
    ]);
    setPendingAmount("");
    if (pendingMethod === "gift_card") {
      setPendingGiftCardNumber("");
      setSearchedGiftCardNumber("");
    }
  };

  const handleRemoveLine = (index: number) => {
    setPaymentLines((prev) => prev.filter((_, i) => i !== index));
  };

  const saleMutation = useMutation(
    orpc.pos.sales.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Sale completed! Receipt: ${data.receiptNumber}`);
        queryClient.invalidateQueries({
          queryKey: orpc.pos.sales.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.pos.customers.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });

        const customer = customersQuery.data?.items.find(
          (c) => c.id === customerId
        );
        const customerName = customer
          ? `${customer.firstName} ${customer.lastName ?? ""}`.trim()
          : undefined;

        const dueAdded =
          paymentLines
            .filter((l) => l.method === "on_account")
            .reduce((s, l) => s + Number(l.amount), 0) || undefined;

        const dueCollected =
          collectDueEnabled && collectDueAmount
            ? Number(collectDueAmount)
            : undefined;

        setSuccessData({
          receiptNumber: data.receiptNumber,
          saleDate: new Date(),
          customerName,
          items: cart.map((item) => ({
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
          })),
          payments: paymentLines.map((l) => ({
            method: l.method,
            amount: Number(l.amount),
          })),
          amountPaid: allocatedTotal,
          changeGiven: change,
          subtotal,
          taxAmount: tax,
          totalAmount: effectiveTotal,
          notes: notes || undefined,
          dueAdded,
          dueCollected,
          loyaltyPointsEarned: data.loyaltyPointsEarned ?? undefined,
          loyaltyPointsRedeemed:
            loyaltyPointsToRedeem > 0 ? loyaltyPointsToRedeem : undefined,
        });
      },
    })
  );

  const handlePrintFromSuccess = () => {
    if (!successData) {
      return;
    }
    printReceipt({
      receiptNumber: successData.receiptNumber,
      saleDate: successData.saleDate,
      customerName: successData.customerName,
      items: successData.items,
      payments: successData.payments,
      subtotal: successData.subtotal,
      discountAmount: totalDiscountAmount,
      taxAmount: successData.taxAmount,
      totalAmount: successData.totalAmount,
      amountPaid: successData.amountPaid,
      changeGiven: successData.changeGiven,
      notes: successData.notes,
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Auto-include whatever is in the amount field so the user doesn't have to
    // click "Add Payment" separately for a simple single-method sale.
    const finalLines = [...paymentLines];
    if (pendingAmount && Number(pendingAmount) > 0) {
      if (pendingMethod === "gift_card") {
        if (!pendingGiftCardNumber.trim()) {
          toast.error("Enter the gift card number.");
          return;
        }
        if (!giftCardQuery.data) {
          toast.error("Check the gift card balance before proceeding.");
          return;
        }
        if (Number(giftCardQuery.data.currentBalance) < Number(pendingAmount)) {
          toast.error(
            `Gift card balance is $${Number(giftCardQuery.data.currentBalance).toFixed(2)}.`
          );
          return;
        }
        finalLines.push({
          amount: pendingAmount,
          giftCardNumber: pendingGiftCardNumber.trim(),
          method: pendingMethod,
        });
      } else {
        finalLines.push({ amount: pendingAmount, method: pendingMethod });
      }
    }

    if (finalLines.length === 0) {
      toast.error("Add at least one payment.");
      return;
    }

    const finalPaid = finalLines.reduce((s, l) => s + Number(l.amount), 0);
    if (finalPaid < effectiveTotal) {
      toast.error(
        `Payment short by $${(effectiveTotal - finalPaid).toFixed(2)}.`
      );
      return;
    }

    const scTotal = finalLines
      .filter((l) => l.method === "store_credit")
      .reduce((s, l) => s + Number(l.amount), 0);
    if (scTotal > 0 && !customerId) {
      toast.error("Select a customer to use store credit.");
      return;
    }
    if (scTotal > availableCredit) {
      toast.error("Insufficient store credit balance.");
      return;
    }

    if (collectDueEnabled && collectDueAmount) {
      const amt = Number(collectDueAmount);
      if (amt <= 0) {
        toast.error("Collect Due amount must be > 0.");
        return;
      }
      if (amt > availableDue) {
        toast.error(
          `Exceeds outstanding balance ($${availableDue.toFixed(2)}).`
        );
        return;
      }
    }

    saleMutation.mutate({
      customerId: customerId || undefined,
      discountAmount:
        totalDiscountAmount > 0 ? totalDiscountAmount.toFixed(2) : "0",
      dueCollection:
        collectDueEnabled && collectDueAmount && Number(collectDueAmount) > 0
          ? { amount: collectDueAmount, method: collectDueMethod }
          : undefined,
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
      })),
      locationId,
      loyaltyPointsUsed: loyaltyPointsToRedeem,
      notes: notes || undefined,
      payments: finalLines.map((l) => ({
        amount: l.amount,
        giftCardNumber: l.giftCardNumber,
        method: l.method,
      })),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          if (successData) {
            handleCloseFromSuccess();
          } else {
            onClose();
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {successData ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Payment Successful
              </DialogTitle>
              <DialogDescription>
                Receipt: #{successData.receiptNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>${successData.totalAmount.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                {successData.payments.map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span>
                      {METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                    </span>
                    <span>${p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {successData.changeGiven > 0 && (
                <div className="flex justify-between text-green-700 font-medium">
                  <span>Change</span>
                  <span>${successData.changeGiven.toFixed(2)}</span>
                </div>
              )}
              {successData.dueAdded && (
                <div className="flex justify-between text-orange-700 font-medium">
                  <span>Added to Account Due</span>
                  <span>+${successData.dueAdded.toFixed(2)}</span>
                </div>
              )}
              {successData.dueCollected && (
                <div className="flex justify-between text-green-700 font-medium">
                  <span>Due Collected</span>
                  <span>-${successData.dueCollected.toFixed(2)}</span>
                </div>
              )}
              {(successData.loyaltyPointsEarned !== undefined ||
                successData.loyaltyPointsRedeemed !== undefined) && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 space-y-0.5">
                  {successData.loyaltyPointsRedeemed && (
                    <div className="flex justify-between">
                      <span>Points Redeemed</span>
                      <span>−{successData.loyaltyPointsRedeemed} pts</span>
                    </div>
                  )}
                  {successData.loyaltyPointsEarned !== undefined && (
                    <div className="flex justify-between font-semibold">
                      <span>Points Earned</span>
                      <span>+{successData.loyaltyPointsEarned} pts</span>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t pt-2 space-y-1">
                {successData.items.map((item, i) => (
                  <div
                    key={`${item.sku}-${i}`}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span>${item.totalPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handlePrintFromSuccess}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </Button>
              <Button
                onClick={handleCloseFromSuccess}
                className="bg-green-600 hover:bg-green-700"
              >
                New Sale
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
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
                {codeDiscountAmount > 0 && (
                  <div className="flex justify-between text-blue-700 text-sm">
                    <span>
                      Discount
                      {appliedDiscount && (
                        <span className="ml-1 font-mono text-xs">
                          ({appliedDiscount.code})
                        </span>
                      )}
                    </span>
                    <span>−${codeDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {manualDiscountAmount > 0 && (
                  <div className="flex justify-between text-blue-700 text-sm">
                    <span>Manual Discount</span>
                    <span>−${manualDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-yellow-700 text-sm">
                    <span>Loyalty ({loyaltyPointsToRedeem} pts)</span>
                    <span>−${loyaltyDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 text-base font-bold">
                  <span>Total</span>
                  <span>${effectiveTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Customer (Optional)</Label>
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

              {/* ── Discounts ── */}
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Discounts
                </p>

                {/* Discount code */}
                <div className="flex gap-2">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (discountCode.trim()) {
                          validateDiscountMutation.mutate({
                            code: discountCode.trim(),
                            customerId: customerId || undefined,
                            items: cart.map((item) => ({
                              productId: item.id,
                              quantity: item.quantity,
                              unitPrice: item.price.toString(),
                            })),
                            subtotal: subtotal.toString(),
                          });
                        }
                      }
                    }}
                    placeholder="Discount code..."
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      !discountCode.trim() || validateDiscountMutation.isPending
                    }
                    onClick={() => {
                      if (discountCode.trim()) {
                        validateDiscountMutation.mutate({
                          code: discountCode.trim(),
                          customerId: customerId || undefined,
                          items: cart.map((item) => ({
                            productId: item.id,
                            quantity: item.quantity,
                            unitPrice: item.price.toString(),
                          })),
                          subtotal: subtotal.toString(),
                        });
                      }
                    }}
                  >
                    {validateDiscountMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                </div>

                {appliedDiscount && (
                  <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs">
                    <span className="text-blue-800">
                      <span className="font-mono font-semibold">
                        {appliedDiscount.code}
                      </span>{" "}
                      — {appliedDiscount.name}: −$
                      {appliedDiscount.amount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppliedDiscount(null)}
                      className="ml-2 text-blue-400 hover:text-blue-700"
                      aria-label="Remove discount"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Manual flat discount */}
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="manual-discount"
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    Manual ($)
                  </Label>
                  <Input
                    id="manual-discount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={total}
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    placeholder="0.00"
                    className="h-7 max-w-28 text-xs"
                  />
                </div>
              </div>

              {customerId && availablePoints > 0 && (
                <div className="space-y-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-yellow-800">
                      Loyalty Points: {availablePoints} pts
                    </span>
                    <span className="text-xs text-yellow-700">
                      100 pts = $1.00
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="loyalty-redeem"
                        className="text-xs text-yellow-800"
                      >
                        Points to Redeem (max {maxRedeemablePoints})
                      </Label>
                      <Input
                        id="loyalty-redeem"
                        type="number"
                        min="0"
                        max={maxRedeemablePoints}
                        step="100"
                        value={loyaltyPointsToRedeem || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const pts = Math.min(
                            Math.max(
                              0,
                              Number.parseInt(e.target.value, 10) || 0
                            ),
                            maxRedeemablePoints
                          );
                          setLoyaltyPointsToRedeem(pts);
                          if (paymentLines.length === 0) {
                            setPendingAmount(
                              Math.max(0, total - pts / 100).toFixed(2)
                            );
                          }
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                    {loyaltyPointsToRedeem > 0 && (
                      <div className="mt-4 whitespace-nowrap text-sm font-semibold text-yellow-800">
                        −${loyaltyDiscount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {customerId && availableDue > 0 && (
                <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                  <span className="font-semibold">
                    Outstanding Due: ${availableDue.toFixed(2)}
                  </span>
                </div>
              )}

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
                      variant={pendingMethod === method ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectMethod(method)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={
                      pendingMethod === "mobile_payment" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleSelectMethod("mobile_payment")}
                  >
                    Mobile
                  </Button>
                  <Button
                    type="button"
                    variant={
                      pendingMethod === "gift_card" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleSelectMethod("gift_card")}
                  >
                    Gift Card
                  </Button>
                  <Button
                    type="button"
                    variant={
                      pendingMethod === "store_credit" ? "default" : "outline"
                    }
                    size="sm"
                    disabled={!customerId || remainingCredit <= 0}
                    onClick={() => handleSelectMethod("store_credit")}
                  >
                    {customerId && remainingCredit > 0
                      ? `Store Credit ($${remainingCredit.toFixed(2)})`
                      : "Store Credit"}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={
                      pendingMethod === "on_account" ? "default" : "outline"
                    }
                    size="sm"
                    disabled={!customerId}
                    onClick={() => handleSelectMethod("on_account")}
                  >
                    On Account
                  </Button>
                </div>
              </div>

              {pendingMethod === "gift_card" && (
                <div className="space-y-2 rounded-md border border-purple-200 bg-purple-50 p-3">
                  <Label className="text-xs font-semibold text-purple-800">
                    Gift Card Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="gift-card-number"
                      value={pendingGiftCardNumber}
                      onChange={(e) => {
                        setPendingGiftCardNumber(e.target.value);
                        setSearchedGiftCardNumber("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (pendingGiftCardNumber.trim()) {
                            setSearchedGiftCardNumber(
                              pendingGiftCardNumber.trim()
                            );
                          }
                        }
                      }}
                      placeholder="GC-..."
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-purple-300 text-purple-700"
                      onClick={() => {
                        if (pendingGiftCardNumber.trim()) {
                          setSearchedGiftCardNumber(
                            pendingGiftCardNumber.trim()
                          );
                        }
                      }}
                    >
                      Check
                    </Button>
                  </div>
                  {giftCardQuery.isLoading && (
                    <p className="text-xs text-purple-600">Checking card...</p>
                  )}
                  {giftCardQuery.isError && (
                    <p className="text-xs text-red-600">
                      Card not found or expired.
                    </p>
                  )}
                  {giftCardQuery.data && (
                    <div className="text-xs text-purple-800">
                      <span className="font-semibold">
                        Balance: $
                        {Number(giftCardQuery.data.currentBalance).toFixed(2)}
                      </span>
                      {giftCardQuery.data.expiresAt && (
                        <span className="ml-2 text-purple-600">
                          Expires:{" "}
                          {new Date(
                            giftCardQuery.data.expiresAt
                          ).toLocaleDateString()}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="ml-2 h-auto p-0 text-xs text-purple-700"
                        onClick={() => {
                          const cardBalance = Number(
                            giftCardQuery.data?.currentBalance ?? 0
                          );
                          setPendingAmount(
                            Math.min(
                              cardBalance,
                              remaining > 0 ? remaining : effectiveTotal
                            ).toFixed(2)
                          );
                        }}
                      >
                        Use full balance
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="pending-amount">Amount</Label>
                  <Input
                    id="pending-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={pendingAmount}
                    onChange={(e) => setPendingAmount(e.target.value)}
                    placeholder={remaining.toFixed(2)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={!pendingAmount || Number(pendingAmount) <= 0}
                  >
                    Add Payment
                  </Button>
                </div>
              </div>

              {pendingMethod === "cash" && quickAmounts.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {quickAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingAmount(amount.toString())}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              )}

              {paymentLines.length > 0 && (
                <div className="space-y-1 rounded-md border p-2 text-sm">
                  {paymentLines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {METHOD_LABELS[line.method]}
                        {line.giftCardNumber && (
                          <span className="ml-1 text-xs text-purple-600">
                            ({line.giftCardNumber})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ${Number(line.amount).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(i)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${METHOD_LABELS[line.method]} payment`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-1 mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>Paid: ${allocatedTotal.toFixed(2)}</span>
                    {remaining > 0 ? (
                      <span className="text-orange-600">
                        Remaining: ${remaining.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-green-600">
                        {change > 0
                          ? `Change: $${change.toFixed(2)}`
                          : "Paid in full"}
                      </span>
                    )}
                  </div>
                </div>
              )}

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

              {customerId && availableDue > 0 && (
                <div className="space-y-3 rounded-md border border-orange-200 bg-orange-50 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-orange-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={collectDueEnabled}
                      onChange={(e) => {
                        setCollectDueEnabled(e.target.checked);
                        if (e.target.checked) {
                          setCollectDueAmount(availableDue.toFixed(2));
                        } else {
                          setCollectDueAmount("");
                        }
                      }}
                      className="h-4 w-4"
                    />
                    Also collect outstanding due (${availableDue.toFixed(2)})
                  </label>
                  {collectDueEnabled && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="collect-due-amount-checkout"
                          className="text-xs text-orange-800"
                        >
                          Amount to Collect ($)
                        </Label>
                        <Input
                          id="collect-due-amount-checkout"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={availableDue}
                          value={collectDueAmount}
                          onChange={(e) => setCollectDueAmount(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="collect-due-method-checkout"
                          className="text-xs text-orange-800"
                        >
                          Payment Method
                        </Label>
                        <select
                          id="collect-due-method-checkout"
                          value={collectDueMethod}
                          onChange={(e) =>
                            setCollectDueMethod(
                              e.target.value as DueCollectMethod
                            )
                          }
                          className="border-input bg-background flex h-7 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                        >
                          <option value="cash">Cash</option>
                          <option value="credit_card">Credit Card</option>
                          <option value="debit_card">Debit Card</option>
                          <option value="mobile_payment">Mobile Payment</option>
                          <option value="check">Check</option>
                          <option value="gift_card">Gift Card</option>
                          <option value="store_credit">Store Credit</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saleMutation.isPending || cart.length === 0 || !canSubmit
                  }
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Complete Sale
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

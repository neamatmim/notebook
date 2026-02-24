import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, orpc } from "@/utils/orpc";

const RETURN_REASONS = [
  { label: "Defective", value: "defective" },
  { label: "Wrong Item", value: "wrong_item" },
  { label: "Damaged", value: "damaged" },
  { label: "Customer Changed Mind", value: "customer_changed_mind" },
  { label: "Warranty Claim", value: "warranty_claim" },
  { label: "Other", value: "other" },
] as const;

type ReturnReason = (typeof RETURN_REASONS)[number]["value"];

interface ReturnFormDialogProps {
  onClose: () => void;
  open: boolean;
}

export function ReturnFormDialog({ open, onClose }: ReturnFormDialogProps) {
  const [saleId, setSaleId] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [reason, setReason] = useState<ReturnReason>("customer_changed_mind");
  const [notes, setNotes] = useState("");
  const [restockingFee, setRestockingFee] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { quantity: string; restockable: boolean }>
  >({});

  const saleQuery = useQuery(
    orpc.pos.sales.get.queryOptions({
      enabled: Boolean(saleId),
      input: { id: saleId },
    })
  );

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({
      enabled: open,
      input: {},
    })
  );

  const [locationId, setLocationId] = useState("");

  const sale = saleQuery.data;
  const locationsList = locationsQuery.data ?? [];

  const returnMutation = useMutation(
    orpc.pos.returns.create.mutationOptions({
      onSuccess: () => {
        toast.success("Return processed successfully");
        queryClient.invalidateQueries({
          queryKey: orpc.pos.returns.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        resetForm();
        onClose();
      },
    })
  );

  const resetForm = () => {
    setSaleId("");
    setReceiptSearch("");
    setReason("customer_changed_mind");
    setNotes("");
    setRestockingFee("");
    setSelectedItems({});
    setLocationId("");
  };

  const salesSearchQuery = useQuery(
    orpc.pos.sales.list.queryOptions({
      enabled: open && receiptSearch.trim().length > 0,
      input: { limit: 10, offset: 0 },
    })
  );

  const handleSelectSale = (id: string) => {
    setSaleId(id);
    setSelectedItems({});
  };

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelectedItems((prev) => {
      if (checked) {
        const saleItem = sale?.items.find((i) => i.id === itemId);
        return {
          ...prev,
          [itemId]: {
            quantity: String(saleItem?.quantity ?? 1),
            restockable: true,
          },
        };
      }
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const updateItemQuantity = (itemId: string, quantity: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity },
    }));
  };

  const updateItemRestockable = (itemId: string, restockable: boolean) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], restockable },
    }));
  };

  const refundTotal = sale
    ? Object.entries(selectedItems).reduce((sum, [itemId, { quantity }]) => {
        const saleItem = sale.items.find((i) => i.id === itemId);
        if (!saleItem) {
          return sum;
        }
        return sum + Number(saleItem.unitPrice) * (Number(quantity) || 0);
      }, 0) - (Number(restockingFee) || 0)
    : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const items = Object.entries(selectedItems)
      .filter(([, { quantity }]) => Number(quantity) > 0)
      .map(([saleItemId, { quantity, restockable }]) => ({
        quantityReturned: Number(quantity),
        restockable,
        saleItemId,
      }));

    if (items.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (!locationId) {
      toast.error("Please select a location");
      return;
    }

    returnMutation.mutate({
      customerId: sale?.customer?.id ?? undefined,
      items,
      locationId,
      notes: notes || undefined,
      originalSaleId: saleId,
      reason,
      restockingFee: restockingFee || "0",
    });
  };

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
          <DialogTitle>Process Return</DialogTitle>
          <DialogDescription>
            Search for a sale by receipt number, then select items to return.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sale search */}
          {!saleId && (
            <div className="space-y-2">
              <Label>Find Sale</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search receipt number..."
                    className="pl-9"
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                  />
                </div>
              </div>
              {salesSearchQuery.isLoading && (
                <p className="text-muted-foreground text-sm">Searching...</p>
              )}
              {receiptSearch.trim() && !salesSearchQuery.isLoading && (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {(salesSearchQuery.data?.items ?? [])
                    .filter((s) =>
                      s.receiptNumber
                        .toLowerCase()
                        .includes(receiptSearch.toLowerCase().trim())
                    )
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="bg-muted hover:bg-accent flex w-full items-center justify-between rounded p-2 text-left text-sm"
                        onClick={() => handleSelectSale(s.id)}
                      >
                        <span className="font-medium">{s.receiptNumber}</span>
                        <span className="text-muted-foreground">
                          ${Number(s.totalAmount ?? 0).toFixed(2)} —{" "}
                          {s.saleDate
                            ? new Date(s.saleDate).toLocaleDateString()
                            : ""}
                        </span>
                      </button>
                    ))}
                  {(salesSearchQuery.data?.items ?? []).filter((s) =>
                    s.receiptNumber
                      .toLowerCase()
                      .includes(receiptSearch.toLowerCase().trim())
                  ).length === 0 && (
                    <p className="text-muted-foreground py-2 text-center text-sm">
                      No sales found
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sale details & item selection */}
          {saleId && saleQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {sale && (
            <>
              <div className="bg-muted rounded p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">
                      {sale.receiptNumber}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {sale.saleDate
                        ? new Date(sale.saleDate).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSaleId("");
                      setSelectedItems({});
                    }}
                  >
                    Change
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Total: ${Number(sale.totalAmount ?? 0).toFixed(2)}
                  {sale.customer?.firstName &&
                    ` — ${sale.customer.firstName} ${sale.customer.lastName ?? ""}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Select Items to Return</Label>
                <div className="space-y-2">
                  {sale.items.map((item) => {
                    const isSelected = item.id in selectedItems;
                    return (
                      <div
                        key={item.id}
                        className="bg-muted flex items-center gap-3 rounded p-3"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleItem(item.id, Boolean(checked))
                          }
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {item.product?.name ?? "Unknown"}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Qty: {item.quantity} @ $
                            {Number(item.unitPrice ?? 0).toFixed(2)}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <Label className="text-xs">Return Qty</Label>
                              <Input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={selectedItems[item.id]?.quantity ?? "1"}
                                onChange={(e) =>
                                  updateItemQuantity(item.id, e.target.value)
                                }
                              />
                            </div>
                            <label className="flex items-center gap-1 text-xs">
                              <Checkbox
                                checked={
                                  selectedItems[item.id]?.restockable ?? true
                                }
                                onCheckedChange={(checked) =>
                                  updateItemRestockable(
                                    item.id,
                                    Boolean(checked)
                                  )
                                }
                              />
                              Restock
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Select
                    value={reason}
                    onValueChange={(v) => setReason(v as ReturnReason)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Location <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={locationId}
                    onValueChange={(v) => setLocationId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locationsList.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="restocking-fee">Restocking Fee</Label>
                  <Input
                    id="restocking-fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={restockingFee}
                    onChange={(e) => setRestockingFee(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <p className="text-sm font-semibold">
                    Refund: ${Math.max(0, refundTotal).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-notes">Notes</Label>
                <Textarea
                  id="return-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                returnMutation.isPending ||
                !saleId ||
                Object.keys(selectedItems).length === 0
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              {returnMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Process Return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

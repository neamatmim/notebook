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

interface StockAdjustDialogProps {
  onClose: () => void;
  open: boolean;
}

export function StockAdjustDialog({ open, onClose }: StockAdjustDialogProps) {
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({
      input: { limit: 100 },
    })
  );

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const adjustMutation = useMutation(
    orpc.inventory.stock.adjust.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Stock adjusted. New quantity: ${data.newQuantity}`);
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.movements
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setProductId("");
        setLocationId("");
        setQuantity("");
        setReason("");
        setNotes("");
        onClose();
      },
    })
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    adjustMutation.mutate({
      locationId: locationId || undefined,
      notes: notes || undefined,
      productId,
      quantity: Number(quantity),
      reason,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>
            Adjust stock levels for a product. Use positive numbers to add stock
            and negative numbers to remove.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adj-product">
              Product <span className="text-red-500">*</span>
            </Label>
            <select
              id="adj-product"
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
            >
              <option value="">Select a product</option>
              {(productsQuery.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-location">Location</Label>
            <select
              id="adj-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
            >
              <option value="">Default</option>
              {(locationsQuery.data ?? []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-qty">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="adj-qty"
              type="number"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 10 or -5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="adj-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Physical count correction"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-notes">Notes</Label>
            <Textarea
              id="adj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {adjustMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Adjust Stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

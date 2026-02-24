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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, orpc } from "@/utils/orpc";

interface StockTransferDialogProps {
  onClose: () => void;
  open: boolean;
}

export function StockTransferDialog({
  open,
  onClose,
}: StockTransferDialogProps) {
  const [productId, setProductId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({ input: { limit: 100 } })
  );

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const transferMutation = useMutation(
    orpc.inventory.stock.transfer.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Stock transferred successfully");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.movements
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.locationLevels
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setProductId("");
        setFromLocationId("");
        setToLocationId("");
        setQuantity("");
        setNotes("");
        onClose();
      },
    })
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast.error("Please select a product");
      return;
    }
    if (!fromLocationId) {
      toast.error("Please select a source location");
      return;
    }
    if (!toLocationId) {
      toast.error("Please select a destination location");
      return;
    }
    transferMutation.mutate({
      fromLocationId,
      notes: notes || undefined,
      productId,
      quantity: Number(quantity),
      toLocationId,
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
          <DialogTitle>Transfer Stock</DialogTitle>
          <DialogDescription>
            Move inventory from one location to another.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tf-product">
              Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={productId}
              onValueChange={(v) => setProductId(v ?? "")}
            >
              <SelectTrigger id="tf-product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {(productsQuery.data?.items ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-from">
              From Location <span className="text-red-500">*</span>
            </Label>
            <Select
              value={fromLocationId}
              onValueChange={(v) => setFromLocationId(v ?? "")}
            >
              <SelectTrigger id="tf-from">
                <SelectValue placeholder="Select source location" />
              </SelectTrigger>
              <SelectContent>
                {(locationsQuery.data ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-to">
              To Location <span className="text-red-500">*</span>
            </Label>
            <Select
              value={toLocationId}
              onValueChange={(v) => setToLocationId(v ?? "")}
            >
              <SelectTrigger id="tf-to">
                <SelectValue placeholder="Select destination location" />
              </SelectTrigger>
              <SelectContent>
                {(locationsQuery.data ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-qty">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tf-qty"
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-notes">Notes</Label>
            <Textarea
              id="tf-notes"
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
              disabled={transferMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {transferMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

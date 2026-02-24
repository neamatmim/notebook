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

interface BatchCreateDialogProps {
  onClose: () => void;
  open: boolean;
}

export function BatchCreateDialog({ open, onClose }: BatchCreateDialogProps) {
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({ input: { limit: 100 } })
  );
  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const createMutation = useMutation(
    orpc.inventory.stock.createBatch.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Batch created and stock updated");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.batches
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.movements
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.products.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setProductId("");
        setLocationId("");
        setQuantity("");
        setUnitCost("0");
        setLotNumber("");
        setExpirationDate("");
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
    createMutation.mutate({
      expirationDate: expirationDate
        ? new Date(expirationDate).toISOString()
        : undefined,
      locationId: locationId || undefined,
      lotNumber: lotNumber || undefined,
      notes: notes || undefined,
      productId,
      quantity: Number(quantity),
      unitCost: unitCost || "0",
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
          <DialogTitle>New Batch / Lot</DialogTitle>
          <DialogDescription>
            Manually receive stock into a new batch. Stock levels will be
            updated immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch-product">
              Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={productId}
              onValueChange={(v) => setProductId(v ?? "")}
            >
              <SelectTrigger id="batch-product">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="batch-qty">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="batch-qty"
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g., 100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-cost">Unit Cost ($)</Label>
              <Input
                id="batch-cost"
                type="number"
                min="0"
                step="0.0001"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-location">Location</Label>
            <Select
              value={locationId || "__none__"}
              onValueChange={(v) =>
                setLocationId(!v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger id="batch-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Default (no location)</SelectItem>
                {(locationsQuery.data ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="batch-lot">Lot / Batch Number</Label>
              <Input
                id="batch-lot"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-expiry">Expiration Date</Label>
              <Input
                id="batch-expiry"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-notes">Notes</Label>
            <Textarea
              id="batch-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

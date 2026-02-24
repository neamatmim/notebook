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

interface MarkDamagedDialogProps {
  onClose: () => void;
  open: boolean;
}

export function MarkDamagedDialog({ open, onClose }: MarkDamagedDialogProps) {
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

  const markDamagedMutation = useMutation(
    orpc.inventory.stock.markDamaged.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        toast.success(
          `Goods marked as damaged. New quantity: ${data.newQuantity}`
        );
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
        setReason("");
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
    markDamagedMutation.mutate({
      locationId: locationId || undefined,
      notes: notes || undefined,
      productId,
      quantity: Number(quantity),
      reason: reason || undefined,
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
          <DialogTitle>Mark Goods as Damaged</DialogTitle>
          <DialogDescription>
            Record damaged or written-off stock. The quantity will be deducted
            and a loss journal entry will be posted automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dmg-product">
              Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={productId}
              onValueChange={(v) => setProductId(v ?? "")}
            >
              <SelectTrigger id="dmg-product">
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
            <Label htmlFor="dmg-location">Location</Label>
            <Select
              value={locationId || "__none__"}
              onValueChange={(v) =>
                setLocationId(!v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger id="dmg-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Default</SelectItem>
                {(locationsQuery.data ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dmg-qty">
              Quantity damaged <span className="text-red-500">*</span>
            </Label>
            <Input
              id="dmg-qty"
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dmg-reason">Reason</Label>
            <Input
              id="dmg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Water damage, Broken in transit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dmg-notes">Notes</Label>
            <Textarea
              id="dmg-notes"
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
              disabled={markDamagedMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {markDamagedMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Mark as Damaged
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

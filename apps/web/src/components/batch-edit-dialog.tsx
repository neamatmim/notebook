import type { FormEvent } from "react";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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

interface Batch {
  expirationDate: Date | null;
  id: string;
  lotNumber: string | null;
  notes: string | null;
  productName: string | null;
}

interface BatchEditDialogProps {
  batch: Batch | null;
  onClose: () => void;
}

export function BatchEditDialog({ batch, onClose }: BatchEditDialogProps) {
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (batch) {
      setLotNumber(batch.lotNumber ?? "");
      setExpirationDate(
        batch.expirationDate
          ? new Date(batch.expirationDate).toISOString().slice(0, 10)
          : ""
      );
      setNotes(batch.notes ?? "");
    }
  }, [batch]);

  const updateMutation = useMutation(
    orpc.inventory.stock.updateBatch.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Batch updated");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.batches
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        onClose();
      },
    })
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!batch) {
      return;
    }
    updateMutation.mutate({
      expirationDate: expirationDate
        ? new Date(expirationDate).toISOString()
        : null,
      id: batch.id,
      lotNumber: lotNumber || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog
      open={Boolean(batch)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            {batch?.productName ?? "Unknown product"} — update lot number,
            expiry date, or notes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-lot">Lot / Batch Number</Label>
            <Input
              id="edit-lot"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="e.g., LOT-2024-001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-expiry">Expiration Date</Label>
            <Input
              id="edit-expiry"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
            {expirationDate && (
              <button
                type="button"
                className="text-muted-foreground text-xs underline"
                onClick={() => setExpirationDate("")}
              >
                Clear expiration date
              </button>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import type { FormEvent } from "react";

import { useMutation } from "@tanstack/react-query";
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
import { orpc } from "@/utils/orpc";

interface GiftCardFormDialogProps {
  onClose: () => void;
  onSuccess?: (cardNumber: string) => void;
  open: boolean;
}

export function GiftCardFormDialog({
  open,
  onClose,
  onSuccess,
}: GiftCardFormDialogProps) {
  const [amount, setAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation(
    orpc.pos.giftCards.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Gift card created: ${data.cardNumber}`);
        onSuccess?.(data.cardNumber);
        setAmount("");
        setExpiresAt("");
        setNotes("");
        onClose();
      },
    })
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      initialAmount: amount,
      notes: notes || undefined,
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Gift Card</DialogTitle>
          <DialogDescription>
            Issue a new gift card with an initial balance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gc-amount">
              Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              id="gc-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gc-expires">Expiration Date</Label>
            <Input
              id="gc-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gc-notes">Notes</Label>
            <Textarea
              id="gc-notes"
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
              disabled={createMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Gift Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

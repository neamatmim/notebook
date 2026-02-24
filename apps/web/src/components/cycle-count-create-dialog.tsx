import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

interface CycleCountCreateDialogProps {
  onClose: () => void;
  open: boolean;
}

export function CycleCountCreateDialog({
  open,
  onClose,
}: CycleCountCreateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const createMutation = useMutation(
    orpc.inventory.cycleCount.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        toast.success("Cycle count session created");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.cycleCount.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setName("");
        setLocationId("");
        setNotes("");
        onClose();
        navigate({
          params: { id: data.id },
          to: "/inventory/cycle-counts/$id",
        });
      },
    })
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      locationId: locationId || undefined,
      name,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Cycle Count</DialogTitle>
          <DialogDescription>
            Create a new physical inventory count session. Stock levels will be
            snapshot automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cc-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2026 Full Count"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-location">Location</Label>
            <Select
              value={locationId || "__none__"}
              onValueChange={(v) =>
                setLocationId(!v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger id="cc-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All locations</SelectItem>
                {(locationsQuery.data ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-notes">Notes</Label>
            <Textarea
              id="cc-notes"
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, orpc } from "@/utils/orpc";

interface POReceiveDialogProps {
  onClose: () => void;
  poId: string | null;
}

export function POReceiveDialog({ poId, onClose }: POReceiveDialogProps) {
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
  const [locationId, setLocationId] = useState<string>("");

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );
  const locations = locationsQuery.data ?? [];

  const poQuery = useQuery(
    orpc.inventory.purchaseOrders.get.queryOptions({
      enabled: Boolean(poId),
      input: { id: poId! },
    })
  );

  const po = poQuery.data;

  useEffect(() => {
    if (po?.items) {
      const defaults: Record<string, string> = {};
      for (const item of po.items) {
        const remaining = item.quantity - (item.receivedQuantity ?? 0);
        defaults[item.id] = String(Math.max(remaining, 0));
      }
      setReceivedQtys(defaults);
    }
  }, [po?.items]);

  const receiveMutation = useMutation(
    orpc.inventory.purchaseOrders.receive.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Purchase order received and stock updated");
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        if (poId) {
          queryClient.invalidateQueries({
            queryKey: orpc.inventory.purchaseOrders.get
              .queryOptions({ input: { id: poId } })
              .queryKey.slice(0, 2),
          });
        }
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
        onClose();
      },
    })
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!poId || !po) {
      return;
    }
    const items = po.items
      .map((item) => ({
        itemId: item.id,
        receivedQuantity: Number(receivedQtys[item.id] ?? 0),
      }))
      .filter((item) => item.receivedQuantity > 0);

    if (items.length === 0) {
      toast.error("Enter at least one received quantity");
      return;
    }

    receiveMutation.mutate({
      id: poId,
      items,
      locationId: locationId || undefined,
    });
  };

  return (
    <Dialog
      open={Boolean(poId)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Purchase Order</DialogTitle>
          <DialogDescription>
            {po ? `Enter received quantities for ${po.poNumber}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {poQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : po ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Destination Location</Label>
              <Select
                value={locationId}
                onValueChange={(v) => setLocationId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Main warehouse (no location)" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              {po.items.map((item) => {
                const remaining = item.quantity - (item.receivedQuantity ?? 0);
                return (
                  <div
                    key={item.id}
                    className="bg-muted flex items-center gap-3 rounded p-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {item.product?.name ?? "Unknown"}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Ordered: {item.quantity} | Already received:{" "}
                        {item.receivedQuantity} | Remaining: {remaining}
                      </div>
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Receive</Label>
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receivedQtys[item.id] ?? "0"}
                        onChange={(e) =>
                          setReceivedQtys((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={receiveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {receiveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Receive Items
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

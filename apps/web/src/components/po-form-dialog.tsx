import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

interface LineItem {
  productId: string;
  quantity: string;
  unitCost: string;
  variantId: string;
}

const emptyLine: LineItem = {
  productId: "",
  quantity: "1",
  unitCost: "",
  variantId: "",
};

function POLineItemRow({
  index,
  item,
  isOnly,
  products,
  onUpdate,
  onRemove,
}: {
  index: number;
  isOnly: boolean;
  item: LineItem;
  onRemove: () => void;
  onUpdate: (field: keyof LineItem, value: string) => void;
  products: { id: string; name: string; sku: string }[];
}) {
  const variantsQuery = useQuery({
    ...orpc.inventory.products.variants.list.queryOptions({
      input: { productId: item.productId },
    }),
    enabled: Boolean(item.productId),
  });

  const variants = variantsQuery.data ?? [];

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        {index === 0 && <Label className="text-xs">Product</Label>}
        <Select
          value={item.productId || "__none__"}
          onValueChange={(v) => {
            const val = v === "__none__" ? "" : (v ?? "");
            onUpdate("productId", val);
            onUpdate("variantId", "");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select product</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {item.productId && variants.length > 0 && (
          <Select
            value={item.variantId || "__none__"}
            onValueChange={(v) =>
              onUpdate("variantId", v === "__none__" ? "" : (v ?? ""))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Any variant (no specific)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                Any variant (no specific)
              </SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} — {v.sku}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="w-20">
        {index === 0 && <Label className="text-xs">Qty</Label>}
        <Input
          type="number"
          min="1"
          required
          value={item.quantity}
          onChange={(e) => onUpdate("quantity", e.target.value)}
        />
      </div>
      <div className="w-28">
        {index === 0 && <Label className="text-xs">Unit Cost</Label>}
        <Input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={item.unitCost}
          onChange={(e) => onUpdate("unitCost", e.target.value)}
          placeholder="0.00"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-red-600 hover:text-red-700"
        onClick={onRemove}
        disabled={isOnly}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface POFormDialogProps {
  onClose: () => void;
  open: boolean;
}

export function POFormDialog({ open, onClose }: POFormDialogProps) {
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...emptyLine }]);

  const suppliersQuery = useQuery(
    orpc.inventory.suppliers.list.queryOptions({
      enabled: open,
      input: { limit: 100, offset: 0 },
    })
  );

  const selectedSupplier = suppliersQuery.data?.items.find(
    (s) => s.id === supplierId
  );

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({
      enabled: open,
      input: { limit: 100 },
    })
  );

  const createMutation = useMutation(
    orpc.inventory.purchaseOrders.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        toast.success(`Purchase order ${data.poNumber} created`);
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.purchaseOrders.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        resetForm();
        onClose();
      },
    })
  );

  const resetForm = () => {
    setSupplierId("");
    setExpectedDate("");
    setNotes("");
    setItems([{ ...emptyLine }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyLine }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(
      (item) => item.productId && Number(item.quantity) > 0 && item.unitCost
    );
    if (validItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    createMutation.mutate({
      expectedDate: expectedDate
        ? new Date(expectedDate).toISOString()
        : undefined,
      items: validItems.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: item.unitCost,
        variantId: item.variantId || undefined,
      })),
      notes: notes || undefined,
      supplierId,
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
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new purchase order for a supplier.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-supplier">
                Supplier <span className="text-red-500">*</span>
              </Label>
              <Select
                value={supplierId}
                onValueChange={(v) => setSupplierId(v ?? "")}
              >
                <SelectTrigger id="po-supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliersQuery.data?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSupplier?.paymentTermsDays !== null &&
                selectedSupplier?.paymentTermsDays !== undefined && (
                  <p className="text-muted-foreground text-xs">
                    Payment due:{" "}
                    {(() => {
                      const due = new Date();
                      due.setDate(
                        due.getDate() + selectedSupplier.paymentTermsDays!
                      );
                      return due.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                    })()}{" "}
                    (
                    {selectedSupplier.paymentTerms ||
                      `${selectedSupplier.paymentTermsDays}d`}
                    )
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-expected">Expected Date</Label>
              <Input
                id="po-expected"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Items <span className="text-red-500">*</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addItem}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <POLineItemRow
                  key={index}
                  index={index}
                  item={item}
                  isOnly={items.length === 1}
                  products={productsQuery.data?.items ?? []}
                  onUpdate={(field, value) => updateItem(index, field, value)}
                  onRemove={() => removeItem(index)}
                />
              ))}
            </div>
            <div className="text-right text-sm font-medium">
              Subtotal: ${subtotal.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-notes">Notes</Label>
            <Textarea
              id="po-notes"
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
              Create Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

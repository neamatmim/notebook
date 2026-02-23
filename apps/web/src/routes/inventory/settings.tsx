import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { orpc } from "@/utils/orpc";

type CostUpdateMethod = "fifo" | "last_cost" | "none" | "weighted_average";

const COST_METHODS: {
  description: string;
  label: string;
  value: CostUpdateMethod;
}[] = [
  {
    description:
      "Product cost price is never changed automatically. Update it manually on the product page.",
    label: "No automatic update",
    value: "none",
  },
  {
    description:
      "Each receipt overwrites the product cost price with the PO unit cost. Simple and predictable.",
    label: "Last purchase cost",
    value: "last_cost",
  },
  {
    description:
      "Blends existing stock cost with the new receipt cost proportionally. Best for accurate COGS tracking.",
    label: "Weighted average cost",
    value: "weighted_average",
  },
  {
    description:
      "Tracks cost per receipt batch. Oldest stock is consumed first; product cost price always reflects the next batch to be sold.",
    label: "FIFO (First In, First Out)",
    value: "fifo",
  },
];

function InventorySettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    orpc.inventory.settings.get.queryOptions({})
  );

  const updateMutation = useMutation({
    ...orpc.inventory.settings.update.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({
        queryKey: orpc.inventory.settings.get.queryOptions({}).queryKey,
      });
    },
  });

  const currentMethod = settings?.costUpdateMethod ?? "none";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Cost Price Update Method</CardTitle>
          <CardDescription>
            Controls how a product&apos;s cost price is updated when goods are
            received from a purchase order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="space-y-3">
              {COST_METHODS.map((method) => (
                <label
                  key={method.value}
                  htmlFor={method.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    currentMethod === method.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    id={method.value}
                    name="costUpdateMethod"
                    value={method.value}
                    checked={currentMethod === method.value}
                    disabled={updateMutation.isPending}
                    onChange={() =>
                      updateMutation.mutate({
                        costUpdateMethod: method.value,
                      })
                    }
                    className="mt-1 accent-blue-600"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor={method.value}
                      className="cursor-pointer font-medium"
                    >
                      {method.label}
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      {method.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="bg-muted rounded-md p-4 text-sm space-y-2">
            <p className="font-medium">How each method works on receipt:</p>
            <ul className="text-muted-foreground list-disc pl-4 space-y-1">
              <li>
                <span className="font-medium text-foreground">None</span> — cost
                price unchanged; the PO unit cost is only recorded in stock
                movements for auditing.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Last purchase cost
                </span>{" "}
                — sets cost price = PO unit cost, regardless of existing cost or
                quantity on hand.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Weighted average
                </span>{" "}
                — new cost = (existing qty × existing cost + received qty × PO
                unit cost) ÷ total qty.
              </li>
              <li>
                <span className="font-medium text-foreground">FIFO</span> — each
                receipt creates a cost layer; layers are consumed oldest first
                on every sale. Cost price always shows the oldest remaining
                batch.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/inventory/settings")({
  component: InventorySettingsPage,
});

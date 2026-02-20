import type { ColumnDef } from "@tanstack/react-table";
import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

type DiscountType = "percentage" | "fixed_amount" | "buy_x_get_y";

interface DiscountForm {
  code: string;
  description: string;
  maxDiscountAmount: string;
  minPurchaseAmount: string;
  name: string;
  type: DiscountType;
  usageLimit: string;
  validFrom: string;
  validUntil: string;
  value: string;
}

const emptyForm = (): DiscountForm => ({
  code: "",
  description: "",
  maxDiscountAmount: "",
  minPurchaseAmount: "",
  name: "",
  type: "percentage",
  usageLimit: "",
  validFrom: "",
  validUntil: "",
  value: "",
});

function DiscountsPage() {
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm());

  const listQuery = useQuery(
    orpc.pos.discounts.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.pos.discounts.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });

  const createMutation = useMutation(
    orpc.pos.discounts.create.mutationOptions({
      onSuccess: () => {
        toast.success("Discount created.");
        invalidate();
        setFormOpen(false);
        setForm(emptyForm());
      },
      onError: (e) => toast.error(e.message ?? "Failed to create discount."),
    })
  );

  const updateMutation = useMutation(
    orpc.pos.discounts.update.mutationOptions({
      onSuccess: () => {
        toast.success("Discount updated.");
        invalidate();
        setFormOpen(false);
        setEditId(null);
        setForm(emptyForm());
      },
      onError: (e) => toast.error(e.message ?? "Failed to update discount."),
    })
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  type DiscountRow = (typeof items)[number];

  const columns: ColumnDef<DiscountRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "code",
      cell: ({ row }) =>
        row.original.code ? (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
            {row.original.code}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Auto</span>
        ),
      header: "Code",
    },
    {
      accessorKey: "type",
      cell: ({ row }) => {
        const colors: Record<string, string> = {
          buy_x_get_y: "bg-purple-100 text-purple-800",
          fixed_amount: "bg-blue-100 text-blue-800",
          percentage: "bg-green-100 text-green-800",
        };
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[row.original.type] ?? ""}`}
          >
            {row.original.type === "percentage"
              ? "%"
              : row.original.type === "fixed_amount"
                ? "$"
                : "BxGy"}
          </span>
        );
      },
      header: "Type",
    },
    {
      accessorKey: "value",
      cell: ({ row }) =>
        row.original.type === "percentage"
          ? `${Number(row.original.value).toFixed(0)}%`
          : `$${Number(row.original.value).toFixed(2)}`,
      header: "Value",
    },
    {
      accessorKey: "minPurchaseAmount",
      cell: ({ row }) =>
        row.original.minPurchaseAmount
          ? `$${Number(row.original.minPurchaseAmount).toFixed(2)}`
          : "—",
      header: "Min Order",
    },
    {
      cell: ({ row }) => {
        const used = row.original.usageCount ?? 0;
        const limit = row.original.usageLimit;
        return limit ? `${used} / ${limit}` : `${used}`;
      },
      header: "Uses",
      id: "usage",
    },
    {
      accessorKey: "validUntil",
      cell: ({ row }) => {
        if (!row.original.validUntil) {
          return "—";
        }
        const d = new Date(row.original.validUntil);
        const expired = d < new Date();
        return (
          <span className={expired ? "text-red-600" : ""}>
            {d.toLocaleDateString()}
            {expired && " (exp)"}
          </span>
        );
      },
      header: "Valid Until",
    },
    {
      accessorKey: "isActive",
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.original.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
      header: "Status",
    },
    {
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const d = row.original;
            setEditId(d.id);
            setForm({
              code: d.code ?? "",
              description: d.description ?? "",
              maxDiscountAmount: d.maxDiscountAmount ?? "",
              minPurchaseAmount: d.minPurchaseAmount ?? "",
              name: d.name,
              type: d.type as DiscountType,
              usageLimit: d.usageLimit?.toString() ?? "",
              validFrom: d.validFrom
                ? new Date(d.validFrom).toISOString().slice(0, 10)
                : "",
              validUntil: d.validUntil
                ? new Date(d.validUntil).toISOString().slice(0, 10)
                : "",
              value: d.value,
            });
            setFormOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code || undefined,
      description: form.description || undefined,
      maxDiscountAmount: form.maxDiscountAmount || undefined,
      minPurchaseAmount: form.minPurchaseAmount || undefined,
      name: form.name,
      type: form.type,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      validFrom: form.validFrom
        ? new Date(form.validFrom).toISOString()
        : undefined,
      validUntil: form.validUntil
        ? new Date(form.validUntil).toISOString()
        : undefined,
      value: form.value,
    };
    if (editId) {
      updateMutation.mutate({ ...payload, id: editId });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const field = (key: keyof DiscountForm) => ({
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    value: form[key],
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discounts</h1>
          <p className="text-muted-foreground">
            Create and manage discount rules and promo codes
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => {
            setEditId(null);
            setForm(emptyForm());
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Discount
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Search discounts..."
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(idx) => setPage(idx)}
        loading={listQuery.isLoading}
      />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditId(null);
            setForm(emptyForm());
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Discount" : "New Discount"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="d-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input id="d-name" required {...field("name")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-type">Type</Label>
                <select
                  id="d-type"
                  {...field("type")}
                  className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount ($)</option>
                  <option value="buy_x_get_y">Buy X Get Y</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-value">
                  Value{" "}
                  <span className="text-muted-foreground text-xs">
                    (
                    {form.type === "percentage" ? "e.g. 10 = 10%" : "e.g. 5.00"}
                    )
                  </span>
                </Label>
                <Input
                  id="d-value"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  {...field("value")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-code">
                  Promo Code{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="d-code"
                  placeholder="SAVE10"
                  {...field("code")}
                  className="uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-min">Min Purchase ($)</Label>
                <Input
                  id="d-min"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field("minPurchaseAmount")}
                />
              </div>

              {form.type === "percentage" && (
                <div className="space-y-1">
                  <Label htmlFor="d-max">Max Discount ($)</Label>
                  <Input
                    id="d-max"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="No limit"
                    {...field("maxDiscountAmount")}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="d-limit">Usage Limit</Label>
                <Input
                  id="d-limit"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  {...field("usageLimit")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-from">Valid From</Label>
                <Input id="d-from" type="date" {...field("validFrom")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-until">Valid Until</Label>
                <Input id="d-until" type="date" {...field("validUntil")} />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="d-desc">Description</Label>
                <Textarea
                  id="d-desc"
                  rows={2}
                  placeholder="Internal notes..."
                  {...field("description")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? "Save Changes" : "Create Discount"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/pos/discounts")({
  component: DiscountsPage,
});

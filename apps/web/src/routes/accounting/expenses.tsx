import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { orpc } from "@/utils/orpc";

type ExpenseStatus = "approved" | "paid" | "pending";

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
};

interface ExpenseForm {
  amount: string;
  categoryAccountId: string;
  date: string;
  description: string;
  notes: string;
  paymentAccountId: string;
  vendorName: string;
}

const EMPTY_FORM: ExpenseForm = {
  amount: "",
  categoryAccountId: "",
  date: "",
  description: "",
  notes: "",
  paymentAccountId: "",
  vendorName: "",
};

function ExpensesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">(
    "all"
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);

  const { data, isLoading } = useQuery(
    orpc.accounting.expenses.list.queryOptions({
      input: {
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        limit: 50,
        offset: 0,
        status: statusFilter === "all" ? undefined : statusFilter,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
      },
    })
  );

  const { data: allAccounts } = useQuery(
    orpc.accounting.accounts.list.queryOptions({
      input: { limit: 200, offset: 0 },
    })
  );

  const expenseAccounts =
    allAccounts?.items.filter((a) => a.type === "expense") ?? [];
  const assetLiabilityAccounts =
    allAccounts?.items.filter(
      (a) => a.type === "asset" || a.type === "liability"
    ) ?? [];

  const createMutation = useMutation({
    ...orpc.accounting.expenses.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    ...orpc.accounting.expenses.approve.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(err.message),
  });

  const paidMutation = useMutation({
    ...orpc.accounting.expenses.markPaid.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    ...orpc.accounting.expenses.delete.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    createMutation.mutate({
      amount: form.amount,
      categoryAccountId: form.categoryAccountId,
      date: `${form.date}T00:00:00.000Z`,
      description: form.description,
      notes: form.notes || undefined,
      paymentAccountId: form.paymentAccountId,
      vendorName: form.vendorName || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Expense</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {(["all", "pending", "approved", "paid"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-36"
              />
              <span className="self-center text-sm">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Expense #</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Vendor</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((exp) => (
                    <tr key={exp.id} className="hover:bg-muted/40 border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {exp.expenseNumber}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {new Date(exp.date).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3">{exp.vendorName ?? "—"}</td>
                      <td className="max-w-xs truncate py-2 pr-3">
                        {exp.description}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {exp.categoryAccount?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${Number(exp.amount).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[exp.status as ExpenseStatus]}`}
                        >
                          {exp.status}
                        </span>
                      </td>
                      <td className="space-x-1 py-2">
                        {exp.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                approveMutation.mutate({ id: exp.id })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                deleteMutation.mutate({ id: exp.id });
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        {exp.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => paidMutation.mutate({ id: exp.id })}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No expenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="exp-amount">Amount ($)</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-desc">Description</Label>
              <Input
                id="exp-desc"
                placeholder="Expense description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="exp-vendor">Vendor Name (optional)</Label>
              <Input
                id="exp-vendor"
                placeholder="Vendor name"
                value={form.vendorName}
                onChange={(e) =>
                  setForm({ ...form, vendorName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="exp-cat">Expense Category Account</Label>
              <Select
                value={form.categoryAccountId || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    categoryAccountId: v === "__none__" ? "" : (v ?? ""),
                  })
                }
              >
                <SelectTrigger id="exp-cat">
                  <SelectValue placeholder="Select expense account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select account</SelectItem>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-pay">Payment Account</Label>
              <Select
                value={form.paymentAccountId || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    paymentAccountId: v === "__none__" ? "" : (v ?? ""),
                  })
                }
              >
                <SelectTrigger id="exp-pay">
                  <SelectValue placeholder="Select payment account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select account</SelectItem>
                  {assetLiabilityAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-notes">Notes (optional)</Label>
              <Input
                id="exp-notes"
                placeholder="Additional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !form.date ||
                !form.description ||
                !form.amount ||
                !form.categoryAccountId ||
                !form.paymentAccountId
              }
            >
              {createMutation.isPending ? "Saving…" : "Create Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/accounting/expenses")({
  component: ExpensesPage,
});

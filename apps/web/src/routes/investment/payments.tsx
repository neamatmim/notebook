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

type PaymentStatus = "overdue" | "paid" | "partial" | "pending" | "waived";
type PaymentType =
  | "capital_call"
  | "capital_contribution"
  | "dividend"
  | "interest"
  | "loan_repayment";

const STATUS_COLORS: Record<PaymentStatus, string> = {
  overdue: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  waived: "bg-gray-100 text-gray-500",
};

const TYPE_LABELS: Record<PaymentType, string> = {
  capital_call: "Capital Call",
  capital_contribution: "Capital Contribution",
  dividend: "Dividend",
  interest: "Interest",
  loan_repayment: "Loan Repayment",
};

interface AddPaymentForm {
  amount: string;
  dueDate: string;
  investorId: string;
  notes: string;
  type: PaymentType;
}

const EMPTY_FORM: AddPaymentForm = {
  amount: "",
  dueDate: "",
  investorId: "",
  notes: "",
  type: "dividend",
};

function PaymentsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<PaymentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">(
    "all"
  );
  const [investorFilter, setInvestorFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddPaymentForm>(EMPTY_FORM);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [markPaidRef, setMarkPaidRef] = useState("");

  const { data, isLoading } = useQuery(
    orpc.investment.payments.list.queryOptions({
      input: {
        investorId: investorFilter === "all" ? undefined : investorFilter,
        limit: 100,
        offset: 0,
        status: statusFilter === "all" ? undefined : statusFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      },
    })
  );

  const { data: investorsData } = useQuery(
    orpc.investment.investors.list.queryOptions({
      input: { limit: 200, offset: 0 },
    })
  );

  const addMutation = useMutation({
    ...orpc.investment.payments.create.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setAddOpen(false);
      setAddForm(EMPTY_FORM);
      toast.success("Payment added");
    },
  });

  const markPaidMutation = useMutation({
    ...orpc.investment.payments.markPaid.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setMarkPaidId(null);
      setMarkPaidRef("");
      toast.success("Payment marked as paid");
    },
  });

  const handleAdd = () => {
    addMutation.mutate({
      amount: addForm.amount,
      dueDate: addForm.dueDate || undefined,
      investorId: addForm.investorId,
      notes: addForm.notes || undefined,
      type: addForm.type,
    });
  };

  const handleMarkPaid = () => {
    if (!markPaidId) {
      return;
    }
    markPaidMutation.mutate({
      id: markPaidId,
      reference: markPaidRef || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button onClick={() => setAddOpen(true)}>Add Payment</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={typeFilter === "all" ? "default" : "outline"}
                onClick={() => setTypeFilter("all")}
              >
                All Types
              </Button>
              {(
                [
                  "dividend",
                  "capital_contribution",
                  "capital_call",
                  "loan_repayment",
                  "interest",
                ] as PaymentType[]
              ).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={typeFilter === t ? "default" : "outline"}
                  onClick={() => setTypeFilter(t)}
                >
                  {TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                All Status
              </Button>
              {(
                ["pending", "partial", "paid", "overdue", "waived"] as const
              ).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Investor:</span>
              <Select
                value={investorFilter}
                onValueChange={(v) => setInvestorFilter(v ?? "all")}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Investors</SelectItem>
                  {investorsData?.items.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    <th className="py-2 pr-3 font-medium">Investor</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Due Date</th>
                    <th className="py-2 pr-3 font-medium">Paid Date</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((p) => (
                    <tr
                      key={p.paymentId}
                      className="hover:bg-muted/40 border-b"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {p.investorName}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {TYPE_LABELS[p.type as PaymentType] ?? p.type}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        $
                        {Number(p.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {p.dueDate
                          ? new Date(p.dueDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {p.paidDate
                          ? new Date(p.paidDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[p.status as PaymentStatus] ?? ""}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="text-muted-foreground py-2 pr-3 font-mono text-xs">
                        {p.reference ?? "—"}
                      </td>
                      <td className="py-2">
                        {p.status !== "paid" && p.status !== "waived" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMarkPaidId(p.paymentId);
                              setMarkPaidRef("");
                            }}
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
                        No payments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="pay-investor">Investor</Label>
              <Select
                value={addForm.investorId}
                onValueChange={(v) =>
                  setAddForm({ ...addForm, investorId: v ?? "" })
                }
              >
                <SelectTrigger id="pay-investor">
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {investorsData?.items.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-type">Type</Label>
              <Select
                value={addForm.type}
                onValueChange={(v) =>
                  setAddForm({ ...addForm, type: v as PaymentType })
                }
              >
                <SelectTrigger id="pay-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [PaymentType, string][]).map(
                    ([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-amount">Amount ($)</Label>
              <Input
                id="pay-amount"
                type="number"
                placeholder="1000.00"
                value={addForm.amount}
                onChange={(e) =>
                  setAddForm({ ...addForm, amount: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="pay-due">Due Date</Label>
              <Input
                id="pay-due"
                type="date"
                value={addForm.dueDate}
                onChange={(e) =>
                  setAddForm({ ...addForm, dueDate: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="pay-notes">Notes</Label>
              <Input
                id="pay-notes"
                placeholder="Notes"
                value={addForm.notes}
                onChange={(e) =>
                  setAddForm({ ...addForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setAddForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                addMutation.isPending || !addForm.investorId || !addForm.amount
              }
            >
              {addMutation.isPending ? "Saving…" : "Add Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog
        open={!!markPaidId}
        onOpenChange={(open) => {
          if (!open) {
            setMarkPaidId(null);
            setMarkPaidRef("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mp-ref">Reference (optional)</Label>
              <Input
                id="mp-ref"
                placeholder="Cheque or transfer reference"
                value={markPaidRef}
                onChange={(e) => setMarkPaidRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMarkPaidId(null);
                setMarkPaidRef("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? "Saving…" : "Confirm Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/payments")({
  component: PaymentsPage,
});

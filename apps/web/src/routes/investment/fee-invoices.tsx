import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

type InvoiceStatus = "overdue" | "paid" | "pending" | "waived";

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  overdue: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  pending: "bg-blue-100 text-blue-700",
  waived: "bg-gray-100 text-gray-500",
};

function formatDate(d: Date | null | string | undefined) {
  if (!d) {
    return "—";
  }
  return new Date(d).toLocaleDateString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function FeeInvoicesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">(
    "all"
  );
  const [scheduleFilter, setScheduleFilter] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<null | string>(null);
  const [waiveId, setWaiveId] = useState<null | string>(null);
  const [paidDate, setPaidDate] = useState(today());
  const [waiveReason, setWaiveReason] = useState("");

  const listInput = {
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(scheduleFilter ? { scheduleId: scheduleFilter } : {}),
    limit: 50,
    offset: 0,
  };

  const invoicesQuery = useQuery(
    orpc.investment.membershipFees.invoices.list.queryOptions({
      input: listInput,
    })
  );
  const schedulesQuery = useQuery(
    orpc.investment.membershipFees.schedules.list.queryOptions({ input: {} })
  );

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.investment.membershipFees.invoices.list.queryOptions({
        input: listInput,
      }).queryKey,
    });

  const generateMutation = useMutation(
    orpc.investment.membershipFees.invoices.generate.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        toast.success(
          `Generated ${data.generated} invoices, skipped ${data.skipped} duplicates`
        );
        invalidateList();
        setGenerateOpen(false);
      },
    })
  );

  const markPaidMutation = useMutation(
    orpc.investment.membershipFees.invoices.markPaid.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Invoice marked as paid");
        invalidateList();
        setMarkPaidId(null);
      },
    })
  );

  const waiveMutation = useMutation(
    orpc.investment.membershipFees.invoices.waive.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Invoice waived");
        invalidateList();
        setWaiveId(null);
        setWaiveReason("");
      },
    })
  );

  const markOverdueMutation = useMutation(
    orpc.investment.membershipFees.invoices.markOverdue.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        toast.success(`${data.updated} invoices marked overdue`);
        invalidateList();
      },
    })
  );

  const invoices = invoicesQuery.data?.items ?? [];
  const schedules = schedulesQuery.data?.items ?? [];

  function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    generateMutation.mutate({
      dueDate: String(data.get("dueDate")),
      periodEnd: String(data.get("periodEnd")),
      periodLabel: String(data.get("periodLabel")),
      periodStart: String(data.get("periodStart")),
      scheduleId: String(data.get("scheduleId")),
    });
  }

  const STATUS_BUTTONS: { label: string; value: "all" | InvoiceStatus }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Paid", value: "paid" },
    { label: "Overdue", value: "overdue" },
    { label: "Waived", value: "waived" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee Invoices</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Membership fee invoices generated per period.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => markOverdueMutation.mutate({})}
            disabled={markOverdueMutation.isPending}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Mark Overdue
          </Button>
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Invoices
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">
          {STATUS_BUTTONS.map((btn) => (
            <Button
              key={btn.value}
              size="sm"
              variant={statusFilter === btn.value ? "default" : "outline"}
              onClick={() => setStatusFilter(btn.value)}
            >
              {btn.label}
            </Button>
          ))}
        </div>
        <Select
          value={scheduleFilter}
          onValueChange={(v) => setScheduleFilter(v ?? "")}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All schedules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All schedules</SelectItem>
            {schedules.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {invoicesQuery.isPending ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Invoice #</th>
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Schedule</th>
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium">Shares</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Due Date</th>
                    <th className="pb-2 font-medium">Paid Date</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2">{inv.investorName}</td>
                      <td className="py-2">{inv.scheduleName}</td>
                      <td className="py-2">{inv.periodLabel}</td>
                      <td className="py-2">{inv.shareCount}</td>
                      <td className="py-2">{Number(inv.amount).toFixed(2)}</td>
                      <td className="py-2">{formatDate(inv.dueDate)}</td>
                      <td className="py-2">{formatDate(inv.paidAt)}</td>
                      <td className="py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[inv.status as InvoiceStatus] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="space-x-1 py-2">
                        {(inv.status === "pending" ||
                          inv.status === "overdue") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setMarkPaidId(inv.id);
                                setPaidDate(today());
                              }}
                            >
                              Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setWaiveId(inv.id);
                                setWaiveReason("");
                              }}
                            >
                              Waive
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Invoices</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1">
              <Label>Schedule *</Label>
              <Select name="scheduleId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  {schedules
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Period Label *</Label>
              <Input name="periodLabel" required placeholder="e.g. Q1 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Period Start *</Label>
                <Input name="periodStart" required type="date" />
              </div>
              <div className="space-y-1">
                <Label>Period End *</Label>
                <Input name="periodEnd" required type="date" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Due Date *</Label>
              <Input name="dueDate" required type="date" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenerateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog
        open={!!markPaidId}
        onOpenChange={(open) => !open && setMarkPaidId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="paidDate">Paid Date</Label>
              <Input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidId(null)}>
              Cancel
            </Button>
            <Button
              disabled={markPaidMutation.isPending}
              onClick={() => {
                if (markPaidId) {
                  markPaidMutation.mutate({
                    id: markPaidId,
                    paidAt: paidDate,
                  });
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Dialog */}
      <Dialog
        open={!!waiveId}
        onOpenChange={(open) => {
          if (!open) {
            setWaiveId(null);
            setWaiveReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Waive Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="waiveReason">Reason *</Label>
              <Textarea
                id="waiveReason"
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                rows={3}
                placeholder="Reason for waiving this invoice…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWaiveId(null);
                setWaiveReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!waiveReason.trim() || waiveMutation.isPending}
              onClick={() => {
                if (waiveId && waiveReason.trim()) {
                  waiveMutation.mutate({ id: waiveId, reason: waiveReason });
                }
              }}
            >
              Waive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/fee-invoices")({
  component: FeeInvoicesPage,
});

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

type CallStatus =
  | "cancelled"
  | "draft"
  | "fully_paid"
  | "issued"
  | "partially_paid";

const STATUS_COLORS: Record<CallStatus, string> = {
  cancelled: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
  fully_paid: "bg-green-100 text-green-700",
  issued: "bg-blue-100 text-blue-700",
  partially_paid: "bg-yellow-100 text-yellow-700",
};

interface CallForm {
  amountPerShare: string;
  callDate: string;
  description: string;
  dueDate: string;
  notes: string;
  shareClassId: string;
}

const EMPTY_FORM: CallForm = {
  amountPerShare: "",
  callDate: new Date().toISOString().slice(0, 10),
  description: "",
  dueDate: "",
  notes: "",
  shareClassId: "",
};

function CapitalCallsPage() {
  const queryClient = useQueryClient();
  const [shareClassFilter, setShareClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CallForm>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery(
    orpc.investment.capitalCalls.list.queryOptions({
      input: {
        shareClassId: shareClassFilter === "all" ? undefined : shareClassFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    })
  );

  const { data: shareClassesData } = useQuery(
    orpc.investment.shareClasses.list.queryOptions()
  );

  const { data: expandedData } = useQuery({
    ...orpc.investment.capitalCalls.get.queryOptions({
      input: { id: expandedId ?? "" },
    }),
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    ...orpc.investment.capitalCalls.create.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Capital call created");
    },
  });

  const issueMutation = useMutation({
    ...orpc.investment.capitalCalls.issue.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Capital call issued — payments created");
    },
  });

  const cancelMutation = useMutation({
    ...orpc.investment.capitalCalls.cancel.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Capital call cancelled");
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      amountPerShare: form.amountPerShare,
      callDate: form.callDate,
      description: form.description,
      dueDate: form.dueDate,
      notes: form.notes || undefined,
      shareClassId: form.shareClassId,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Capital Calls</h1>
        <Button onClick={() => setCreateOpen(true)}>New Capital Call</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={shareClassFilter === "all" ? "default" : "outline"}
                onClick={() => setShareClassFilter("all")}
              >
                All Classes
              </Button>
              {shareClassesData?.items.map((sc) => (
                <Button
                  key={sc.id}
                  size="sm"
                  variant={shareClassFilter === sc.id ? "default" : "outline"}
                  onClick={() => setShareClassFilter(sc.id)}
                >
                  {sc.code}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  "all",
                  "draft",
                  "issued",
                  "partially_paid",
                  "fully_paid",
                  "cancelled",
                ] as const
              ).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "All" : s.replace("_", " ")}
                </Button>
              ))}
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
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Share Class</th>
                    <th className="py-2 pr-3 font-medium">Call Date</th>
                    <th className="py-2 pr-3 font-medium">Due Date</th>
                    <th className="py-2 pr-3 font-medium">Amt/Share</th>
                    <th className="py-2 pr-3 font-medium">Total Called</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((call) => (
                    <>
                      <tr
                        key={call.capitalCallId}
                        className="hover:bg-muted/40 border-b cursor-pointer"
                        onClick={() =>
                          setExpandedId(
                            expandedId === call.capitalCallId
                              ? null
                              : call.capitalCallId
                          )
                        }
                      >
                        <td className="py-2 pr-3 font-medium">
                          {call.description}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="font-mono text-xs">
                            {call.shareClassCode}
                          </span>
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {new Date(call.callDate).toLocaleDateString()}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {new Date(call.dueDate).toLocaleDateString()}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          ${call.amountPerShare}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {call.totalAmountCalled
                            ? `$${Number(call.totalAmountCalled).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[call.status as CallStatus] ?? ""}`}
                          >
                            {call.status.replace("_", " ")}
                          </span>
                        </td>
                        <td
                          className="space-x-1 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {call.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                issueMutation.mutate({ id: call.capitalCallId })
                              }
                              disabled={issueMutation.isPending}
                            >
                              Issue
                            </Button>
                          )}
                          {(call.status === "draft" ||
                            call.status === "issued") && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                cancelMutation.mutate({
                                  id: call.capitalCallId,
                                })
                              }
                              disabled={cancelMutation.isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expandedId === call.capitalCallId &&
                        expandedData?.payments && (
                          <tr key={`${call.capitalCallId}-expanded`}>
                            <td colSpan={8} className="bg-muted/20 px-4 py-3">
                              <p className="mb-2 text-xs font-semibold">
                                Per-shareholder payments
                              </p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-left">
                                    <th className="pb-1 pr-3">Investor</th>
                                    <th className="pb-1 pr-3">Amount</th>
                                    <th className="pb-1 pr-3">Due Date</th>
                                    <th className="pb-1">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedData.payments.map((p) => (
                                    <tr key={p.paymentId}>
                                      <td className="py-1 pr-3">
                                        {p.investorName}
                                      </td>
                                      <td className="py-1 pr-3">
                                        ${Number(p.amount).toLocaleString()}
                                      </td>
                                      <td className="text-muted-foreground py-1 pr-3">
                                        {p.dueDate
                                          ? new Date(
                                              p.dueDate
                                            ).toLocaleDateString()
                                          : "—"}
                                      </td>
                                      <td className="py-1">
                                        <span
                                          className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-semibold ${p.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                                        >
                                          {p.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                    </>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No capital calls found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Capital Call</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="cc-desc">Description</Label>
              <Input
                id="cc-desc"
                placeholder="Q1 2026 Capital Call"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="cc-sc">Share Class</Label>
              <Select
                value={form.shareClassId}
                onValueChange={(v) =>
                  setForm({ ...form, shareClassId: v ?? "" })
                }
              >
                <SelectTrigger id="cc-sc">
                  <SelectValue placeholder="Select share class" />
                </SelectTrigger>
                <SelectContent>
                  {shareClassesData?.items.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.code} — {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cc-amt">Amount Per Share ($)</Label>
              <Input
                id="cc-amt"
                type="number"
                placeholder="0.50"
                value={form.amountPerShare}
                onChange={(e) =>
                  setForm({ ...form, amountPerShare: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="cc-call">Call Date</Label>
              <Input
                id="cc-call"
                type="date"
                value={form.callDate}
                onChange={(e) => setForm({ ...form, callDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cc-due">Due Date</Label>
              <Input
                id="cc-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="cc-notes">Notes</Label>
              <Input
                id="cc-notes"
                placeholder="Notes"
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
                !form.description ||
                !form.shareClassId ||
                !form.amountPerShare ||
                !form.dueDate
              }
            >
              {createMutation.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/capital-calls")({
  component: CapitalCallsPage,
});

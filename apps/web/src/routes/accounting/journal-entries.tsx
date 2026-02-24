import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { orpc } from "@/utils/orpc";

type JEStatus = "draft" | "posted" | "void";
type SourceType =
  | "expense"
  | "manual"
  | "membership_fee"
  | "purchase_order"
  | "return"
  | "sale";

const STATUS_COLORS: Record<JEStatus, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  posted: "bg-green-100 text-green-700",
  void: "bg-gray-100 text-gray-700",
};

const SOURCE_COLORS: Record<SourceType, string> = {
  expense: "bg-orange-100 text-orange-700",
  manual: "bg-blue-100 text-blue-700",
  membership_fee: "bg-emerald-100 text-emerald-700",
  purchase_order: "bg-indigo-100 text-indigo-700",
  return: "bg-red-100 text-red-700",
  sale: "bg-purple-100 text-purple-700",
};

interface LineItem {
  accountId: string;
  amount: string;
  description: string;
  type: "credit" | "debit";
}

function JournalEntriesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<JEStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  // Void confirmation state
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [jeDate, setJeDate] = useState("");
  const [jeDesc, setJeDesc] = useState("");
  const [jeRef, setJeRef] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { accountId: "", amount: "", description: "", type: "debit" },
    { accountId: "", amount: "", description: "", type: "credit" },
  ]);

  const { data, isLoading } = useQuery(
    orpc.accounting.journalEntries.list.queryOptions({
      input: {
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        limit: 50,
        offset: 0,
        status: statusFilter === "all" ? undefined : statusFilter,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
      },
    })
  );

  const { data: entryDetail } = useQuery(
    orpc.accounting.journalEntries.get.queryOptions({
      input: { id: viewId ?? "" },
      enabled: !!viewId,
    })
  );

  const { data: allAccounts } = useQuery(
    orpc.accounting.accounts.list.queryOptions({
      input: { limit: 200, offset: 0 },
    })
  );

  const createMutation = useMutation({
    ...orpc.accounting.journalEntries.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const postMutation = useMutation({
    ...orpc.accounting.journalEntries.post.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Journal entry posted.");
    },
    onError: (err) => toast.error(err.message),
  });

  const voidMutation = useMutation({
    ...orpc.accounting.journalEntries.void.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setVoidId(null);
      setVoidReason("");
      // Refresh detail view if we just voided the open entry
      toast.success("Journal entry voided.");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setJeDate("");
    setJeDesc("");
    setJeRef("");
    setLines([
      { accountId: "", amount: "", description: "", type: "debit" },
      { accountId: "", amount: "", description: "", type: "credit" },
    ]);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { accountId: "", amount: "", description: "", type: "debit" },
    ]);
  };

  const removeLine = (i: number) => {
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const totalDR = lines
    .filter((l) => l.type === "debit")
    .reduce((s, l) => s + Number(l.amount || 0), 0);
  const totalCR = lines
    .filter((l) => l.type === "credit")
    .reduce((s, l) => s + Number(l.amount || 0), 0);
  const balanced = Math.abs(totalDR - totalCR) < 0.001;

  const handleCreate = () => {
    const validLines = lines.filter((l) => l.accountId && Number(l.amount) > 0);
    createMutation.mutate({
      date: `${jeDate}T00:00:00.000Z`,
      description: jeDesc,
      lines: validLines.map((l) => ({
        accountId: l.accountId,
        amount: l.amount,
        description: l.description || undefined,
        type: l.type,
      })),
      reference: jeRef || undefined,
      sourceType: "manual",
    });
  };

  const openVoidDialog = (id: string) => {
    setVoidId(id);
    setVoidReason("");
  };

  const confirmVoid = () => {
    if (!voidId) {
      return;
    }
    if (!voidReason.trim()) {
      toast.error("A reason is required to void a journal entry");
      return;
    }
    voidMutation.mutate({
      id: voidId,
      reason: voidReason.trim(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        <Button onClick={() => setCreateOpen(true)}>New Entry</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {(["all", "draft", "posted", "void"] as const).map((s) => (
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
                    <th className="py-2 pr-3 font-medium">Entry #</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 text-right font-medium">Debit</th>
                    <th className="py-2 pr-3 text-right font-medium">Credit</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-muted/40 cursor-pointer border-b"
                      onClick={() => setViewId(entry.id)}
                    >
                      <td className="py-2 pr-3 font-mono text-xs">
                        {entry.entryNumber}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="max-w-xs truncate py-2 pr-3">
                        {entry.description}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_COLORS[entry.sourceType as SourceType]}`}
                        >
                          {entry.sourceType}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[entry.status as JEStatus]}`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${Number(entry.totalDebit).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${Number(entry.totalCredit).toFixed(2)}
                      </td>
                      <td
                        className="space-x-1 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              postMutation.mutate({ id: entry.id })
                            }
                            disabled={postMutation.isPending}
                          >
                            Post
                          </Button>
                        )}
                        {entry.status === "posted" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openVoidDialog(entry.id)}
                            disabled={voidMutation.isPending}
                          >
                            Void
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
                        No journal entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View / Detail Dialog */}
      {viewId && entryDetail && (
        <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {entryDetail.entryNumber} — {entryDetail.description}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-4">
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(entryDetail.date).toLocaleDateString()}</span>
                <span className="text-muted-foreground">Status:</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[entryDetail.status as JEStatus]}`}
                >
                  {entryDetail.status}
                </span>
                <span className="text-muted-foreground">Source:</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_COLORS[entryDetail.sourceType as SourceType]}`}
                >
                  {entryDetail.sourceType}
                </span>
              </div>
              {entryDetail.reference && (
                <p>
                  <span className="text-muted-foreground">Ref:</span>{" "}
                  {entryDetail.reference}
                </p>
              )}
              {entryDetail.status === "void" && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  <p className="font-medium">Voided</p>
                  {entryDetail.voidedAt && (
                    <p className="text-xs">
                      {new Date(entryDetail.voidedAt).toLocaleString()}
                    </p>
                  )}
                  {entryDetail.voidReason && (
                    <p className="mt-1 text-xs">
                      Reason: {entryDetail.voidReason}
                    </p>
                  )}
                </div>
              )}
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 pr-3 text-left font-medium">Account</th>
                    <th className="py-1 pr-3 text-left font-medium">Type</th>
                    <th className="py-1 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entryDetail.lines.map((line) => (
                    <tr key={line.id} className="border-b">
                      <td className="py-1 pr-3">
                        {line.accountCode} — {line.accountName}
                      </td>
                      <td className="py-1 pr-3 capitalize">{line.type}</td>
                      <td className="py-1 text-right font-mono">
                        ${Number(line.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              {entryDetail.status === "posted" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewId(null);
                    openVoidDialog(entryDetail.id);
                  }}
                >
                  Void Entry
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewId(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Void Confirmation Dialog */}
      <Dialog
        open={!!voidId}
        onOpenChange={(open) => {
          if (!open) {
            setVoidId(null);
            setVoidReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Void Journal Entry</DialogTitle>
            <DialogDescription>
              This will reverse all account balance changes made by this entry.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="void-reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="void-reason"
              placeholder="e.g. Entered in wrong period, duplicate entry…"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidId(null);
                setVoidReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={voidMutation.isPending || !voidReason.trim()}
              onClick={confirmVoid}
            >
              {voidMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="je-date">Date</Label>
                <Input
                  id="je-date"
                  type="date"
                  value={jeDate}
                  onChange={(e) => setJeDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="je-ref">Reference (optional)</Label>
                <Input
                  id="je-ref"
                  placeholder="Reference"
                  value={jeRef}
                  onChange={(e) => setJeRef(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="je-desc">Description</Label>
              <Input
                id="je-desc"
                placeholder="Description"
                value={jeDesc}
                onChange={(e) => setJeDesc(e.target.value)}
              />
            </div>

            {/* Lines */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Entry Lines</Label>
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={line.accountId || "__none__"}
                      onValueChange={(v) =>
                        updateLine(i, {
                          accountId: !v || v === "__none__" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select account</SelectItem>
                        {allAccounts?.items.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={line.type}
                      onValueChange={(v) =>
                        updateLine(i, { type: v as "credit" | "debit" })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Debit</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(e) =>
                        updateLine(i, { amount: e.target.value })
                      }
                      className="w-28"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLine(i)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div
                className={`mt-2 flex gap-4 rounded p-2 text-sm font-medium ${balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
              >
                <span>Debits: ${totalDR.toFixed(2)}</span>
                <span>Credits: ${totalCR.toFixed(2)}</span>
                <span>{balanced ? "✓ Balanced" : "⚠ Unbalanced"}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending || !jeDate || !jeDesc || !balanced
              }
            >
              {createMutation.isPending ? "Saving…" : "Save as Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/accounting/journal-entries")({
  component: JournalEntriesPage,
});

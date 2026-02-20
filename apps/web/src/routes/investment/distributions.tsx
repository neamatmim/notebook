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

type DistributionStatus = "cancelled" | "paid" | "pending" | "scheduled";
type DistributionType =
  | "capital_return"
  | "dividend"
  | "interest"
  | "profit_share";

const STATUS_COLORS: Record<DistributionStatus, string> = {
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  scheduled: "bg-blue-100 text-blue-700",
};

interface CreateDistributionForm {
  distributionDate: string;
  notes: string;
  periodEnd: string;
  periodStart: string;
  projectId: string;
  totalAmount: string;
  type: string;
}

const EMPTY_FORM: CreateDistributionForm = {
  distributionDate: "",
  notes: "",
  periodEnd: "",
  periodStart: "",
  projectId: "",
  totalAmount: "",
  type: "",
};

function DistributionsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DistributionStatus | "all">(
    "all"
  );
  const [projectFilter, setProjectFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateDistributionForm>(EMPTY_FORM);
  const [preview, setPreview] = useState<
    { amount: string; equityPercentage: number; investorId: string }[] | null
  >(null);

  const { data: projects } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: { limit: 100, offset: 0 },
    })
  );

  const { data, isLoading } = useQuery(
    orpc.investment.distributions.list.queryOptions({
      input: {
        limit: 50,
        offset: 0,
        projectId: projectFilter || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    })
  );

  const calculateMutation = useMutation({
    ...orpc.investment.distributions.calculate.mutationOptions(),
    onSuccess: (result) => {
      setPreview(result.breakdown);
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = useMutation({
    ...orpc.investment.distributions.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setPreview(null);
      toast.success("Distributions created");
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    ...orpc.investment.distributions.markPaid.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Distribution marked as paid");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Distributions</h1>
        <Button onClick={() => setCreateOpen(true)}>Create Distribution</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {(
              ["all", "scheduled", "pending", "paid", "cancelled"] as const
            ).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            <Select
              value={projectFilter || "__all__"}
              onValueChange={(v) =>
                setProjectFilter(v === "__all__" ? "" : (v ?? ""))
              }
            >
              <SelectTrigger className="ml-auto w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Projects</SelectItem>
                {projects?.items.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium text-right">Amount</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((dist) => (
                    <tr key={dist.id} className="hover:bg-muted/40 border-b">
                      <td className="text-muted-foreground py-2 pr-3">
                        {new Date(dist.distributionDate).toLocaleDateString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {dist.type.replaceAll("_", " ")}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${Number(dist.amount).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[dist.status as DistributionStatus] ?? ""}`}
                        >
                          {dist.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {dist.status !== "paid" &&
                          dist.status !== "cancelled" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                markPaidMutation.mutate({ id: dist.id })
                              }
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
                        colSpan={5}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No distributions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setForm(EMPTY_FORM);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Distribution</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dist-project">Project</Label>
              <Select
                value={form.projectId || "__none__"}
                onValueChange={(v) => {
                  setForm({
                    ...form,
                    projectId: v === "__none__" ? "" : (v ?? ""),
                  });
                  setPreview(null);
                }}
              >
                <SelectTrigger id="dist-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select project</SelectItem>
                  {projects?.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dist-type">Distribution Type</Label>
                <Select
                  value={form.type || "__none__"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      type: v === "__none__" ? "" : (v ?? ""),
                    })
                  }
                >
                  <SelectTrigger id="dist-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select type</SelectItem>
                    <SelectItem value="dividend">Dividend</SelectItem>
                    <SelectItem value="interest">Interest</SelectItem>
                    <SelectItem value="capital_return">
                      Capital Return
                    </SelectItem>
                    <SelectItem value="profit_share">Profit Share</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dist-amount">Total Amount ($)</Label>
                <Input
                  id="dist-amount"
                  type="number"
                  placeholder="10000"
                  value={form.totalAmount}
                  onChange={(e) => {
                    setForm({ ...form, totalAmount: e.target.value });
                    setPreview(null);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="dist-date">Distribution Date</Label>
                <Input
                  id="dist-date"
                  type="date"
                  value={form.distributionDate}
                  onChange={(e) =>
                    setForm({ ...form, distributionDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="dist-notes">Notes</Label>
                <Input
                  id="dist-notes"
                  placeholder="Q1 dividend"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            {form.projectId && form.totalAmount && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  calculateMutation.mutate({
                    projectId: form.projectId,
                    totalAmount: form.totalAmount,
                  })
                }
                disabled={calculateMutation.isPending}
              >
                {calculateMutation.isPending
                  ? "Calculating…"
                  : "Preview Breakdown"}
              </Button>
            )}

            {preview && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">Pro-rata breakdown:</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1 text-left">Investor</th>
                      <th className="py-1 text-right">Equity %</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item) => (
                      <tr key={item.investorId} className="border-b">
                        <td className="text-muted-foreground py-1 font-mono text-xs">
                          {item.investorId.slice(0, 8)}…
                        </td>
                        <td className="py-1 text-right">
                          {(item.equityPercentage * 100).toFixed(2)}%
                        </td>
                        <td className="py-1 text-right font-mono">
                          ${Number(item.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setForm(EMPTY_FORM);
                setPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                createMutation.mutate({
                  distributionDate: form.distributionDate,
                  notes: form.notes || undefined,
                  projectId: form.projectId,
                  totalAmount: form.totalAmount,
                  type: form.type as DistributionType,
                });
              }}
              disabled={
                createMutation.isPending ||
                !form.projectId ||
                !form.type ||
                !form.totalAmount ||
                !form.distributionDate
              }
            >
              {createMutation.isPending ? "Creating…" : "Create Distributions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/distributions")({
  component: DistributionsPage,
});

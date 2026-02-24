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

type InvestmentStatus = "active" | "defaulted" | "exited" | "pending";

const STATUS_COLORS: Record<InvestmentStatus, string> = {
  active: "bg-green-100 text-green-700",
  defaulted: "bg-red-100 text-red-700",
  exited: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
};

function InvestmentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InvestmentStatus | "all">(
    "all"
  );
  const [projectFilter, setProjectFilter] = useState("");
  const [investOpen, setInvestOpen] = useState(false);
  const [exitId, setExitId] = useState<null | string>(null);

  const [investForm, setInvestForm] = useState({
    amount: "",
    investmentDate: new Date().toISOString().slice(0, 10),
    investorId: "",
    notes: "",
    projectId: "",
  });
  const [exitForm, setExitForm] = useState({
    actualReturnAmount: "",
    exitDate: new Date().toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery(
    orpc.investment.investments.list.queryOptions({
      input: {
        projectId: projectFilter || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 100,
        offset: 0,
      },
    })
  );

  const { data: projects } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: { limit: 100, offset: 0 },
    })
  );

  const { data: investors } = useQuery(
    orpc.investment.investors.list.queryOptions({
      input: { kycStatus: "approved", limit: 200, offset: 0 },
    })
  );

  const investMutation = useMutation({
    ...orpc.investment.investments.invest.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setInvestOpen(false);
      setInvestForm({
        amount: "",
        investmentDate: new Date().toISOString().slice(0, 10),
        investorId: "",
        notes: "",
        projectId: "",
      });
      toast.success("Investment recorded");
    },
    onError: (err) => toast.error(err.message),
  });

  const exitMutation = useMutation({
    ...orpc.investment.investments.exit.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setExitId(null);
      setExitForm({
        actualReturnAmount: "",
        exitDate: new Date().toISOString().slice(0, 10),
      });
      toast.success("Investment exited");
    },
    onError: (err) => toast.error(err.message),
  });

  const projectMap = new Map(projects?.items.map((p) => [p.id, p.name]));
  const investorMap = new Map(investors?.items.map((i) => [i.id, i.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Investments</h1>
        <Button onClick={() => setInvestOpen(true)}>Record Investment</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {(["all", "pending", "active", "exited", "defaulted"] as const).map(
              (s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              )
            )}
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
                    <th className="py-2 pr-3 font-medium">Investor</th>
                    <th className="py-2 pr-3 font-medium">Project</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Equity %</th>
                    <th className="py-2 pr-3 font-medium">Return</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/40 border-b">
                      <td className="py-2 pr-3 font-medium">
                        {investorMap.get(inv.investorId) ?? inv.investorId}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {projectMap.get(inv.projectId) ?? inv.projectId}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        ${Number(inv.amount).toLocaleString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {inv.equityPercentage
                          ? `${(Number(inv.equityPercentage) * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        ${Number(inv.actualReturnAmount).toLocaleString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {new Date(inv.investmentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[inv.status as InvestmentStatus] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {inv.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setExitId(inv.id);
                              setExitForm({
                                actualReturnAmount: "",
                                exitDate: new Date().toISOString().slice(0, 10),
                              });
                            }}
                          >
                            Exit
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
                        No investments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Investment Dialog */}
      <Dialog open={investOpen} onOpenChange={setInvestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Investment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project</Label>
              <Select
                value={investForm.projectId}
                onValueChange={(v) =>
                  setInvestForm({ ...investForm, projectId: v ?? "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.items
                    .filter(
                      (p) => p.status === "funding" || p.status === "active"
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Investor (KYC Approved)</Label>
              <Select
                value={investForm.investorId}
                onValueChange={(v) =>
                  setInvestForm({ ...investForm, investorId: v ?? "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {investors?.items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={investForm.amount}
                  onChange={(e) =>
                    setInvestForm({ ...investForm, amount: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Investment Date</Label>
                <Input
                  type="date"
                  value={investForm.investmentDate}
                  onChange={(e) =>
                    setInvestForm({
                      ...investForm,
                      investmentDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={investForm.notes}
                onChange={(e) =>
                  setInvestForm({ ...investForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                investMutation.isPending ||
                !investForm.projectId ||
                !investForm.investorId ||
                !investForm.amount
              }
              onClick={() =>
                investMutation.mutate({
                  amount: investForm.amount,
                  investmentDate: investForm.investmentDate,
                  investorId: investForm.investorId,
                  notes: investForm.notes || undefined,
                  projectId: investForm.projectId,
                })
              }
            >
              {investMutation.isPending ? "Saving…" : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Dialog */}
      <Dialog open={!!exitId} onOpenChange={(open) => !open && setExitId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Investment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Actual Return Amount ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={exitForm.actualReturnAmount}
                onChange={(e) =>
                  setExitForm({
                    ...exitForm,
                    actualReturnAmount: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Exit Date</Label>
              <Input
                type="date"
                value={exitForm.exitDate}
                onChange={(e) =>
                  setExitForm({ ...exitForm, exitDate: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitId(null)}>
              Cancel
            </Button>
            <Button
              disabled={exitMutation.isPending || !exitForm.actualReturnAmount}
              onClick={() => {
                if (!exitId) {
                  return;
                }
                exitMutation.mutate({
                  actualReturnAmount: exitForm.actualReturnAmount,
                  exitDate: exitForm.exitDate,
                  id: exitId,
                });
              }}
            >
              {exitMutation.isPending ? "Saving…" : "Confirm Exit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/investments")({
  component: InvestmentsPage,
});

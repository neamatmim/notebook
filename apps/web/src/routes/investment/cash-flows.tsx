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

function CashFlowsPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<{
    id: string;
    actualInflow: string;
    actualOutflow: string;
  } | null>(null);
  const [form, setForm] = useState({
    description: "",
    periodDate: new Date().toISOString().slice(0, 10),
    periodNumber: "1",
    projectedInflow: "",
    projectedOutflow: "",
  });

  const { data: projects } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: { limit: 100, offset: 0 },
    })
  );

  const { data: cashFlows, isLoading } = useQuery({
    ...orpc.investment.cashFlows.list.queryOptions({
      input: { projectId },
    }),
    enabled: !!projectId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.investment.cashFlows.list.queryOptions({
        input: { projectId },
      }).queryKey,
    });

  const createMutation = useMutation(
    orpc.investment.cashFlows.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Cash flow period created");
        invalidate();
        setCreateOpen(false);
        setForm({
          description: "",
          periodDate: new Date().toISOString().slice(0, 10),
          periodNumber: "1",
          projectedInflow: "",
          projectedOutflow: "",
        });
      },
    })
  );

  const updateMutation = useMutation(
    orpc.investment.cashFlows.updateActual.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Actuals updated");
        invalidate();
        setEditItem(null);
      },
    })
  );

  const items = cashFlows?.items ?? [];

  const totalProjInflow = items.reduce(
    (s, r) => s + Number(r.projectedInflow),
    0
  );
  const totalProjOutflow = items.reduce(
    (s, r) => s + Number(r.projectedOutflow),
    0
  );
  const totalActualInflow = items.reduce(
    (s, r) => s + Number(r.actualInflow),
    0
  );
  const totalActualOutflow = items.reduce(
    (s, r) => s + Number(r.actualOutflow),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cash Flow Projections</h1>
        <div className="flex items-center gap-3">
          <Select
            value={projectId || "__none__"}
            onValueChange={(v) =>
              setProjectId(v === "__none__" ? "" : (v ?? ""))
            }
          >
            <SelectTrigger className="w-56">
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
          <Button disabled={!projectId} onClick={() => setCreateOpen(true)}>
            Add Period
          </Button>
        </div>
      </div>

      {!projectId && (
        <p className="text-muted-foreground py-12 text-center">
          Select a project to view its cash flow projections.
        </p>
      )}

      {projectId && isLoading && (
        <p className="text-muted-foreground py-12 text-center">Loading…</p>
      )}

      {projectId && !isLoading && (
        <Card>
          <CardHeader />
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No periods yet. Click &quot;Add Period&quot; to create one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Proj. Inflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Proj. Outflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Proj. Net
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Actual Inflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Actual Outflow
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Variance
                      </th>
                      <th className="py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const projNet =
                        Number(row.projectedInflow) -
                        Number(row.projectedOutflow);
                      const actualNet =
                        Number(row.actualInflow) - Number(row.actualOutflow);
                      const variance = actualNet - projNet;
                      return (
                        <tr key={row.id} className="hover:bg-muted/40 border-b">
                          <td className="text-muted-foreground py-2 pr-3">
                            {row.periodNumber}
                          </td>
                          <td className="text-muted-foreground py-2 pr-3">
                            {new Date(row.periodDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            ${Number(row.projectedInflow).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            ${Number(row.projectedOutflow).toLocaleString()}
                          </td>
                          <td
                            className={`py-2 pr-3 text-right font-mono ${projNet >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            ${projNet.toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            ${Number(row.actualInflow).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            ${Number(row.actualOutflow).toLocaleString()}
                          </td>
                          <td
                            className={`py-2 pr-3 text-right font-mono ${variance >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            ${variance.toLocaleString()}
                          </td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditItem({
                                  actualInflow: String(
                                    Number(row.actualInflow)
                                  ),
                                  actualOutflow: String(
                                    Number(row.actualOutflow)
                                  ),
                                  id: row.id,
                                })
                              }
                            >
                              Update Actuals
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t font-semibold">
                    <tr>
                      <td colSpan={2} className="py-2 pr-3">
                        Totals
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${totalProjInflow.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${totalProjOutflow.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-mono ${totalProjInflow - totalProjOutflow >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        ${(totalProjInflow - totalProjOutflow).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${totalActualInflow.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${totalActualOutflow.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-mono ${totalActualInflow - totalActualOutflow - (totalProjInflow - totalProjOutflow) >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        $
                        {(
                          totalActualInflow -
                          totalActualOutflow -
                          (totalProjInflow - totalProjOutflow)
                        ).toLocaleString()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Period Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cash Flow Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Number</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.periodNumber}
                  onChange={(e) =>
                    setForm({ ...form, periodNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Period Date</Label>
                <Input
                  type="date"
                  value={form.periodDate}
                  onChange={(e) =>
                    setForm({ ...form, periodDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Projected Inflow ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.projectedInflow}
                  onChange={(e) =>
                    setForm({ ...form, projectedInflow: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Projected Outflow ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.projectedOutflow}
                  onChange={(e) =>
                    setForm({ ...form, projectedOutflow: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g. Q1 2026 operations"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createMutation.isPending ||
                !form.periodNumber ||
                !form.periodDate
              }
              onClick={() =>
                createMutation.mutate({
                  description: form.description || undefined,
                  periodDate: form.periodDate,
                  periodNumber: Number(form.periodNumber),
                  projectId,
                  projectedInflow: form.projectedInflow || "0",
                  projectedOutflow: form.projectedOutflow || "0",
                })
              }
            >
              {createMutation.isPending ? "Saving…" : "Add Period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Actuals Dialog */}
      <Dialog
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Actual Cash Flows</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div>
                <Label>Actual Inflow ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editItem.actualInflow}
                  onChange={(e) =>
                    setEditItem({ ...editItem, actualInflow: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Actual Outflow ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editItem.actualOutflow}
                  onChange={(e) =>
                    setEditItem({ ...editItem, actualOutflow: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => {
                if (editItem) {
                  updateMutation.mutate({
                    actualInflow: editItem.actualInflow || "0",
                    actualOutflow: editItem.actualOutflow || "0",
                    id: editItem.id,
                  });
                }
              }}
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/cash-flows")({
  component: CashFlowsPage,
});

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

type MilestoneStatus = "completed" | "delayed" | "in_progress" | "pending";

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  completed: "bg-green-100 text-green-700",
  delayed: "bg-red-100 text-red-700",
  in_progress: "bg-blue-100 text-blue-700",
  pending: "bg-gray-100 text-gray-700",
};

interface MilestoneForm {
  budgetAllocated: string;
  description: string;
  name: string;
  notes: string;
  plannedDate: string;
  projectId: string;
}

const EMPTY_FORM: MilestoneForm = {
  budgetAllocated: "",
  description: "",
  name: "",
  notes: "",
  plannedDate: "",
  projectId: "",
};

function MilestonesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MilestoneStatus | "all">(
    "all"
  );
  const [projectFilter, setProjectFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<MilestoneForm>(EMPTY_FORM);

  const { data: projects } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: { limit: 100, offset: 0 },
    })
  );

  const { data, isLoading } = useQuery(
    orpc.investment.milestones.list.queryOptions({
      input: {
        projectId: projectFilter || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.investment.milestones.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Milestone created");
    },
    onError: (err) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    ...orpc.investment.milestones.complete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Milestone completed");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Milestones</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Milestone</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {(
              ["all", "pending", "in_progress", "completed", "delayed"] as const
            ).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all"
                  ? "All"
                  : s.replaceAll("_", " ").charAt(0).toUpperCase() +
                    s.replaceAll("_", " ").slice(1)}
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
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Planned Date</th>
                    <th className="py-2 pr-3 font-medium">Actual Date</th>
                    <th className="py-2 pr-3 font-medium">Completion</th>
                    <th className="py-2 pr-3 font-medium">Budget</th>
                    <th className="py-2 pr-3 font-medium">Actual Cost</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((milestone) => (
                    <tr
                      key={milestone.id}
                      className="hover:bg-muted/40 border-b"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {milestone.name}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {milestone.plannedDate
                          ? new Date(milestone.plannedDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {milestone.actualDate
                          ? new Date(milestone.actualDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${milestone.completionPercentage}%`,
                              }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {milestone.completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {milestone.budgetAllocated
                          ? `$${Number(milestone.budgetAllocated).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {milestone.actualCost
                          ? `$${Number(milestone.actualCost).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[milestone.status as MilestoneStatus] ?? ""}`}
                        >
                          {milestone.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="py-2">
                        {milestone.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              completeMutation.mutate({
                                actualDate: new Date().toISOString(),
                                id: milestone.id,
                              })
                            }
                          >
                            Complete
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
                        No milestones found.
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
            <DialogTitle>Add Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ms-project">Project</Label>
              <Select
                value={form.projectId || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    projectId: v === "__none__" ? "" : (v ?? ""),
                  })
                }
              >
                <SelectTrigger id="ms-project">
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
            <div>
              <Label htmlFor="ms-name">Milestone Name</Label>
              <Input
                id="ms-name"
                placeholder="Phase 1 completion"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ms-date">Planned Date</Label>
                <Input
                  id="ms-date"
                  type="date"
                  value={form.plannedDate}
                  onChange={(e) =>
                    setForm({ ...form, plannedDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="ms-budget">Budget Allocated ($)</Label>
                <Input
                  id="ms-budget"
                  type="number"
                  placeholder="50000"
                  value={form.budgetAllocated}
                  onChange={(e) =>
                    setForm({ ...form, budgetAllocated: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ms-desc">Description</Label>
              <Input
                id="ms-desc"
                placeholder="Milestone description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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
              onClick={() => {
                createMutation.mutate({
                  budgetAllocated: form.budgetAllocated || undefined,
                  description: form.description || undefined,
                  name: form.name,
                  plannedDate: form.plannedDate || undefined,
                  projectId: form.projectId,
                });
              }}
              disabled={
                createMutation.isPending || !form.name || !form.projectId
              }
            >
              {createMutation.isPending ? "Saving…" : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/milestones")({
  component: MilestonesPage,
});

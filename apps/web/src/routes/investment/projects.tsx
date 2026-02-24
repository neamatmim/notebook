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

type ProjectStatus = "active" | "cancelled" | "completed" | "draft" | "funding";
type ProjectType =
  | "business_venture"
  | "financial_instrument"
  | "infrastructure"
  | "real_estate";
type RiskLevel = "high" | "low" | "medium" | "very_high";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  draft: "bg-gray-100 text-gray-700",
  funding: "bg-yellow-100 text-yellow-700",
};

interface ProjectForm {
  currency: string;
  description: string;
  discountRate: string;
  endDate: string;
  expectedReturnRate: string;
  fundingDeadline: string;
  hurdleRate: string;
  maximumInvestment: string;
  minimumInvestment: string;
  name: string;
  notes: string;
  riskLevel: string;
  startDate: string;
  targetAmount: string;
  type: string;
}

const EMPTY_FORM: ProjectForm = {
  currency: "USD",
  description: "",
  discountRate: "",
  endDate: "",
  expectedReturnRate: "",
  fundingDeadline: "",
  hurdleRate: "",
  maximumInvestment: "",
  minimumInvestment: "",
  name: "",
  notes: "",
  riskLevel: "",
  startDate: "",
  targetAmount: "",
  type: "",
};

interface Project {
  currency: string;
  description: null | string;
  discountRate: null | string;
  endDate: Date | null;
  expectedReturnRate: null | string;
  fundingDeadline: Date | null;
  hurdleRate: null | string;
  id: string;
  maximumInvestment: null | string;
  minimumInvestment: null | string;
  name: string;
  notes: null | string;
  raisedAmount: string;
  riskLevel: null | string;
  startDate: Date | null;
  status: string;
  targetAmount: string;
  type: string;
}

const toDateStr = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

function ProjectsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">(
    "all"
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [editProject, setEditProject] = useState<null | Project>(null);

  const { data, isLoading } = useQuery(
    orpc.investment.projects.list.queryOptions({
      input: {
        limit: 50,
        offset: 0,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.investment.projects.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Project created");
    },
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    ...orpc.investment.projects.publish.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Project published for funding");
    },
    onError: (err) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    ...orpc.investment.projects.close.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Project closed");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    ...orpc.investment.projects.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditProject(null);
      toast.success("Project updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    createMutation.mutate({
      currency: form.currency,
      description: form.description || undefined,
      discountRate: form.discountRate || undefined,
      endDate: form.endDate || undefined,
      expectedReturnRate: form.expectedReturnRate || undefined,
      fundingDeadline: form.fundingDeadline || undefined,
      hurdleRate: form.hurdleRate || undefined,
      maximumInvestment: form.maximumInvestment || undefined,
      minimumInvestment: form.minimumInvestment || undefined,
      name: form.name,
      notes: form.notes || undefined,
      riskLevel: (form.riskLevel as RiskLevel) || undefined,
      startDate: form.startDate || undefined,
      targetAmount: form.targetAmount,
      type: form.type as ProjectType,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Investment Projects</h1>
        <Button onClick={() => setCreateOpen(true)}>New Project</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "all",
                "draft",
                "funding",
                "active",
                "completed",
                "cancelled",
              ] as const
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
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Target</th>
                    <th className="py-2 pr-3 font-medium">Raised</th>
                    <th className="py-2 pr-3 font-medium">Return %</th>
                    <th className="py-2 pr-3 font-medium">Risk</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((project) => (
                    <tr key={project.id} className="hover:bg-muted/40 border-b">
                      <td className="py-2 pr-3 font-medium">{project.name}</td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {project.type.replaceAll("_", " ")}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        ${Number(project.targetAmount).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        ${Number(project.raisedAmount).toLocaleString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {project.expectedReturnRate
                          ? `${Number(project.expectedReturnRate).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {project.riskLevel?.replaceAll("_", " ") ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[project.status as ProjectStatus] ?? ""}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="space-x-1 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditProject(project as unknown as Project)
                          }
                        >
                          Edit
                        </Button>
                        {project.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              publishMutation.mutate({ id: project.id })
                            }
                          >
                            Publish
                          </Button>
                        )}
                        {(project.status === "funding" ||
                          project.status === "active") && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              closeMutation.mutate({
                                id: project.id,
                                status: "completed",
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
                        No projects found.
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
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Investment Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="proj-name">Project Name</Label>
                <Input
                  id="proj-name"
                  placeholder="e.g. Downtown Office Building"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="proj-type">Type</Label>
                <Select
                  value={form.type || "__none__"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      type: v === "__none__" ? "" : (v ?? ""),
                    })
                  }
                >
                  <SelectTrigger id="proj-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select type</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="business_venture">
                      Business Venture
                    </SelectItem>
                    <SelectItem value="infrastructure">
                      Infrastructure
                    </SelectItem>
                    <SelectItem value="financial_instrument">
                      Financial Instrument
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="proj-risk">Risk Level</Label>
                <Select
                  value={form.riskLevel || "__none__"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      riskLevel: v === "__none__" ? "" : (v ?? ""),
                    })
                  }
                >
                  <SelectTrigger id="proj-risk">
                    <SelectValue placeholder="Select risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select risk</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very_high">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="proj-target">Target Amount ($)</Label>
                <Input
                  id="proj-target"
                  type="number"
                  placeholder="1000000"
                  value={form.targetAmount}
                  onChange={(e) =>
                    setForm({ ...form, targetAmount: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-return">Expected Return Rate (%)</Label>
                <Input
                  id="proj-return"
                  type="number"
                  placeholder="12.5"
                  value={form.expectedReturnRate}
                  onChange={(e) =>
                    setForm({ ...form, expectedReturnRate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-min">Min Investment ($)</Label>
                <Input
                  id="proj-min"
                  type="number"
                  placeholder="10000"
                  value={form.minimumInvestment}
                  onChange={(e) =>
                    setForm({ ...form, minimumInvestment: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-max">Max Investment ($)</Label>
                <Input
                  id="proj-max"
                  type="number"
                  placeholder="500000"
                  value={form.maximumInvestment}
                  onChange={(e) =>
                    setForm({ ...form, maximumInvestment: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-hurdle">Hurdle Rate (%)</Label>
                <Input
                  id="proj-hurdle"
                  type="number"
                  placeholder="8.0"
                  value={form.hurdleRate}
                  onChange={(e) =>
                    setForm({ ...form, hurdleRate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-discount">Discount Rate (%)</Label>
                <Input
                  id="proj-discount"
                  type="number"
                  placeholder="10.0"
                  value={form.discountRate}
                  onChange={(e) =>
                    setForm({ ...form, discountRate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-start">Start Date</Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="proj-end">End Date</Label>
                <Input
                  id="proj-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="proj-desc">Description</Label>
                <Input
                  id="proj-desc"
                  placeholder="Project description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="proj-notes">Notes</Label>
                <Input
                  id="proj-notes"
                  placeholder="Additional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
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
                !form.name ||
                !form.type ||
                !form.targetAmount
              }
            >
              {createMutation.isPending ? "Saving…" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {editProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Project Name</Label>
                  <Input
                    defaultValue={editProject.name}
                    onChange={(e) =>
                      setEditProject({ ...editProject, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editProject.type}
                    onValueChange={(v) =>
                      setEditProject({ ...editProject, type: v ?? "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                      <SelectItem value="business_venture">
                        Business Venture
                      </SelectItem>
                      <SelectItem value="infrastructure">
                        Infrastructure
                      </SelectItem>
                      <SelectItem value="financial_instrument">
                        Financial Instrument
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risk Level</Label>
                  <Select
                    value={editProject.riskLevel ?? ""}
                    onValueChange={(v) =>
                      setEditProject({ ...editProject, riskLevel: v ?? "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="very_high">Very High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expected Return Rate (%)</Label>
                  <Input
                    type="number"
                    defaultValue={editProject.expectedReturnRate ?? ""}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        expectedReturnRate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Hurdle Rate (%)</Label>
                  <Input
                    type="number"
                    defaultValue={editProject.hurdleRate ?? ""}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        hurdleRate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Min Investment ($)</Label>
                  <Input
                    type="number"
                    defaultValue={editProject.minimumInvestment ?? ""}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        minimumInvestment: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Max Investment ($)</Label>
                  <Input
                    type="number"
                    defaultValue={editProject.maximumInvestment ?? ""}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        maximumInvestment: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    defaultValue={toDateStr(editProject.startDate)}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        startDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    defaultValue={toDateStr(editProject.endDate)}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        endDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Input
                    defaultValue={editProject.description ?? ""}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input
                    defaultValue={editProject.notes ?? ""}
                    onChange={(e) =>
                      setEditProject({ ...editProject, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending || !editProject?.name}
              onClick={() => {
                if (!editProject) {
                  return;
                }
                updateMutation.mutate({
                  description: editProject.description ?? undefined,
                  endDate: editProject.endDate
                    ? toDateStr(editProject.endDate)
                    : undefined,
                  expectedReturnRate:
                    editProject.expectedReturnRate ?? undefined,
                  hurdleRate: editProject.hurdleRate ?? undefined,
                  id: editProject.id,
                  maximumInvestment: editProject.maximumInvestment ?? undefined,
                  minimumInvestment: editProject.minimumInvestment ?? undefined,
                  name: editProject.name,
                  notes: editProject.notes ?? undefined,
                  riskLevel: (editProject.riskLevel as RiskLevel) ?? undefined,
                  startDate: editProject.startDate
                    ? toDateStr(editProject.startDate)
                    : undefined,
                  type: editProject.type as ProjectType,
                });
              }}
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/projects")({
  component: ProjectsPage,
});

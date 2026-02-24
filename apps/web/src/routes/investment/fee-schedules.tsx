import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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

interface Schedule {
  amount: string;
  billingCycle: "annual" | "biannual" | "monthly" | "quarterly";
  cashAccountId: null | string;
  description: null | string;
  feeType: "flat_per_member" | "per_share";
  id: string;
  isActive: boolean;
  name: string;
  notes: null | string;
  revenueAccountId: null | string;
  shareClassCode: null | string;
  shareClassId: string;
  shareClassName: null | string;
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  annual: "Annual",
  biannual: "Biannual",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

function FeeSchedulesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<null | Schedule>(null);

  const schedulesQuery = useQuery(
    orpc.investment.membershipFees.schedules.list.queryOptions({ input: {} })
  );
  const shareClassesQuery = useQuery(
    orpc.investment.shareClasses.list.queryOptions()
  );
  const accountsQuery = useQuery(
    orpc.accounting.accounts.list.queryOptions({ input: {} })
  );

  const createMutation = useMutation(
    orpc.investment.membershipFees.schedules.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Fee schedule created");
        queryClient.invalidateQueries({
          queryKey: orpc.investment.membershipFees.schedules.list.queryOptions({
            input: {},
          }).queryKey,
        });
        setCreateOpen(false);
      },
    })
  );

  const updateMutation = useMutation(
    orpc.investment.membershipFees.schedules.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Fee schedule updated");
        queryClient.invalidateQueries({
          queryKey: orpc.investment.membershipFees.schedules.list.queryOptions({
            input: {},
          }).queryKey,
        });
        setEditSchedule(null);
      },
    })
  );

  const toggleMutation = useMutation(
    orpc.investment.membershipFees.schedules.toggle.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Fee schedule updated");
        queryClient.invalidateQueries({
          queryKey: orpc.investment.membershipFees.schedules.list.queryOptions({
            input: {},
          }).queryKey,
        });
      },
    })
  );

  const schedules = schedulesQuery.data?.items ?? [];
  const shareClasses = shareClassesQuery.data?.items ?? [];
  const accounts = accountsQuery.data?.items ?? [];
  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  const assetAccounts = accounts.filter((a) => a.type === "asset");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const get = (key: string) => {
      const v = data.get(key);
      return v ? String(v) : undefined;
    };

    if (isEdit && editSchedule) {
      updateMutation.mutate({
        amount: get("amount"),
        billingCycle: get("billingCycle") as
          | "annual"
          | "biannual"
          | "monthly"
          | "quarterly"
          | undefined,
        cashAccountId: get("cashAccountId") || undefined,
        description: get("description") || undefined,
        feeType: get("feeType") as "flat_per_member" | "per_share" | undefined,
        id: editSchedule.id,
        name: get("name") ?? "",
        notes: get("notes") || undefined,
        revenueAccountId: get("revenueAccountId") || undefined,
      });
    } else {
      createMutation.mutate({
        amount: get("amount") ?? "",
        billingCycle: get("billingCycle") as
          | "annual"
          | "biannual"
          | "monthly"
          | "quarterly",
        cashAccountId: get("cashAccountId") || undefined,
        description: get("description") || undefined,
        feeType: get("feeType") as "flat_per_member" | "per_share",
        name: get("name") ?? "",
        notes: get("notes") || undefined,
        revenueAccountId: get("revenueAccountId") || undefined,
        shareClassId: get("shareClassId") ?? "",
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const dialogSchedule = editSchedule;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee Schedules</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Define recurring membership fee rules per share class.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {schedulesQuery.isPending ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : schedules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No fee schedules yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Share Class</th>
                    <th className="pb-2 font-medium">Fee Type</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Cycle</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{s.name}</td>
                      <td className="py-3">
                        {s.shareClassName ?? "—"}{" "}
                        {s.shareClassCode && (
                          <span className="text-muted-foreground">
                            ({s.shareClassCode})
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {s.feeType === "flat_per_member" ? (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            Flat
                          </span>
                        ) : (
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                            Per Share
                          </span>
                        )}
                      </td>
                      <td className="py-3">{Number(s.amount).toFixed(2)}</td>
                      <td className="py-3">
                        {BILLING_CYCLE_LABELS[s.billingCycle] ?? s.billingCycle}
                      </td>
                      <td className="py-3">
                        {s.isActive ? (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="space-x-2 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditSchedule(s as Schedule)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate({ id: s.id })}
                        >
                          {s.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Fee Schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-1">
                <Label htmlFor="shareClassId">Share Class *</Label>
                <Select name="shareClassId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select share class" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name} ({sc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="feeType">Fee Type *</Label>
                <Select name="feeType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fee type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat_per_member">
                      Flat per member
                    </SelectItem>
                    <SelectItem value="per_share">Per share held</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  name="amount"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="billingCycle">Billing Cycle *</Label>
                <Select name="billingCycle" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="biannual">Biannual</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="revenueAccountId">Revenue Account</Label>
                <Select name="revenueAccountId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {revenueAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cashAccountId">Cash / Bank Account</Label>
                <Select name="cashAccountId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!dialogSchedule}
        onOpenChange={(open) => !open && setEditSchedule(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Fee Schedule</DialogTitle>
          </DialogHeader>
          {dialogSchedule && (
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    required
                    defaultValue={dialogSchedule.name}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea
                    name="description"
                    rows={2}
                    defaultValue={dialogSchedule.description ?? ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fee Type *</Label>
                  <Select
                    name="feeType"
                    required
                    defaultValue={dialogSchedule.feeType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat_per_member">
                        Flat per member
                      </SelectItem>
                      <SelectItem value="per_share">Per share held</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input
                    name="amount"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={dialogSchedule.amount}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Billing Cycle *</Label>
                  <Select
                    name="billingCycle"
                    required
                    defaultValue={dialogSchedule.billingCycle}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="biannual">Biannual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Revenue Account</Label>
                  <Select
                    name="revenueAccountId"
                    defaultValue={dialogSchedule.revenueAccountId ?? ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Cash / Bank Account</Label>
                  <Select
                    name="cashAccountId"
                    defaultValue={dialogSchedule.cashAccountId ?? ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    name="notes"
                    rows={2}
                    defaultValue={dialogSchedule.notes ?? ""}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditSchedule(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/fee-schedules")({
  component: FeeSchedulesPage,
});

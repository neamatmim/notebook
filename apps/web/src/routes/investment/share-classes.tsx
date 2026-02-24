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

type ShareClassType = "convertible" | "ordinary" | "preference" | "redeemable";

interface ShareClassForm {
  authorizedShares: string;
  code: string;
  dividendPriority: string;
  name: string;
  notes: string;
  parValue: string;
  type: ShareClassType;
  votingRights: boolean;
}

const EMPTY_FORM: ShareClassForm = {
  authorizedShares: "",
  code: "",
  dividendPriority: "0",
  name: "",
  notes: "",
  parValue: "",
  type: "ordinary",
  votingRights: true,
};

interface EditSc {
  authorizedShares: null | number;
  dividendPriority: number;
  id: string;
  name: string;
  notes: null | string;
  parValue: null | string;
  votingRights: boolean;
}

function ShareClassesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ShareClassForm>(EMPTY_FORM);
  const [editSc, setEditSc] = useState<EditSc | null>(null);

  const { data, isLoading } = useQuery(
    orpc.investment.shareClasses.list.queryOptions()
  );

  const createMutation = useMutation({
    ...orpc.investment.shareClasses.create.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Share class created");
    },
  });

  const updateMutation = useMutation({
    ...orpc.investment.shareClasses.update.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditSc(null);
      toast.success("Share class updated");
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      authorizedShares: form.authorizedShares
        ? Number(form.authorizedShares)
        : undefined,
      code: form.code,
      dividendPriority: Number(form.dividendPriority),
      name: form.name,
      notes: form.notes || undefined,
      parValue: form.parValue || undefined,
      type: form.type,
      votingRights: form.votingRights,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Share Classes</h1>
        <Button onClick={() => setCreateOpen(true)}>New Share Class</Button>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Par Value</th>
                    <th className="py-2 pr-3 font-medium">Authorized</th>
                    <th className="py-2 pr-3 font-medium">Issued</th>
                    <th className="py-2 pr-3 font-medium">Available</th>
                    <th className="py-2 pr-3 font-medium">Voting</th>
                    <th className="py-2 pr-3 font-medium">Actions</th>
                    <th className="py-2 pr-3 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((sc) => {
                    const authorized = sc.authorizedShares ?? 0;
                    const issued = sc.issuedShares ?? 0;
                    const available = authorized - issued;
                    const pct =
                      authorized > 0
                        ? Math.round((issued / authorized) * 100)
                        : 0;
                    return (
                      <tr key={sc.id} className="hover:bg-muted/40 border-b">
                        <td className="py-2 pr-3 font-mono font-semibold">
                          {sc.code}
                        </td>
                        <td className="py-2 pr-3 font-medium">{sc.name}</td>
                        <td className="text-muted-foreground py-2 pr-3 capitalize">
                          {sc.type}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {sc.parValue ? `$${sc.parValue}` : "—"}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {authorized.toLocaleString()}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {issued.toLocaleString()}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {available.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${sc.votingRights ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                          >
                            {sc.votingRights ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditSc({
                                authorizedShares: sc.authorizedShares,
                                dividendPriority: sc.dividendPriority,
                                id: sc.id,
                                name: sc.name,
                                notes: sc.notes,
                                parValue: sc.parValue,
                                votingRights: sc.votingRights,
                              })
                            }
                          >
                            Edit
                          </Button>
                        </td>
                        <td className="py-2 pr-3">
                          {authorized > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground text-xs">
                                {pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!data?.items.length && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No share classes found.
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
            <DialogTitle>New Share Class</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="sc-name">Name</Label>
              <Input
                id="sc-name"
                placeholder="Ordinary Shares"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sc-code">Code</Label>
              <Input
                id="sc-code"
                placeholder="ORD"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div>
              <Label htmlFor="sc-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({ ...form, type: v as ShareClassType })
                }
              >
                <SelectTrigger id="sc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinary">Ordinary</SelectItem>
                  <SelectItem value="preference">Preference</SelectItem>
                  <SelectItem value="redeemable">Redeemable</SelectItem>
                  <SelectItem value="convertible">Convertible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sc-par">Par Value ($)</Label>
              <Input
                id="sc-par"
                type="number"
                placeholder="1.00"
                value={form.parValue}
                onChange={(e) => setForm({ ...form, parValue: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sc-auth">Authorized Shares</Label>
              <Input
                id="sc-auth"
                type="number"
                placeholder="1000000"
                value={form.authorizedShares}
                onChange={(e) =>
                  setForm({ ...form, authorizedShares: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="sc-div">Dividend Priority</Label>
              <Input
                id="sc-div"
                type="number"
                placeholder="0"
                value={form.dividendPriority}
                onChange={(e) =>
                  setForm({ ...form, dividendPriority: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="sc-voting">Voting Rights</Label>
              <Select
                value={form.votingRights ? "yes" : "no"}
                onValueChange={(v) =>
                  setForm({ ...form, votingRights: v === "yes" })
                }
              >
                <SelectTrigger id="sc-voting">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="sc-notes">Notes</Label>
              <Input
                id="sc-notes"
                placeholder="Additional notes"
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
              disabled={createMutation.isPending || !form.name || !form.code}
            >
              {createMutation.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSc} onOpenChange={(open) => !open && setEditSc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Share Class</DialogTitle>
          </DialogHeader>
          {editSc && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input
                  defaultValue={editSc.name}
                  onChange={(e) =>
                    setEditSc({ ...editSc, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Par Value ($)</Label>
                <Input
                  type="number"
                  defaultValue={editSc.parValue ?? ""}
                  onChange={(e) =>
                    setEditSc({ ...editSc, parValue: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Authorized Shares</Label>
                <Input
                  type="number"
                  defaultValue={editSc.authorizedShares ?? ""}
                  onChange={(e) =>
                    setEditSc({
                      ...editSc,
                      authorizedShares: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Dividend Priority</Label>
                <Input
                  type="number"
                  defaultValue={editSc.dividendPriority}
                  onChange={(e) =>
                    setEditSc({
                      ...editSc,
                      dividendPriority: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Voting Rights</Label>
                <Select
                  value={editSc.votingRights ? "yes" : "no"}
                  onValueChange={(v) =>
                    setEditSc({ ...editSc, votingRights: v === "yes" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Input
                  defaultValue={editSc.notes ?? ""}
                  onChange={(e) =>
                    setEditSc({ ...editSc, notes: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSc(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending || !editSc?.name}
              onClick={() => {
                if (!editSc) {
                  return;
                }
                updateMutation.mutate({
                  authorizedShares: editSc.authorizedShares ?? undefined,
                  dividendPriority: editSc.dividendPriority,
                  id: editSc.id,
                  name: editSc.name,
                  notes: editSc.notes ?? undefined,
                  parValue: editSc.parValue ?? undefined,
                  votingRights: editSc.votingRights,
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

export const Route = createFileRoute("/investment/share-classes")({
  component: ShareClassesPage,
});

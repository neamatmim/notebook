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

type AccountType = "asset" | "equity" | "expense" | "liability" | "revenue";

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-100 text-blue-700",
  equity: "bg-purple-100 text-purple-700",
  expense: "bg-orange-100 text-orange-700",
  liability: "bg-red-100 text-red-700",
  revenue: "bg-green-100 text-green-700",
};

const DEFAULT_NORMAL_BALANCE: Record<AccountType, "credit" | "debit"> = {
  asset: "debit",
  equity: "credit",
  expense: "debit",
  liability: "credit",
  revenue: "credit",
};

interface AccountFormState {
  code: string;
  description: string;
  name: string;
  normalBalance: "credit" | "debit";
  parentId: string;
  type: AccountType;
}

const EMPTY_FORM: AccountFormState = {
  code: "",
  description: "",
  name: "",
  normalBalance: "debit",
  parentId: "",
  type: "asset",
};

function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<AccountType | "all">("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(EMPTY_FORM);

  const { data, isLoading } = useQuery(
    orpc.accounting.accounts.list.queryOptions({
      input: {
        limit: 200,
        offset: 0,
        query: query || undefined,
        type: typeFilter === "all" ? undefined : typeFilter,
      },
    })
  );

  const { data: allAccounts } = useQuery(
    orpc.accounting.accounts.list.queryOptions({
      input: { limit: 200, offset: 0 },
    })
  );

  const createMutation = useMutation({
    ...orpc.accounting.accounts.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    ...orpc.accounting.accounts.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (account: NonNullable<typeof data>["items"][number]) => {
    setEditId(account.id);
    setForm({
      code: account.code,
      description: account.description ?? "",
      name: account.name,
      normalBalance: account.normalBalance,
      parentId: account.parentId ?? "",
      type: account.type,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editId) {
      updateMutation.mutate({
        description: form.description || undefined,
        id: editId,
        name: form.name,
        parentId: form.parentId || null,
      });
    } else {
      createMutation.mutate({
        code: form.code,
        description: form.description || undefined,
        name: form.name,
        normalBalance: form.normalBalance,
        parentId: form.parentId || undefined,
        type: form.type,
      });
    }
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, isActive: !isActive });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <Button onClick={openCreate}>Add Account</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as AccountType | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search by name or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-64"
            />
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
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Normal Balance</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Balance
                    </th>
                    <th className="py-2 pr-3 font-medium">System</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((acct) => (
                    <tr key={acct.id} className="hover:bg-muted/40 border-b">
                      <td className="py-2 pr-3 font-mono">{acct.code}</td>
                      <td className="py-2 pr-3">
                        {acct.parentId && (
                          <span className="text-muted-foreground mr-1">↳</span>
                        )}
                        {acct.name}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[acct.type]}`}
                        >
                          {acct.type}
                        </span>
                      </td>
                      <td className="text-muted-foreground py-2 pr-3 capitalize">
                        {acct.normalBalance}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${Number(acct.currentBalance).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3">
                        {acct.isSystem ? (
                          <span className="text-indigo-600 text-xs font-semibold">
                            SYS
                          </span>
                        ) : null}
                      </td>
                      <td className="space-x-2 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(acct)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={acct.isActive ? "ghost" : "secondary"}
                          onClick={() => toggleActive(acct.id, acct.isActive)}
                        >
                          {acct.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No accounts found. Seed default accounts in Settings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Account" : "Create Account"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editId && (
              <div>
                <Label htmlFor="acct-code">Code</Label>
                <Input
                  id="acct-code"
                  placeholder="e.g. 1000"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label htmlFor="acct-name">Name</Label>
              <Input
                id="acct-name"
                placeholder="Account name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {!editId && (
              <>
                <div>
                  <Label htmlFor="acct-type">Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => {
                      const t = v as AccountType;
                      setForm({
                        ...form,
                        normalBalance: DEFAULT_NORMAL_BALANCE[t],
                        type: t,
                      });
                    }}
                  >
                    <SelectTrigger id="acct-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="acct-nb">Normal Balance</Label>
                  <Select
                    value={form.normalBalance}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        normalBalance: v as "credit" | "debit",
                      })
                    }
                  >
                    <SelectTrigger id="acct-nb">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="acct-parent">Parent Account (optional)</Label>
              <Select
                value={form.parentId || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, parentId: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger id="acct-parent">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {allAccounts?.items
                    .filter((a) => a.id !== editId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="acct-desc">Description (optional)</Label>
              <Input
                id="acct-desc"
                placeholder="Description"
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
                setDialogOpen(false);
                setForm(EMPTY_FORM);
                setEditId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/accounting/chart-of-accounts")({
  component: ChartOfAccountsPage,
});

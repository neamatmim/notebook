import { DataTable } from "@notebook/table";
import { cellActionsColumn } from "@notebook/table/cell-actions-column";
import { cellBooleanColumn } from "@notebook/table/cell-boolean-column";
import { cellCurrencyColumn } from "@notebook/table/cell-currency-column";
import { cellStatusColumn } from "@notebook/table/cell-status-column";
import { Button } from "@notebook/ui/components/button";
import { Card, CardContent, CardHeader } from "@notebook/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@notebook/ui/components/dialog";
import { Input } from "@notebook/ui/components/input";
import { Label } from "@notebook/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notebook/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";
type AccountType = "asset" | "equity" | "expense" | "liability" | "revenue";

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-100 text-blue-700",
  equity: "bg-purple-100 text-purple-700",
  expense: "bg-orange-100 text-orange-700",
  liability: "bg-red-100 text-red-700",
  revenue: "bg-green-100 text-green-700",
};

interface COA {
  parentId: string | null;
  name: string;
  code: string;
  type: AccountType;
  normalBalance: string;
  currentBalance: string;
  isSystem: boolean;
  isActive: boolean;
}
const columns: ColumnDef<COA>[] = [
  {
    accessorKey: "code",
    header: "Code",
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ getValue, row }) => {
      const name = getValue<string>();
      const { parentId } = row.original;
      return (
        <div className="font-medium">
          {parentId && <span className="text-muted-foreground mr-1">↳</span>}
          {name}
        </div>
      );
    },
  },
  cellStatusColumn({
    accessorKey: "type",
    header: "Type",
    colors: TYPE_COLORS,
  }),
  {
    accessorKey: "normalBalance",
    header: "Normal Balance",
    meta: {
      cellClassName: "text-muted-foreground capitalize",
    },
  },
  cellCurrencyColumn({
    accessorKey: "currentBalance",
    header: "Balance",
  }),
  cellBooleanColumn({
    accessorKey: "isSystem",
    header: "System",
  }),
  cellActionsColumn({
    cell: ActionsCell,
  }),
];
function ActionsCell({ row }: { row: Row<COA> }) {
  const data = row.original;
  // const updateMutation = useMutation({
  //   ...orpc.accounting.accounts.update.mutationOptions(),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries();
  //     setDialogOpen(false);
  //     setForm(EMPTY_FORM);
  //     setEditId(null);
  //   },
  //   onError: (err) => toast.error(err.message),
  // });
  // const toggleActive = (id: string, isActive: boolean) => {
  //   updateMutation.mutate({ id, isActive: !isActive });
  // };
  return (
    <div className="space-x-2">
      <Button
        size="sm"
        variant="outline"
        // onClick={() => openEdit(data)}
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant={data.isActive ? "ghost" : "secondary"}
        // onClick={() => toggleActive(data.id, data.isActive)}
      >
        {data.isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
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

  // const openEdit = (account: NonNullable<typeof data>["items"][number]) => {
  //   setEditId(account.id);
  //   setForm({
  //     code: account.code,
  //     description: account.description ?? "",
  //     name: account.name,
  //     normalBalance: account.normalBalance,
  //     parentId: account.parentId ?? "",
  //     type: account.type,
  //   });
  //   setDialogOpen(true);
  // };

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
          <DataTable
            data={data?.items}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No accounts found. Seed default accounts in Settings."
          />
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
                  setForm({
                    ...form,
                    parentId: v === "__none__" ? "" : (v ?? ""),
                  })
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

export const Route = createFileRoute("/_app/accounting/chart-of-accounts")({
  component: ChartOfAccountsPage,
});

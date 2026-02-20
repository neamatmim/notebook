import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CustomerAccountDialog } from "@/components/customer-account-dialog";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

type CollectDueMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "mobile_payment"
  | "check"
  | "gift_card"
  | "store_credit";

function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creditId, setCreditId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [collectDueId, setCollectDueId] = useState<string | null>(null);
  const [collectDueAmount, setCollectDueAmount] = useState("");
  const [collectDueMethod, setCollectDueMethod] =
    useState<CollectDueMethod>("cash");
  const [accountId, setAccountId] = useState<string | null>(null);

  const customersQuery = useQuery(
    orpc.pos.customers.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        query: searchQuery || undefined,
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.pos.customers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.pos.customers.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteId(null);
      },
    })
  );

  const adjustCreditMutation = useMutation(
    orpc.pos.customers.adjustCredit.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.pos.customers.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setCreditId(null);
        setCreditAmount("");
      },
    })
  );

  const collectDueMutation = useMutation(
    orpc.pos.customers.collectDuePayment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.pos.customers.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setCollectDueId(null);
        setCollectDueAmount("");
        setCollectDueMethod("cash");
        toast.success("Payment collected.");
      },
      onError: (e) => toast.error(e.message ?? "Failed to collect payment."),
    })
  );

  const items = customersQuery.data?.items ?? [];
  const total = customersQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const collectDueCustomer = items.find((c) => c.id === collectDueId);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "customerNumber",
      header: "Customer #",
    },
    {
      accessorKey: "firstName",
      cell: ({ row }) =>
        `${row.original.firstName ?? ""} ${row.original.lastName ?? ""}`.trim() ||
        "—",
      header: "Name",
    },
    {
      accessorKey: "email",
      cell: ({ row }) => row.original.email ?? "—",
      header: "Email",
    },
    {
      accessorKey: "phone",
      cell: ({ row }) => row.original.phone ?? "—",
      header: "Phone",
    },
    {
      accessorKey: "type",
      cell: ({ row }) => {
        const { type } = row.original;
        const colors: Record<string, string> = {
          employee: "bg-purple-100 text-purple-800",
          regular: "bg-gray-100 text-gray-800",
          vip: "bg-yellow-100 text-yellow-800",
          wholesale: "bg-blue-100 text-blue-800",
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[type] ?? colors.regular}`}
          >
            {type}
          </span>
        );
      },
      header: "Type",
    },
    {
      accessorKey: "totalSpent",
      cell: ({ row }) => `$${Number(row.original.totalSpent ?? 0).toFixed(2)}`,
      header: "Total Spent",
    },
    {
      accessorKey: "loyaltyPoints",
      header: "Loyalty Points",
    },
    {
      accessorKey: "creditBalance",
      cell: ({ row }) =>
        `$${Number(row.original.creditBalance ?? 0).toFixed(2)}`,
      header: "Store Credit",
    },
    {
      accessorKey: "dueBalance",
      cell: ({ row }) => {
        const due = Number(row.original.dueBalance ?? 0);
        return (
          <span className={due > 0 ? "font-semibold text-red-600" : ""}>
            ${due.toFixed(2)}
          </span>
        );
      },
      header: "Due Balance",
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 hover:text-green-700"
            title="View Account"
            onClick={() => setAccountId(row.original.id)}
          >
            <User className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditId(row.original.id);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 hover:text-green-700"
            title="Adjust Store Credit"
            onClick={() => setCreditId(row.original.id)}
          >
            <CreditCard className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-orange-600 hover:text-orange-700"
            title="Collect Due Payment"
            disabled={Number(row.original.dueBalance ?? 0) <= 0}
            onClick={() => {
              setCollectDueId(row.original.id);
              setCollectDueAmount(Number(row.original.dueBalance).toFixed(2));
            }}
          >
            <Banknote className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => {
            setEditId(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Search customers by name, email, or phone..."
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(0);
        }}
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(pageIndex) => setPage(pageIndex)}
        loading={customersQuery.isLoading}
      />

      <CustomerAccountDialog
        customerId={accountId}
        onClose={() => setAccountId(null)}
      />

      <CustomerFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
        }}
        editId={editId}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate({ id: deleteId });
          }
        }}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <Dialog
        open={Boolean(creditId)}
        onOpenChange={(open) => {
          if (!open) {
            setCreditId(null);
            setCreditAmount("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Adjust Store Credit</DialogTitle>
            <DialogDescription>
              Enter a positive amount to add credit, negative to deduct.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="credit-amount">Amount ($)</Label>
            <Input
              id="credit-amount"
              type="number"
              step="0.01"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="e.g. 50.00 or -10.00"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreditId(null);
                setCreditAmount("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!creditAmount || adjustCreditMutation.isPending}
              onClick={() => {
                if (creditId && creditAmount) {
                  adjustCreditMutation.mutate({
                    amount: creditAmount,
                    id: creditId,
                  });
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              {adjustCreditMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(collectDueId)}
        onOpenChange={(open) => {
          if (!open) {
            setCollectDueId(null);
            setCollectDueAmount("");
            setCollectDueMethod("cash");
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Collect Due Payment</DialogTitle>
            <DialogDescription>
              Outstanding balance: $
              {Number(collectDueCustomer?.dueBalance ?? 0).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="collect-due-amount">Amount ($)</Label>
              <Input
                id="collect-due-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={Number(collectDueCustomer?.dueBalance ?? 0)}
                value={collectDueAmount}
                onChange={(e) => setCollectDueAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="collect-due-method">Payment Method</Label>
              <Select
                value={collectDueMethod}
                onValueChange={(v) =>
                  v && setCollectDueMethod(v as CollectDueMethod)
                }
              >
                <SelectTrigger id="collect-due-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="mobile_payment">Mobile Payment</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="gift_card">Gift Card</SelectItem>
                  <SelectItem value="store_credit">Store Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCollectDueId(null);
                setCollectDueAmount("");
                setCollectDueMethod("cash");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !collectDueAmount ||
                Number(collectDueAmount) <= 0 ||
                collectDueMutation.isPending
              }
              onClick={() => {
                if (collectDueId && collectDueAmount) {
                  collectDueMutation.mutate({
                    amount: collectDueAmount,
                    customerId: collectDueId,
                    method: collectDueMethod,
                  });
                }
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {collectDueMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Collect Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/pos/customers")({
  component: CustomersPage,
});

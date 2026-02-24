import type { ColumnDef } from "@tanstack/react-table";
import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

interface EmployeeFormData {
  canApplyDiscounts: boolean;
  canProcessReturns: boolean;
  commissionRate: string;
  department: string;
  email: string;
  employeeNumber: string;
  firstName: string;
  hourlyRate: string;
  lastName: string;
  maxDiscountPercent: string;
  phone: string;
  role: string;
  userId: string;
}

const emptyForm: EmployeeFormData = {
  canApplyDiscounts: false,
  canProcessReturns: false,
  commissionRate: "",
  department: "",
  email: "",
  employeeNumber: "",
  firstName: "",
  hourlyRate: "",
  lastName: "",
  maxDiscountPercent: "",
  phone: "",
  role: "cashier",
  userId: "",
};

function EmployeeFormDialog({
  editData,
  editId,
  onClose,
  open,
}: {
  editData?: Partial<EmployeeFormData> | null;
  editId?: string | null;
  onClose: () => void;
  open: boolean;
}) {
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const isEdit = Boolean(editId);

  useEffect(() => {
    if (editData && editId) {
      setForm({
        canApplyDiscounts: editData.canApplyDiscounts ?? false,
        canProcessReturns: editData.canProcessReturns ?? false,
        commissionRate: editData.commissionRate ?? "",
        department: editData.department ?? "",
        email: editData.email ?? "",
        employeeNumber: editData.employeeNumber ?? "",
        firstName: editData.firstName ?? "",
        hourlyRate: editData.hourlyRate ?? "",
        lastName: editData.lastName ?? "",
        maxDiscountPercent: editData.maxDiscountPercent ?? "",
        phone: editData.phone ?? "",
        role: editData.role ?? "cashier",
        userId: editData.userId ?? "",
      });
    } else if (!editId) {
      setForm(emptyForm);
    }
  }, [editId, editData]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.pos.employees.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
  };

  const createMutation = useMutation(
    orpc.pos.employees.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Employee created");
        invalidate();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.pos.employees.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Employee updated");
        invalidate();
        onClose();
      },
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      canApplyDiscounts: form.canApplyDiscounts,
      canProcessReturns: form.canProcessReturns,
      commissionRate: form.commissionRate || undefined,
      department: form.department || undefined,
      email: form.email,
      employeeNumber: form.employeeNumber || `EMP-${Date.now()}`,
      firstName: form.firstName,
      hourlyRate: form.hourlyRate || undefined,
      lastName: form.lastName,
      maxDiscountPercent: form.maxDiscountPercent || undefined,
      phone: form.phone || undefined,
      role: form.role,
      userId: form.userId || "system",
    };

    if (isEdit && editId) {
      updateMutation.mutate({ ...payload, id: editId });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = <K extends keyof EmployeeFormData>(
    key: K,
    value: EmployeeFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update employee details." : "Add a new POS employee."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emp-first">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emp-first"
                required
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-last">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emp-last"
                required
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emp-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-phone">Phone</Label>
              <Input
                id="emp-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emp-role"
                required
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder="cashier, manager…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-dept">Department</Label>
              <Input
                id="emp-dept"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-hourly">Hourly Rate ($)</Label>
              <Input
                id="emp-hourly"
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRate}
                onChange={(e) => set("hourlyRate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-commission">Commission Rate</Label>
              <Input
                id="emp-commission"
                type="number"
                min="0"
                max="1"
                step="0.0001"
                value={form.commissionRate}
                onChange={(e) => set("commissionRate", e.target.value)}
                placeholder="e.g. 0.05 = 5%"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-max-disc">Max Discount %</Label>
              <Input
                id="emp-max-disc"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.maxDiscountPercent}
                onChange={(e) => set("maxDiscountPercent", e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.canApplyDiscounts}
                onChange={(e) => set("canApplyDiscounts", e.target.checked)}
              />
              Can Apply Discounts
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.canProcessReturns}
                onChange={(e) => set("canProcessReturns", e.target.checked)}
              />
              Can Process Returns
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeesPage() {
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<EmployeeFormData> | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation(
    orpc.pos.employees.delete.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Employee deactivated");
        queryClient.invalidateQueries({
          queryKey: orpc.pos.employees.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setDeleteId(null);
      },
    })
  );

  const employeesQuery = useQuery(
    orpc.pos.employees.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const items = employeesQuery.data?.items ?? [];
  const total = employeesQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "employeeNumber",
      header: "Employee #",
    },
    {
      accessorKey: "firstName",
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "phone",
      cell: ({ row }) => row.original.phone ?? "—",
      header: "Phone",
    },
    {
      accessorKey: "role",
      header: "Role",
    },
    {
      accessorKey: "department",
      cell: ({ row }) => row.original.department ?? "—",
      header: "Department",
    },
    {
      accessorKey: "canApplyDiscounts",
      cell: ({ row }) => (row.original.canApplyDiscounts ? "Yes" : "No"),
      header: "Discounts",
    },
    {
      accessorKey: "canProcessReturns",
      cell: ({ row }) => (row.original.canProcessReturns ? "Yes" : "No"),
      header: "Returns",
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditId(row.original.id);
              setEditData({
                canApplyDiscounts: row.original.canApplyDiscounts ?? false,
                canProcessReturns: row.original.canProcessReturns ?? false,
                commissionRate: row.original.commissionRate ?? "",
                department: row.original.department ?? "",
                email: row.original.email,
                employeeNumber: row.original.employeeNumber,
                firstName: row.original.firstName,
                hourlyRate: row.original.hourlyRate ?? "",
                lastName: row.original.lastName,
                maxDiscountPercent: row.original.maxDiscountPercent ?? "",
                phone: row.original.phone ?? "",
                role: row.original.role,
                userId: row.original.userId,
              });
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
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
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground">
            Manage POS employees and their permissions
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => {
            setEditId(null);
            setEditData(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(pageIndex) => setPage(pageIndex)}
        loading={employeesQuery.isLoading}
      />

      <EmployeeFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
          setEditData(null);
        }}
        editId={editId}
        editData={editData}
      />

      {/* Deactivate Confirmation */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Employee</DialogTitle>
            <DialogDescription>
              This employee will be marked inactive and excluded from future
              shifts. This action can be undone by editing the employee.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate({ id: deleteId });
                }
              }}
            >
              {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/pos/employees")({
  component: EmployeesPage,
});

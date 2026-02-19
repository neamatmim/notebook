import type { FormEvent } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { queryClient, orpc } from "@/utils/orpc";

interface CustomerFormData {
  city: string;
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  notes: string;
  phone: string;
  type: string;
}

const emptyForm: CustomerFormData = {
  city: "",
  companyName: "",
  email: "",
  firstName: "",
  lastName: "",
  notes: "",
  phone: "",
  type: "regular",
};

interface CustomerFormDialogProps {
  editId?: string | null;
  onClose: () => void;
  open: boolean;
}

export function CustomerFormDialog({
  open,
  onClose,
  editId,
}: CustomerFormDialogProps) {
  const [form, setForm] = useState<CustomerFormData>(emptyForm);
  const isEdit = Boolean(editId);

  const customerQuery = useQuery(
    orpc.pos.customers.get.queryOptions({
      enabled: Boolean(editId),
      input: { id: editId! },
    })
  );

  useEffect(() => {
    if (editId && customerQuery.data) {
      const c = customerQuery.data;
      setForm({
        city: c.city ?? "",
        companyName: c.companyName ?? "",
        email: c.email ?? "",
        firstName: c.firstName ?? "",
        lastName: c.lastName ?? "",
        notes: c.notes ?? "",
        phone: c.phone ?? "",
        type: c.type ?? "regular",
      });
    } else if (!editId) {
      setForm(emptyForm);
    }
  }, [editId, customerQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.pos.customers.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
  };

  const createMutation = useMutation(
    orpc.pos.customers.create.mutationOptions({
      onSuccess: () => {
        toast.success("Customer created");
        invalidate();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.pos.customers.update.mutationOptions({
      onSuccess: () => {
        toast.success("Customer updated");
        invalidate();
        onClose();
      },
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      city: form.city || undefined,
      companyName: form.companyName || undefined,
      email: form.email || undefined,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      notes: form.notes || undefined,
      phone: form.phone || undefined,
      type: form.type as "regular" | "vip" | "wholesale" | "employee",
    };
    if (isEdit && editId) {
      updateMutation.mutate({ ...payload, id: editId });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = <K extends keyof CustomerFormData>(
    key: K,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isLoading = isEdit && customerQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Customer" : "Add Customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update customer details."
              : "Add a new customer to your database."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cust-first">First Name</Label>
                <Input
                  id="cust-first"
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-last">Last Name</Label>
                <Input
                  id="cust-last"
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input
                  id="cust-phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-company">Company</Label>
                <Input
                  id="cust-company"
                  value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-type">Type</Label>
                <select
                  id="cust-type"
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                  className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                >
                  <option value="regular">Regular</option>
                  <option value="vip">VIP</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-city">City</Label>
                <Input
                  id="cust-city"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-notes">Notes</Label>
              <Textarea
                id="cust-notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Internal notes..."
              />
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
        )}
      </DialogContent>
    </Dialog>
  );
}

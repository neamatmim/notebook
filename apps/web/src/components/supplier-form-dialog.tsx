import type { FormEvent } from "react";

import { useMutation } from "@tanstack/react-query";
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

interface SupplierFormData {
  city: string;
  contactName: string;
  country: string;
  email: string;
  name: string;
  notes: string;
  paymentTerms: string;
  paymentTermsDays: string;
  phone: string;
  status: "active" | "inactive" | "suspended";
}

const emptyForm: SupplierFormData = {
  city: "",
  contactName: "",
  country: "",
  email: "",
  name: "",
  notes: "",
  paymentTerms: "",
  paymentTermsDays: "",
  phone: "",
  status: "active",
};

interface SupplierFormDialogProps {
  editData?:
    | (Omit<Partial<SupplierFormData>, "paymentTermsDays"> & {
        name: string;
        paymentTermsDays?: number | null;
        status?: "active" | "inactive" | "suspended";
      })
    | null;
  editId?: string | null;
  onClose: () => void;
  open: boolean;
}

export function SupplierFormDialog({
  open,
  onClose,
  editId,
  editData,
}: SupplierFormDialogProps) {
  const [form, setForm] = useState<SupplierFormData>(emptyForm);
  const isEdit = Boolean(editId);

  useEffect(() => {
    if (editData && editId) {
      setForm({
        city: editData.city ?? "",
        contactName: editData.contactName ?? "",
        country: editData.country ?? "",
        email: editData.email ?? "",
        name: editData.name,
        notes: editData.notes ?? "",
        paymentTerms: editData.paymentTerms ?? "",
        paymentTermsDays:
          editData.paymentTermsDays !== null &&
          editData.paymentTermsDays !== undefined
            ? String(editData.paymentTermsDays)
            : "",
        phone: editData.phone ?? "",
        status: editData.status ?? "active",
      });
    } else if (!editId) {
      setForm(emptyForm);
    }
  }, [editId, editData]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.suppliers.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.products.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
  };

  const createMutation = useMutation(
    orpc.inventory.suppliers.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Supplier created");
        invalidate();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.inventory.suppliers.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Supplier updated");
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
      contactName: form.contactName || undefined,
      country: form.country || undefined,
      email: form.email || undefined,
      name: form.name,
      notes: form.notes || undefined,
      paymentTerms: form.paymentTerms || undefined,
      paymentTermsDays: form.paymentTermsDays
        ? Number(form.paymentTermsDays)
        : undefined,
      phone: form.phone || undefined,
    };
    if (isEdit && editId) {
      updateMutation.mutate({ ...payload, id: editId, status: form.status });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = <K extends keyof SupplierFormData>(
    key: K,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
          <DialogTitle>{isEdit ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update supplier details."
              : "Add a new supplier to your network."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sup-name"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-contact">Contact Name</Label>
              <Input
                id="sup-contact"
                value={form.contactName}
                onChange={(e) => updateField("contactName", e.target.value)}
                placeholder="Contact person"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-email">Email</Label>
              <Input
                id="sup-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-phone">Phone</Label>
              <Input
                id="sup-phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-city">City</Label>
              <Input
                id="sup-city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-country">Country</Label>
              <Input
                id="sup-country"
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-terms">Payment Terms</Label>
              <Input
                id="sup-terms"
                value={form.paymentTerms}
                onChange={(e) => updateField("paymentTerms", e.target.value)}
                placeholder="e.g., Net 30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-terms-days">Payment Terms (days)</Label>
              <Input
                id="sup-terms-days"
                type="number"
                min="0"
                value={form.paymentTermsDays}
                onChange={(e) =>
                  updateField("paymentTermsDays", e.target.value)
                }
                placeholder="e.g. 30"
              />
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="sup-status">Status</Label>
                <select
                  id="sup-status"
                  value={form.status}
                  onChange={(e) =>
                    updateField(
                      "status",
                      e.target.value as "active" | "inactive" | "suspended"
                    )
                  }
                  className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-notes">Notes</Label>
            <Textarea
              id="sup-notes"
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
              className="bg-blue-600 hover:bg-blue-700"
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

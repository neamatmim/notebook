import type { FormEvent } from "react";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface LocationFormData {
  address: string;
  city: string;
  country: string;
  isPrimary: boolean;
  name: string;
  state: string;
  type: string;
  zipCode: string;
}

const emptyForm: LocationFormData = {
  address: "",
  city: "",
  country: "",
  isPrimary: false,
  name: "",
  state: "",
  type: "warehouse",
  zipCode: "",
};

interface LocationFormDialogProps {
  editData?:
    | (Partial<LocationFormData> & { name: string; type: string })
    | null;
  editId?: string | null;
  onClose: () => void;
  open: boolean;
}

export function LocationFormDialog({
  open,
  onClose,
  editId,
  editData,
}: LocationFormDialogProps) {
  const [form, setForm] = useState<LocationFormData>(emptyForm);
  const isEdit = Boolean(editId);

  useEffect(() => {
    if (editData && editId) {
      setForm({
        address: editData.address ?? "",
        city: editData.city ?? "",
        country: editData.country ?? "",
        isPrimary: editData.isPrimary ?? false,
        name: editData.name,
        state: editData.state ?? "",
        type: editData.type,
        zipCode: editData.zipCode ?? "",
      });
    } else if (!editId) {
      setForm(emptyForm);
    }
  }, [editId, editData]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.locations.list.queryOptions({}).queryKey,
    });
  };

  const createMutation = useMutation(
    orpc.inventory.locations.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Location created");
        invalidate();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.inventory.locations.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Location updated");
        invalidate();
        onClose();
      },
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      address: form.address || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
      isPrimary: form.isPrimary,
      name: form.name,
      state: form.state || undefined,
      type: form.type,
      zipCode: form.zipCode || undefined,
    };
    if (isEdit && editId) {
      updateMutation.mutate({ ...payload, id: editId });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = <K extends keyof LocationFormData>(
    key: K,
    value: LocationFormData[K]
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Location" : "Add Location"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update location details."
              : "Add a new warehouse or store location."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loc-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loc-name"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Location name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-type">
                Type <span className="text-red-500">*</span>
              </Label>
              <select
                id="loc-type"
                required
                value={form.type}
                onChange={(e) => updateField("type", e.target.value)}
                className="border-input bg-background flex h-8 w-full rounded-none border px-2.5 py-1 text-xs outline-none"
              >
                <option value="warehouse">Warehouse</option>
                <option value="store">Store</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="loc-address">Address</Label>
              <Input
                id="loc-address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-city">City</Label>
              <Input
                id="loc-city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-state">State</Label>
              <Input
                id="loc-state"
                value={form.state}
                onChange={(e) => updateField("state", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-zip">Zip Code</Label>
              <Input
                id="loc-zip"
                value={form.zipCode}
                onChange={(e) => updateField("zipCode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-country">Country</Label>
              <Input
                id="loc-country"
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="loc-primary"
              checked={form.isPrimary}
              onCheckedChange={(checked) =>
                updateField("isPrimary", Boolean(checked))
              }
            />
            <Label htmlFor="loc-primary">Primary location</Label>
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

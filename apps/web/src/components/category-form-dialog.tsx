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

interface CategoryFormData {
  description: string;
  name: string;
}

const emptyForm: CategoryFormData = { description: "", name: "" };

interface CategoryFormDialogProps {
  editId?: string | null;
  editData?: { description?: string | null; name: string } | null;
  onClose: () => void;
  open: boolean;
}

export function CategoryFormDialog({
  open,
  onClose,
  editId,
  editData,
}: CategoryFormDialogProps) {
  const [form, setForm] = useState<CategoryFormData>(emptyForm);
  const isEdit = Boolean(editId);

  useEffect(() => {
    if (editData && editId) {
      setForm({
        description: editData.description ?? "",
        name: editData.name,
      });
    } else if (!editId) {
      setForm(emptyForm);
    }
  }, [editId, editData]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.categories.list
        .queryOptions({ input: {} })
        .queryKey.slice(0, 2),
    });
  };

  const createMutation = useMutation(
    orpc.inventory.categories.create.mutationOptions({
      onSuccess: () => {
        toast.success("Category created");
        invalidate();
        onClose();
      },
    })
  );

  const updateMutation = useMutation(
    orpc.inventory.categories.update.mutationOptions({
      onSuccess: () => {
        toast.success("Category updated");
        invalidate();
        onClose();
      },
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      description: form.description || undefined,
      name: form.name,
    };
    if (isEdit && editId) {
      updateMutation.mutate({ ...payload, id: editId });
    } else {
      createMutation.mutate(payload);
    }
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
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update category details."
              : "Create a new product category."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cat-name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Category name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Optional description"
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

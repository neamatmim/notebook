import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9-]/g, "")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function CreateOrgDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugEdited) {
      setSlug(slugify(v));
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.organization.create({
      name: name.trim(),
      slug: slug.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to create organization.");
      return;
    }
    toast.success(`Organization "${name}" created.`);
    setName("");
    setSlug("");
    setSlugEdited(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              placeholder="acme-inc"
            />
            <p className="text-muted-foreground text-xs">
              Used in URLs. Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={loading || !name.trim() || !slug.trim()}
            onClick={handleCreate}
          >
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrgSwitcher() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: organizations } = authClient.useListOrganizations();
  const { refetch: refetchSession } = authClient.useSession();
  const [createOpen, setCreateOpen] = useState(false);

  const handleSwitch = async (orgId: string) => {
    const { error } = await authClient.organization.setActive({
      organizationId: orgId,
    });
    if (error) {
      toast.error(error.message ?? "Failed to switch organization.");
      return;
    }
    refetchSession();
  };

  const orgs = organizations ?? [];
  const label = activeOrg?.name ?? "Select organization";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <span className="max-w-32 truncate">{label}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Organizations
          </DropdownMenuLabel>
          {orgs.length === 0 && (
            <DropdownMenuItem disabled>No organizations yet</DropdownMenuItem>
          )}
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{org.name}</span>
              {activeOrg?.id === org.id && (
                <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-green-600" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

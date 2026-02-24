import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Crown,
  Mail,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  User,
} from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUser } from "@/functions/get-user";
import { authClient } from "@/lib/auth-client";

type MemberRole = "owner" | "admin" | "member";

const ROLE_ICONS: Record<
  MemberRole,
  React.ComponentType<{ className?: string }>
> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: "text-yellow-600",
  admin: "text-blue-600",
  member: "text-gray-500",
};

function InviteMemberDialog({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.organization.inviteMember({
      email: email.trim(),
      role,
      organizationId,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to send invitation.");
      return;
    }
    toast.success(`Invitation sent to ${email}.`);
    setEmail("");
    setRole("member");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInvite();
                }
              }}
              placeholder="colleague@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as MemberRole)}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={loading || !email.trim()} onClick={handleInvite}>
            {loading ? "Sending…" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationSettingsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  if (!activeOrg) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-bold">No Organization Selected</h1>
        <p className="text-muted-foreground mt-2">
          Select or create an organization using the switcher in the header.
        </p>
      </div>
    );
  }

  const currentUserId = session?.user.id;
  const members = activeOrg.members ?? [];
  const invitations = activeOrg.invitations ?? [];
  const currentMember = members.find((m) => m.userId === currentUserId);
  const canManage =
    currentMember?.role === "owner" || currentMember?.role === "admin";

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setRemovingId(memberId);
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId: activeOrg.id,
    });
    setRemovingId(null);
    if (error) {
      toast.error(error.message ?? "Failed to remove member.");
      return;
    }
    toast.success(`${memberName} removed from organization.`);
  };

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    setUpdatingRole(memberId);
    const { error } = await authClient.organization.updateMemberRole({
      memberId,
      role: newRole,
      organizationId: activeOrg.id,
    });
    setUpdatingRole(null);
    if (error) {
      toast.error(error.message ?? "Failed to update role.");
      return;
    }
    toast.success("Role updated.");
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (error) {
      toast.error(error.message ?? "Failed to cancel invitation.");
      return;
    }
    toast.success("Invitation cancelled.");
  };

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{activeOrg.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Slug: <span className="font-mono">{activeOrg.slug}</span>
        </p>
      </div>

      {/* Members */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Members ({members.length})</h2>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>

        <div className="divide-y rounded-lg border">
          {members.map((m) => {
            const role = (m.role ?? "member") as MemberRole;
            const RoleIcon = ROLE_ICONS[role] ?? User;
            const isMe = m.userId === currentUserId;

            return (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold uppercase">
                    {m.user?.name?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {m.user?.name ?? "Unknown"}
                      {isMe && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {m.user?.email ?? ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1 text-xs font-medium ${ROLE_COLORS[role]}`}
                  >
                    <RoleIcon className="h-3.5 w-3.5" />
                    {role}
                  </span>

                  {canManage && !isMe && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button size="sm" variant="ghost" />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={updatingRole === m.id}
                          onClick={() => handleUpdateRole(m.id, "member")}
                        >
                          Set as Member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={updatingRole === m.id}
                          onClick={() => handleUpdateRole(m.id, "admin")}
                        >
                          Set as Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={updatingRole === m.id}
                          onClick={() => handleUpdateRole(m.id, "owner")}
                        >
                          Set as Owner
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={removingId === m.id}
                          onClick={() =>
                            handleRemoveMember(m.id, m.user?.name ?? "Member")
                          }
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Pending Invitations ({invitations.length})
          </h2>
          <div className="divide-y rounded-lg border">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-muted-foreground text-xs">
                      Role: {inv.role ?? "member"} · Expires{" "}
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleCancelInvitation(inv.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={activeOrg.id}
      />
    </div>
  );
}

export const Route = createFileRoute("/settings/organization")({
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: OrganizationSettingsPage,
});

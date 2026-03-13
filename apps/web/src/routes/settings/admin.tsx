import { Button } from "@notebook/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@notebook/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notebook/ui/components/dropdown-menu";
import { Input } from "@notebook/ui/components/input";
import { Label } from "@notebook/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Ban, MoreHorizontal, Shield, ShieldOff, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getUser } from "@/functions/get-user";
import { authClient } from "@/lib/auth-client";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: Date | string;
}

function BanDialog({
  open,
  user,
  onClose,
  onSuccess,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBan = async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    const { error } = await authClient.admin.banUser({
      userId: user.id,
      banReason: reason.trim() || undefined,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to ban user.");
      return;
    }
    toast.success(`${user.name} has been banned.`);
    setReason("");
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ban {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ban-reason">Reason (optional)</Label>
          <Input
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for ban"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={loading} onClick={handleBan}>
            {loading ? "Banning…" : "Ban User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminPage() {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await authClient.admin.listUsers({
        query: { limit: 100, offset: 0 },
      });
      if (error) {
        throw new Error(error.message ?? "Failed to load users.");
      }
      return data;
    },
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const handleSetRole = async (userId: string, role: "admin" | "user") => {
    const { error } = await authClient.admin.setRole({ userId, role });
    if (error) {
      toast.error(error.message ?? "Failed to update role.");
      return;
    }
    toast.success("Role updated.");
    refetch();
  };

  const handleUnban = async (userId: string, userName: string) => {
    const { error } = await authClient.admin.unbanUser({ userId });
    if (error) {
      toast.error(error.message ?? "Failed to unban user.");
      return;
    }
    toast.success(`${userName} has been unbanned.`);
    refetch();
  };

  const handleRevokeSessions = async (userId: string, userName: string) => {
    const { error } = await authClient.admin.revokeUserSessions({ userId });
    if (error) {
      toast.error(error.message ?? "Failed to revoke sessions.");
      return;
    }
    toast.success(`Sessions revoked for ${userName}.`);
  };

  const users: AdminUser[] = (usersData?.users ?? []) as AdminUser[];
  const currentUserId = session?.user.id;

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage users, roles, and access.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Users ({users.length})</h2>

        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            Loading…
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              const isAdmin = u.role === "admin";
              const isBanned = u.banned === true;

              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold uppercase">
                      {u.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {u.name}
                        {isMe && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Admin
                      </span>
                    )}
                    {isBanned && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Banned
                      </span>
                    )}

                    {!isMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button size="sm" variant="ghost" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isAdmin ? (
                            <DropdownMenuItem
                              onClick={() => handleSetRole(u.id, "admin")}
                            >
                              <Shield className="mr-2 h-3.5 w-3.5" />
                              Make Admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleSetRole(u.id, "user")}
                            >
                              <ShieldOff className="mr-2 h-3.5 w-3.5" />
                              Remove Admin
                            </DropdownMenuItem>
                          )}
                          {!isBanned ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setBanTarget(u)}
                            >
                              <Ban className="mr-2 h-3.5 w-3.5" />
                              Ban User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleUnban(u.id, u.name)}
                            >
                              <Ban className="mr-2 h-3.5 w-3.5" />
                              Unban User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleRevokeSessions(u.id, u.name)}
                          >
                            <UserX className="mr-2 h-3.5 w-3.5" />
                            Revoke Sessions
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <BanDialog
        open={banTarget !== null}
        user={banTarget}
        onClose={() => setBanTarget(null)}
        onSuccess={refetch}
      />
    </div>
  );
}

export const Route = createFileRoute("/settings/admin")({
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    if (session.user.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

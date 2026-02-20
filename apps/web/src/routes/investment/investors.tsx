import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { orpc } from "@/utils/orpc";

type KycStatus = "approved" | "pending" | "rejected";

const KYC_COLORS: Record<KycStatus, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

interface InvestorForm {
  address: string;
  country: string;
  email: string;
  name: string;
  notes: string;
  phone: string;
  taxId: string;
  type: string;
}

const EMPTY_FORM: InvestorForm = {
  address: "",
  country: "",
  email: "",
  name: "",
  notes: "",
  phone: "",
  taxId: "",
  type: "individual",
};

function InvestorsPage() {
  const queryClient = useQueryClient();
  const [kycFilter, setKycFilter] = useState<KycStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<InvestorForm>(EMPTY_FORM);

  const { data, isLoading } = useQuery(
    orpc.investment.investors.list.queryOptions({
      input: {
        kycStatus: kycFilter === "all" ? undefined : kycFilter,
        limit: 50,
        offset: 0,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.investment.investors.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Investor created");
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    ...orpc.investment.investors.approveKyc.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("KYC approved");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    ...orpc.investment.investors.rejectKyc.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("KYC rejected");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    createMutation.mutate({
      address: form.address || undefined,
      country: form.country || undefined,
      email: form.email,
      name: form.name,
      notes: form.notes || undefined,
      phone: form.phone || undefined,
      taxId: form.taxId || undefined,
      type: form.type as "corporate" | "individual" | "institutional",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Investors</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Investor</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={kycFilter === s ? "default" : "outline"}
                onClick={() => setKycFilter(s)}
              >
                {s === "all"
                  ? "All"
                  : `KYC: ${s.charAt(0).toUpperCase() + s.slice(1)}`}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Country</th>
                    <th className="py-2 pr-3 font-medium">KYC Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((investor) => (
                    <tr
                      key={investor.id}
                      className="hover:bg-muted/40 border-b"
                    >
                      <td className="py-2 pr-3 font-medium">{investor.name}</td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {investor.email}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {investor.type}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {investor.country ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${KYC_COLORS[investor.kycStatus as KycStatus] ?? ""}`}
                        >
                          {investor.kycStatus}
                        </span>
                      </td>
                      <td className="space-x-1 py-2">
                        {investor.kycStatus === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                approveMutation.mutate({ id: investor.id })
                              }
                            >
                              Approve KYC
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                rejectMutation.mutate({ id: investor.id })
                              }
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No investors found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Investor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="inv-name">Full Name</Label>
                <Input
                  id="inv-name"
                  placeholder="John Smith"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="inv-phone">Phone</Label>
                <Input
                  id="inv-phone"
                  placeholder="+1 555 0100"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="inv-type">Investor Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm({ ...form, type: v ?? "individual" })
                  }
                >
                  <SelectTrigger id="inv-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="institutional">Institutional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inv-country">Country</Label>
                <Input
                  id="inv-country"
                  placeholder="US"
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="inv-tax">Tax ID</Label>
                <Input
                  id="inv-tax"
                  placeholder="123-45-6789"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="inv-address">Address</Label>
                <Input
                  id="inv-address"
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="inv-notes">Notes</Label>
                <Input
                  id="inv-notes"
                  placeholder="Additional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !form.name || !form.email}
            >
              {createMutation.isPending ? "Saving…" : "Add Investor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/investors")({
  component: InvestorsPage,
});

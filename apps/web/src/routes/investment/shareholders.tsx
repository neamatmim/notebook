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

type AllotmentStatus = "active" | "cancelled" | "suspended" | "transferred";

const STATUS_COLORS: Record<AllotmentStatus, string> = {
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  suspended: "bg-yellow-100 text-yellow-700",
  transferred: "bg-gray-100 text-gray-600",
};

interface AllotForm {
  allotmentDate: string;
  certificateNumber: string;
  investorId: string;
  issuePricePerShare: string;
  notes: string;
  numberOfShares: string;
  shareClassId: string;
}

interface TransferForm {
  newCertificateNumber: string;
  notes: string;
  pricePerShare: string;
  toInvestorId: string;
  transferDate: string;
}

const EMPTY_ALLOT: AllotForm = {
  allotmentDate: new Date().toISOString().slice(0, 10),
  certificateNumber: "",
  investorId: "",
  issuePricePerShare: "",
  notes: "",
  numberOfShares: "",
  shareClassId: "",
};

const EMPTY_TRANSFER: TransferForm = {
  newCertificateNumber: "",
  notes: "",
  pricePerShare: "",
  toInvestorId: "",
  transferDate: new Date().toISOString().slice(0, 10),
};

function ShareholdersPage() {
  const queryClient = useQueryClient();
  const [shareClassFilter, setShareClassFilter] = useState<string>("all");
  const [allotOpen, setAllotOpen] = useState(false);
  const [allotForm, setAllotForm] = useState<AllotForm>(EMPTY_ALLOT);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAllocationId, setTransferAllocationId] = useState("");
  const [transferForm, setTransferForm] =
    useState<TransferForm>(EMPTY_TRANSFER);

  const { data, isLoading } = useQuery(
    orpc.investment.shareholders.list.queryOptions({
      input: {
        shareClassId: shareClassFilter === "all" ? undefined : shareClassFilter,
      },
    })
  );

  const { data: shareClassesData } = useQuery(
    orpc.investment.shareClasses.list.queryOptions()
  );

  const { data: investorsData } = useQuery(
    orpc.investment.investors.list.queryOptions({
      input: { kycStatus: "approved", limit: 200, offset: 0 },
    })
  );

  const allotMutation = useMutation({
    ...orpc.investment.shareholders.allot.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setAllotOpen(false);
      setAllotForm(EMPTY_ALLOT);
      toast.success("Shares allotted");
    },
  });

  const transferMutation = useMutation({
    ...orpc.investment.shareholders.transfer.mutationOptions(),
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setTransferOpen(false);
      setTransferForm(EMPTY_TRANSFER);
      toast.success("Shares transferred");
    },
  });

  const handleAllot = () => {
    allotMutation.mutate({
      allotmentDate: allotForm.allotmentDate,
      certificateNumber: allotForm.certificateNumber || undefined,
      investorId: allotForm.investorId,
      issuePricePerShare: allotForm.issuePricePerShare,
      notes: allotForm.notes || undefined,
      numberOfShares: Number(allotForm.numberOfShares),
      shareClassId: allotForm.shareClassId,
    });
  };

  const handleTransfer = () => {
    transferMutation.mutate({
      allocationId: transferAllocationId,
      newCertificateNumber: transferForm.newCertificateNumber || undefined,
      notes: transferForm.notes || undefined,
      pricePerShare: transferForm.pricePerShare || undefined,
      toInvestorId: transferForm.toInvestorId,
      transferDate: transferForm.transferDate,
    });
  };

  const openTransfer = (allocationId: string) => {
    setTransferAllocationId(allocationId);
    setTransferForm(EMPTY_TRANSFER);
    setTransferOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shareholders</h1>
        <Button onClick={() => setAllotOpen(true)}>Allot Shares</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={shareClassFilter === "all" ? "default" : "outline"}
              onClick={() => setShareClassFilter("all")}
            >
              All Classes
            </Button>
            {shareClassesData?.items.map((sc) => (
              <Button
                key={sc.id}
                size="sm"
                variant={shareClassFilter === sc.id ? "default" : "outline"}
                onClick={() => setShareClassFilter(sc.id)}
              >
                {sc.code}
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
                    <th className="py-2 pr-3 font-medium">Investor</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Share Class</th>
                    <th className="py-2 pr-3 font-medium">Shares</th>
                    <th className="py-2 pr-3 font-medium">Consideration</th>
                    <th className="py-2 pr-3 font-medium">Certificate #</th>
                    <th className="py-2 pr-3 font-medium">Allotment Date</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((row) => (
                    <tr
                      key={row.allocationId}
                      className="hover:bg-muted/40 border-b"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {row.investorName}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {row.investorEmail}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="font-mono text-xs">
                          {row.shareClassCode}
                        </span>{" "}
                        {row.shareClassName}
                      </td>
                      <td className="py-2 pr-3">
                        {row.numberOfShares.toLocaleString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        ${Number(row.totalConsideration ?? 0).toLocaleString()}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3 font-mono text-xs">
                        {row.certificateNumber ?? "—"}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {new Date(row.allotmentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[row.status as AllotmentStatus] ?? ""}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {row.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTransfer(row.allocationId)}
                          >
                            Transfer
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No shareholder records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allot Shares Dialog */}
      <Dialog open={allotOpen} onOpenChange={setAllotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allot Shares</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="allot-investor">Investor (KYC Approved)</Label>
              <Select
                value={allotForm.investorId}
                onValueChange={(v) =>
                  setAllotForm({ ...allotForm, investorId: v ?? "" })
                }
              >
                <SelectTrigger id="allot-investor">
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {investorsData?.items.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name} ({inv.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="allot-sc">Share Class</Label>
              <Select
                value={allotForm.shareClassId}
                onValueChange={(v) =>
                  setAllotForm({ ...allotForm, shareClassId: v ?? "" })
                }
              >
                <SelectTrigger id="allot-sc">
                  <SelectValue placeholder="Select share class" />
                </SelectTrigger>
                <SelectContent>
                  {shareClassesData?.items.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.code} — {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="allot-shares">Number of Shares</Label>
              <Input
                id="allot-shares"
                type="number"
                placeholder="100000"
                value={allotForm.numberOfShares}
                onChange={(e) =>
                  setAllotForm({ ...allotForm, numberOfShares: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="allot-price">Issue Price/Share ($)</Label>
              <Input
                id="allot-price"
                type="number"
                placeholder="2.00"
                value={allotForm.issuePricePerShare}
                onChange={(e) =>
                  setAllotForm({
                    ...allotForm,
                    issuePricePerShare: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="allot-date">Allotment Date</Label>
              <Input
                id="allot-date"
                type="date"
                value={allotForm.allotmentDate}
                onChange={(e) =>
                  setAllotForm({ ...allotForm, allotmentDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="allot-cert">Certificate #</Label>
              <Input
                id="allot-cert"
                placeholder="CERT-001"
                value={allotForm.certificateNumber}
                onChange={(e) =>
                  setAllotForm({
                    ...allotForm,
                    certificateNumber: e.target.value,
                  })
                }
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="allot-notes">Notes</Label>
              <Input
                id="allot-notes"
                placeholder="Notes"
                value={allotForm.notes}
                onChange={(e) =>
                  setAllotForm({ ...allotForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAllotOpen(false);
                setAllotForm(EMPTY_ALLOT);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAllot}
              disabled={
                allotMutation.isPending ||
                !allotForm.investorId ||
                !allotForm.shareClassId ||
                !allotForm.numberOfShares ||
                !allotForm.issuePricePerShare
              }
            >
              {allotMutation.isPending ? "Saving…" : "Allot Shares"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Shares</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="tf-investor">Target Investor</Label>
              <Select
                value={transferForm.toInvestorId}
                onValueChange={(v) =>
                  setTransferForm({ ...transferForm, toInvestorId: v ?? "" })
                }
              >
                <SelectTrigger id="tf-investor">
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {investorsData?.items.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name} ({inv.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tf-price">Price/Share ($)</Label>
              <Input
                id="tf-price"
                type="number"
                placeholder="Original price"
                value={transferForm.pricePerShare}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    pricePerShare: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="tf-date">Transfer Date</Label>
              <Input
                id="tf-date"
                type="date"
                value={transferForm.transferDate}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    transferDate: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="tf-cert">New Certificate #</Label>
              <Input
                id="tf-cert"
                placeholder="CERT-002"
                value={transferForm.newCertificateNumber}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    newCertificateNumber: e.target.value,
                  })
                }
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="tf-notes">Notes</Label>
              <Input
                id="tf-notes"
                placeholder="Notes"
                value={transferForm.notes}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTransferOpen(false);
                setTransferForm(EMPTY_TRANSFER);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={
                transferMutation.isPending || !transferForm.toInvestorId
              }
            >
              {transferMutation.isPending ? "Saving…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/investment/shareholders")({
  component: ShareholdersPage,
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orpc } from "@/utils/orpc";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) {
    return "—";
  }
  return new Date(d).toLocaleDateString();
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const [createFYOpen, setCreateFYOpen] = useState(false);
  const [fyName, setFyName] = useState("");
  const [fyStart, setFyStart] = useState("");
  const [fyEnd, setFyEnd] = useState("");
  const [selectedFYId, setSelectedFYId] = useState<string | null>(null);

  const { data: summary } = useQuery(
    orpc.accounting.settings.summary.queryOptions({ input: {} })
  );

  const { data: fyData } = useQuery(
    orpc.accounting.fiscalYears.list.queryOptions({
      input: { limit: 50, offset: 0 },
    })
  );

  const { data: periods } = useQuery(
    orpc.accounting.fiscalYears.periods.queryOptions({
      input: { fiscalYearId: selectedFYId ?? "" },
      enabled: !!selectedFYId,
    })
  );

  const seedMutation = useMutation({
    ...orpc.accounting.settings.seedAccounts.mutationOptions(),
    onSuccess: (data) => {
      toast.success(`Seeded ${data.seeded} accounts successfully.`);
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message),
  });

  const createFYMutation = useMutation({
    ...orpc.accounting.fiscalYears.create.mutationOptions(),
    onSuccess: (fy) => {
      setCreateFYOpen(false);
      setFyName("");
      setFyStart("");
      setFyEnd("");
      queryClient.invalidateQueries();
      setSelectedFYId(fy!.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const setCurrentMutation = useMutation({
    ...orpc.accounting.fiscalYears.setCurrent.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    ...orpc.accounting.fiscalYears.close.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(err.message),
  });

  const handleCreateFY = () => {
    if (!fyName || !fyStart || !fyEnd) {
      return;
    }
    createFYMutation.mutate({
      endDate: `${fyEnd}T23:59:59.000Z`,
      name: fyName,
      startDate: `${fyStart}T00:00:00.000Z`,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Accounting Settings</h1>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-sm">Accounts</p>
            <p className="text-xl font-semibold">
              {summary?.accountCount ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Current FY</p>
            <p className="text-xl font-semibold">
              {summary?.currentFiscalYearName ?? "None"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Open Periods</p>
            <p className="text-xl font-semibold">
              {summary?.openPeriodCount ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Posted Entries</p>
            <p className="text-xl font-semibold">
              {summary?.totalPostedEntries ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seed accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Default Chart of Accounts</CardTitle>
          <CardDescription>
            Seed 17 standard accounts. Safe to run multiple times (idempotent).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => seedMutation.mutate({})}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? "Seeding…" : "Seed Default Accounts"}
          </Button>
        </CardContent>
      </Card>

      {/* Fiscal Years */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fiscal Years</CardTitle>
            <CardDescription>
              Manage fiscal years and accounting periods.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateFYOpen(true)}>
            Create Fiscal Year
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Start</th>
                  <th className="py-2 pr-4 font-medium">End</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Current</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fyData?.items.map((fy) => (
                  <tr
                    key={fy.id}
                    className="hover:bg-muted/50 cursor-pointer border-b"
                    onClick={() => setSelectedFYId(fy.id)}
                  >
                    <td className="py-2 pr-4 font-medium">{fy.name}</td>
                    <td className="text-muted-foreground py-2 pr-4">
                      {formatDate(fy.startDate)}
                    </td>
                    <td className="text-muted-foreground py-2 pr-4">
                      {formatDate(fy.endDate)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          fy.status === "open"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {fy.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {fy.isCurrent ? (
                        <span className="text-indigo-600 font-semibold">✓</span>
                      ) : null}
                    </td>
                    <td className="space-x-2 py-2">
                      {!fy.isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentMutation.mutate({ id: fy.id });
                          }}
                        >
                          Set Current
                        </Button>
                      )}
                      {fy.status === "open" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeMutation.mutate({ id: fy.id });
                          }}
                        >
                          Close Year
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!fyData?.items.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No fiscal years yet. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Periods for selected FY */}
          {selectedFYId && periods && (
            <div className="mt-6">
              <h3 className="mb-3 font-semibold">Accounting Periods</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {periods.map((p) => (
                  <div key={p.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === "open"
                          ? "bg-green-100 text-green-700"
                          : p.status === "closed"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create FY Dialog */}
      <Dialog open={createFYOpen} onOpenChange={setCreateFYOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Fiscal Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fy-name">Name</Label>
              <Input
                id="fy-name"
                placeholder="FY 2025"
                value={fyName}
                onChange={(e) => setFyName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fy-start">Start Date</Label>
              <Input
                id="fy-start"
                type="date"
                value={fyStart}
                onChange={(e) => setFyStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fy-end">End Date</Label>
              <Input
                id="fy-end"
                type="date"
                value={fyEnd}
                onChange={(e) => setFyEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFYOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFY}
              disabled={
                createFYMutation.isPending || !fyName || !fyStart || !fyEnd
              }
            >
              {createFYMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/accounting/settings")({
  component: SettingsPage,
});

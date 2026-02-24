import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, LogIn, LogOut, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function StartShiftDialog({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");

  const employeesQuery = useQuery(
    orpc.pos.employees.list.queryOptions({ input: { limit: 100 } })
  );
  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const startMutation = useMutation(
    orpc.pos.shifts.start.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Shift started");
        queryClient.invalidateQueries({
          queryKey: orpc.pos.shifts.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        onClose();
        setEmployeeId("");
        setLocationId("");
        setNotes("");
      },
    })
  );

  const handleStart = () => {
    if (!employeeId || !locationId) {
      toast.error("Please select an employee and location.");
      return;
    }
    startMutation.mutate({ employeeId, locationId, notes: notes || undefined });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Shift</DialogTitle>
          <DialogDescription>Open a new shift for a cashier.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              Employee <span className="text-red-500">*</span>
            </Label>
            <Select
              value={employeeId}
              onValueChange={(v) => setEmployeeId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {(employeesQuery.data?.items ?? []).map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} — {emp.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Location <span className="text-red-500">*</span>
            </Label>
            <Select
              value={locationId}
              onValueChange={(v) => setLocationId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {(locationsQuery.data ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-notes">Notes (optional)</Label>
            <Input
              id="shift-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opening notes…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={startMutation.isPending}
            onClick={handleStart}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Start Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndShiftDialog({
  onClose,
  open,
  shiftId,
}: {
  onClose: () => void;
  open: boolean;
  shiftId: string | null;
}) {
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [notes, setNotes] = useState("");

  const endMutation = useMutation(
    orpc.pos.shifts.end.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Shift ended");
        queryClient.invalidateQueries({
          queryKey: orpc.pos.shifts.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        onClose();
        setBreakMinutes("0");
        setNotes("");
      },
    })
  );

  const handleEnd = () => {
    if (!shiftId) {
      return;
    }
    endMutation.mutate({
      breakMinutes: Number(breakMinutes) || 0,
      notes: notes || undefined,
      shiftId,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>End Shift</DialogTitle>
          <DialogDescription>
            Close this shift and record hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="break-mins">Break Minutes</Label>
            <Input
              id="break-mins"
              type="number"
              min="0"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-notes">Closing Notes</Label>
            <Input
              id="end-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Closing notes…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={endMutation.isPending}
            onClick={handleEnd}
          >
            <LogOut className="mr-2 h-4 w-4" />
            End Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftsPage() {
  const [page, setPage] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const [endShiftId, setEndShiftId] = useState<string | null>(null);

  const shiftsQuery = useQuery(
    orpc.pos.shifts.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const items = shiftsQuery.data?.items ?? [];
  const total = shiftsQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const openShifts = items.filter((s) => !s.endTime);

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "employee",
      cell: ({ row }) => {
        const emp = row.original.employee;
        return emp ? `${emp.firstName} ${emp.lastName}` : "—";
      },
      header: "Employee",
    },
    {
      accessorKey: "location",
      cell: ({ row }) => row.original.location?.name ?? "—",
      header: "Location",
    },
    {
      accessorKey: "startTime",
      cell: ({ row }) => new Date(row.original.startTime).toLocaleString(),
      header: "Start",
    },
    {
      accessorKey: "endTime",
      cell: ({ row }) =>
        row.original.endTime ? (
          new Date(row.original.endTime).toLocaleString()
        ) : (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
            Open
          </span>
        ),
      header: "End",
    },
    {
      accessorKey: "hoursWorked",
      cell: ({ row }) =>
        row.original.hoursWorked
          ? `${Number(row.original.hoursWorked).toFixed(2)} h`
          : "—",
      header: "Hours",
    },
    {
      accessorKey: "totalSales",
      cell: ({ row }) => `$${Number(row.original.totalSales ?? 0).toFixed(2)}`,
      header: "Total Sales",
    },
    {
      accessorKey: "transactionCount",
      cell: ({ row }) => row.original.transactionCount ?? 0,
      header: "Transactions",
    },
    {
      cell: ({ row }) => {
        if (row.original.endTime) {
          return null;
        }
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setEndShiftId(row.original.id)}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        );
      },
      header: "Actions",
      id: "actions",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shifts</h1>
          <p className="text-muted-foreground">
            Track employee shifts and sales totals
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: orpc.pos.shifts.list
                  .queryOptions({ input: {} })
                  .queryKey.slice(0, 2),
              })
            }
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setStartOpen(true)}
          >
            <Clock className="mr-2 h-4 w-4" />
            Start Shift
          </Button>
        </div>
      </div>

      {openShifts.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {openShifts.map((shift) => (
            <Card
              key={shift.id}
              className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      {shift.employee
                        ? `${shift.employee.firstName} ${shift.employee.lastName}`
                        : "Unknown"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {shift.location?.name ?? "—"}
                    </p>
                    <p className="mt-1 text-sm">
                      Started: {new Date(shift.startTime).toLocaleTimeString()}
                    </p>
                    <p className="text-sm">
                      Sales: ${Number(shift.totalSales ?? 0).toFixed(2)} ·{" "}
                      {shift.transactionCount ?? 0} txn
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setEndShiftId(shift.id)}
                  >
                    End
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(pageIndex) => setPage(pageIndex)}
        loading={shiftsQuery.isLoading}
      />

      <StartShiftDialog open={startOpen} onClose={() => setStartOpen(false)} />

      <EndShiftDialog
        open={Boolean(endShiftId)}
        shiftId={endShiftId}
        onClose={() => setEndShiftId(null)}
      />
    </div>
  );
}

export const Route = createFileRoute("/pos/shifts")({
  component: ShiftsPage,
});

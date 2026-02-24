import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient, orpc } from "@/utils/orpc";

type CycleCountStatus = "cancelled" | "completed" | "draft" | "in_progress";

const statusColors: Record<CycleCountStatus, string> = {
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-800",
};

function CycleCountDetailPage() {
  const { id } = Route.useParams();

  const [localCounts, setLocalCounts] = useState<Record<string, string>>({});
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const countQuery = useQuery(
    orpc.inventory.cycleCount.get.queryOptions({ input: { id } })
  );

  const count = countQuery.data;

  // Only initialize local state when the session ID changes (not on every
  // background refetch). This prevents unsaved inputs from being wiped when
  // a single line is saved and the query re-fetches.
  useEffect(() => {
    if (count?.id) {
      setLocalCounts((prev) => {
        const next = { ...prev };
        for (const line of count.lines) {
          // Pre-populate only lines the user hasn't touched yet
          if (
            !(line.id in next) &&
            line.countedQuantity !== null &&
            line.countedQuantity !== undefined
          ) {
            next[line.id] = String(line.countedQuantity);
          }
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count?.id]);

  const invalidateCount = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.inventory.cycleCount.get
        .queryOptions({ input: { id } })
        .queryKey.slice(0, 2),
    });
  };

  const updateLineMutation = useMutation(
    orpc.inventory.cycleCount.updateLine.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => invalidateCount(),
    })
  );

  const commitMutation = useMutation(
    orpc.inventory.cycleCount.commit.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: (data) => {
        toast.success(
          `Count committed — ${data.committed} adjustment${data.committed === 1 ? "" : "s"} applied`
        );
        invalidateCount();
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.cycleCount.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.stock.movements
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.products.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setConfirmCommit(false);
      },
    })
  );

  const cancelMutation = useMutation(
    orpc.inventory.cycleCount.cancel.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success("Cycle count cancelled");
        invalidateCount();
        queryClient.invalidateQueries({
          queryKey: orpc.inventory.cycleCount.list
            .queryOptions({ input: {} })
            .queryKey.slice(0, 2),
        });
        setConfirmCancel(false);
      },
    })
  );

  if (countQuery.isLoading) {
    return (
      <div className="text-muted-foreground py-12 text-center">Loading…</div>
    );
  }

  if (!count) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        Session not found.
      </div>
    );
  }

  const isReadonly =
    count.status === "completed" || count.status === "cancelled";
  const isActive = count.status === "draft" || count.status === "in_progress";

  const totalLines = count.lines.length;
  const countedLines = count.lines.filter(
    (l) => l.countedQuantity !== null && l.countedQuantity !== undefined
  ).length;
  const uncountedLines = totalLines - countedLines;
  const varianceLines = count.lines.filter(
    (l) => l.variance !== null && l.variance !== undefined && l.variance !== 0
  ).length;

  return (
    <div>
      {/* Back link */}
      <Link
        to="/inventory/cycle-counts"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        Cycle Counts
      </Link>

      {/* Header */}
      <div className="mb-6 mt-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{count.name}</h1>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[count.status as CycleCountStatus] ?? statusColors.draft}`}
            >
              {count.status.replace("_", " ")}
            </span>
          </div>
          {count.locationName && (
            <p className="text-muted-foreground mt-1 text-sm">
              Location: {count.locationName}
            </p>
          )}
          {count.notes && (
            <p className="text-muted-foreground mt-1 text-sm">{count.notes}</p>
          )}
        </div>

        {isActive && (
          <div className="flex gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setConfirmCommit(true)}
            >
              Commit Count
            </Button>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:text-red-700"
              onClick={() => setConfirmCancel(true)}
            >
              Cancel Session
            </Button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Total Lines</div>
          <div className="mt-1 text-2xl font-bold">{totalLines}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Counted</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {countedLines}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Uncounted</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">
            {uncountedLines}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Variances</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {varianceLines}
          </div>
        </div>
      </div>

      {/* Lines table */}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Variant</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
                <th className="px-4 py-3 text-right font-medium">System Qty</th>
                <th className="px-4 py-3 text-right font-medium">
                  Counted Qty
                </th>
                <th className="px-4 py-3 text-right font-medium">Variance</th>
                {!isReadonly && (
                  <th className="px-4 py-3 text-right font-medium">Save</th>
                )}
              </tr>
            </thead>
            <tbody>
              {count.lines.map((line) => {
                const localVal = localCounts[line.id] ?? "";
                const localNum = localVal !== "" ? Number(localVal) : undefined;
                const computedVariance =
                  localNum !== undefined
                    ? localNum - line.systemQuantity
                    : undefined;

                // Save is only meaningful when user has typed a value that
                // differs from the already-saved server value.
                const serverVal =
                  line.countedQuantity !== null &&
                  line.countedQuantity !== undefined
                    ? line.countedQuantity
                    : undefined;
                const unchanged =
                  localNum === undefined || localNum === serverVal;

                return (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {line.productName ?? "Unknown"}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {line.productSku ?? ""}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {line.variantName ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {line.locationName ?? "Default"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {line.systemQuantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isReadonly ? (
                        <span>{serverVal !== undefined ? serverVal : "—"}</span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          value={localVal}
                          onChange={(e) =>
                            setLocalCounts((prev) => ({
                              ...prev,
                              [line.id]: e.target.value,
                            }))
                          }
                          className="ml-auto h-7 w-24 text-right"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const v = isReadonly ? line.variance : computedVariance;
                        if (v === null || v === undefined) {
                          return (
                            <span className="text-muted-foreground">—</span>
                          );
                        }
                        return (
                          <span
                            className={
                              v > 0
                                ? "font-semibold text-green-600"
                                : v < 0
                                  ? "font-semibold text-red-600"
                                  : "text-muted-foreground"
                            }
                          >
                            {v > 0 ? `+${v}` : v}
                          </span>
                        );
                      })()}
                    </td>
                    {!isReadonly && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          disabled={
                            unchanged ||
                            localVal === "" ||
                            updateLineMutation.isPending
                          }
                          onClick={() => {
                            if (localNum !== undefined) {
                              updateLineMutation.mutate({
                                countedQuantity: localNum,
                                id: line.id,
                              });
                            }
                          }}
                        >
                          Save
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {count.lines.length === 0 && (
                <tr>
                  <td
                    colSpan={isReadonly ? 6 : 7}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    No lines in this count session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCommit}
        onClose={() => setConfirmCommit(false)}
        onConfirm={() => commitMutation.mutate({ id })}
        title="Commit Inventory Count"
        description="This will apply variance adjustments for all counted lines. Lines without a counted quantity will be skipped. This action cannot be undone."
        confirmLabel="Commit Count"
        loading={commitMutation.isPending}
      />

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancelMutation.mutate({ id })}
        title="Cancel Cycle Count"
        description="This will cancel the count session. No stock adjustments will be applied."
        confirmLabel="Cancel Session"
        variant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/cycle-counts/$id")({
  component: CycleCountDetailPage,
});

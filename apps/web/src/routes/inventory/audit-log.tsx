import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  "purchase_order",
  "stock_adjustment",
  "cycle_count",
  "auto_reorder",
];

const ACTION_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  auto_reorder_created: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
  committed: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  marked_ordered: "bg-cyan-100 text-cyan-700",
  received: "bg-emerald-100 text-emerald-700",
};

function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");

  const auditQuery = useQuery(
    orpc.inventory.auditLog.list.queryOptions({
      input: {
        entityType: entityTypeFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      },
    })
  );

  const items = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            Track all inventory changes and actions
          </p>
        </div>
        <Select
          value={entityTypeFilter || "__all__"}
          onValueChange={(v) =>
            setEntityTypeFilter(v === "__all__" ? "" : (v ?? ""))
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All entity types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auditQuery.isLoading && (
        <p className="text-muted-foreground py-12 text-center">Loading…</p>
      )}

      {!auditQuery.isLoading && items.length === 0 && (
        <p className="text-muted-foreground py-12 text-center">
          No audit log entries found.
        </p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Entity Type</th>
                <th className="px-4 py-3 font-medium">Entity ID</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const colorClass =
                  ACTION_COLORS[row.action] ?? "bg-gray-100 text-gray-700";
                let details: Record<string, unknown> = {};
                try {
                  if (row.changes) {
                    details = JSON.parse(row.changes) as Record<
                      string,
                      unknown
                    >;
                  }
                } catch {
                  // ignore parse errors
                }
                return (
                  <tr key={row.id} className="hover:bg-muted/30 border-b">
                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {row.entityType}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                      {row.entityId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
                      >
                        {row.action.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                      {Object.keys(details).length > 0
                        ? Object.entries(details)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(" · ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, total)} of {total} entries
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/inventory/audit-log")({
  component: AuditLogPage,
});

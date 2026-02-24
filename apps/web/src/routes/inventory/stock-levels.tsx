import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import { StockTransferDialog } from "@/components/stock-transfer-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 50;

function StockLevelsPage() {
  const [page, setPage] = useState(0);
  const [locationId, setLocationId] = useState<string>("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const levelsQuery = useQuery(
    orpc.inventory.stock.locationLevels.queryOptions({
      input: {
        limit: PAGE_SIZE,
        locationId: locationId || undefined,
        offset: page * PAGE_SIZE,
        query: search || undefined,
      },
    })
  );

  const locations = locationsQuery.data ?? [];
  const items = levelsQuery.data?.items ?? [];
  const total = levelsQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  type Row = (typeof items)[number];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "locationName",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.locationName ?? (
            <span className="text-muted-foreground italic">Default</span>
          )}
        </span>
      ),
      header: "Location",
    },
    {
      accessorKey: "locationType",
      cell: ({ row }) =>
        row.original.locationType ? (
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs capitalize">
            {row.original.locationType}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      header: "Type",
    },
    {
      accessorKey: "product",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.productName}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.sku}
          </div>
        </div>
      ),
      header: "Product",
    },
    {
      accessorKey: "variantName",
      cell: ({ row }) =>
        row.original.variantName ?? (
          <span className="text-muted-foreground">—</span>
        ),
      header: "Variant",
    },
    {
      accessorKey: "quantity",
      cell: ({ row }) => {
        const qty = row.original.quantity ?? 0;
        return (
          <span
            className={`font-semibold ${qty <= 0 ? "text-red-600" : qty <= 5 ? "text-amber-600" : "text-green-700"}`}
          >
            {qty}
          </span>
        );
      },
      header: "On Hand",
    },
    {
      accessorKey: "availableQuantity",
      cell: ({ row }) => row.original.availableQuantity ?? 0,
      header: "Available",
    },
    {
      accessorKey: "reservedQuantity",
      cell: ({ row }) => {
        const reserved = row.original.reservedQuantity ?? 0;
        return reserved > 0 ? (
          <span className="text-amber-600">{reserved}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        );
      },
      header: "Reserved",
    },
    {
      accessorKey: "lastMovementAt",
      cell: ({ row }) =>
        row.original.lastMovementAt ? (
          new Date(row.original.lastMovementAt).toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      header: "Last Movement",
    },
  ];

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleLocationChange = (val: string | null) => {
    setLocationId(!val || val === "all" ? "" : val);
    setPage(0);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Levels by Location</h1>
          <p className="text-muted-foreground">
            View on-hand, available, and reserved quantities across all
            locations
          </p>
        </div>
        <Button variant="outline" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transfer Stock
        </Button>
      </div>

      {/* Summary bar */}
      <div className="bg-muted/40 mb-4 flex items-center gap-6 rounded-lg border px-4 py-3 text-sm">
        <span>
          <span className="font-semibold">{total}</span>{" "}
          <span className="text-muted-foreground">stock level entries</span>
        </span>
        {locationId && (
          <span>
            <span className="text-muted-foreground">Filtered to:</span>{" "}
            <span className="font-medium">
              {locations.find((l) => l.id === locationId)?.name ?? locationId}
            </span>
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={locationId || "all"}
          onValueChange={handleLocationChange}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}{" "}
                <span className="text-muted-foreground text-xs">
                  ({loc.type})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            placeholder="Search product or SKU…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            className="w-64"
          />
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
          {(search || locationId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setLocationId("");
                setPage(0);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

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
        loading={levelsQuery.isLoading}
      />

      <StockTransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/stock-levels")({
  component: StockLevelsPage,
});

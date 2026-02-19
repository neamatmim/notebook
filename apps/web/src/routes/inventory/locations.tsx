import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { LocationFormDialog } from "@/components/location-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { orpc } from "@/utils/orpc";

function LocationsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    address?: string;
    city?: string;
    country?: string;
    isPrimary?: boolean;
    name: string;
    state?: string;
    type: string;
    zipCode?: string;
  } | null>(null);

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const items = locationsQuery.data ?? [];

  const columns: ColumnDef<(typeof items)[number]>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center">
          <MapPin className="mr-2 h-4 w-4 text-blue-500" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
      header: "Name",
    },
    {
      accessorKey: "type",
      cell: ({ row }) => (
        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-900/50 dark:text-gray-300">
          {row.original.type}
        </span>
      ),
      header: "Type",
    },
    {
      accessorKey: "address",
      cell: ({ row }) =>
        [row.original.address, row.original.city, row.original.state]
          .filter(Boolean)
          .join(", ") || "—",
      header: "Address",
    },
    {
      accessorKey: "isPrimary",
      cell: ({ row }) =>
        row.original.isPrimary ? (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
            Primary
          </span>
        ) : (
          "—"
        ),
      header: "Primary",
    },
    {
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditId(row.original.id);
            setEditData({
              address: row.original.address ?? undefined,
              city: row.original.city ?? undefined,
              country: row.original.country ?? undefined,
              isPrimary: row.original.isPrimary ?? false,
              name: row.original.name,
              state: row.original.state ?? undefined,
              type: row.original.type,
              zipCode: row.original.zipCode ?? undefined,
            });
            setFormOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-muted-foreground">
            Manage warehouses and store locations
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            setEditId(null);
            setEditData(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={locationsQuery.isLoading}
      />

      <LocationFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
          setEditData(null);
        }}
        editId={editId}
        editData={editData}
      />
    </div>
  );
}

export const Route = createFileRoute("/inventory/locations")({
  component: LocationsPage,
});

import type { ColumnDef } from "@tanstack/react-table";

export function cellActionsColumn<T>(options: Partial<ColumnDef<T>>) {
  return {
    id: "actions",
    accessorKey: "actions",
    header: "Actions",
    enableSorting: false,
    enableHiding: false,
    size: 120,
    ...options,
  };
}

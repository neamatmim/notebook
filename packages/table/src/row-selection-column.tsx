import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@workspace/ui/components/checkbox";

export function rowSelectionColumn<T>(
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> {
  return {
    id: "select",
    // Accessor key is required for omitting columns
    accessorKey: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        className="size-4.5 translate-y-[2px] cursor-pointer"
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        // indeterminate={table.getIsSomeRowsSelected()}
        // onChange={table.getToggleAllRowsSelectedHandler()} //or getToggleAllPageRowsSelectedHandler
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        className="size-4.5 translate-y-[2px] cursor-pointer"
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        // disabled={!row.getCanSelect()}
        // onChange={row.getToggleSelectedHandler()}
      />
    ),
    // enableColumnFilter: false,
    // enableGlobalFilter: false,
    enableSorting: false,
    enableHiding: false,
    ...options,
  };
}

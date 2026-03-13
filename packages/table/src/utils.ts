import type { ColumnDef } from "@tanstack/react-table";
import type { StringKeyOf } from "type-fest";

export function omitColumns<T>(
  columns: ColumnDef<T>[],
  accessorKeys: (StringKeyOf<T> | "select" | "actions")[] | string[]
): ColumnDef<T>[] {
  return columns.filter((column) => {
    if (!("accessorKey" in column)) {
      return true;
    }
    return !accessorKeys.includes(
      column.accessorKey as StringKeyOf<T> | "select" | "actions"
    );
  });
}

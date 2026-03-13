import { TABLE_CELL_PLACEHOLDER } from "@notebook/constants";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
// "MMM dd, yyyy"
export function cellDatetimeColumn<T>({
  pattern = "dd MMMM yyyy",
  ...options
}: ColumnDef<T> & { pattern?: string }): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const date = getValue<Date>();
      if (!date) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }
      return <div>{format(date, pattern)}</div>;
    },
    size: 160,
    ...options,
  };
}

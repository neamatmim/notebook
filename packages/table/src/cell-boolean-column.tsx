import type { ColumnDef } from "@tanstack/react-table";
import { CircleAlertIcon, CircleCheckBig } from "lucide-react";

export function cellBooleanColumn<T>({
  reverse,
  ...options
}: ColumnDef<T> & { reverse?: boolean }): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const value = getValue<boolean>();

      if (reverse) {
        return (
          <div className="flex items-center justify-center gap-2">
            {value ? (
              <CircleAlertIcon className="size-4 text-destructive" />
            ) : (
              <CircleCheckBig className="size-4 text-green-500" />
            )}
            <span>{value ? "Yes" : "No"}</span>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
          {value ? (
            <CircleCheckBig className="size-4 text-green-500" />
          ) : (
            <CircleAlertIcon className="size-4 text-destructive" />
          )}
          <span>{value ? "Yes" : "No"}</span>
        </div>
      );
    },
    size: 140,
    enableSorting: false,
    // meta: {
    //   className: "text-center",
    // },
    ...options,
  };
}

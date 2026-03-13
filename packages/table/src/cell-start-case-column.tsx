import type { ColumnDef } from "@tanstack/react-table";
import { TABLE_CELL_PLACEHOLDER } from "@workspace/constants";
import { isEmpty, startCase } from "es-toolkit/compat";

export function cellStartCaseColumn<T>(options: ColumnDef<T>): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const value = getValue<string | null | undefined>();
      if (isEmpty(value?.toString())) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }
      return startCase(value as string);
    },
    size: 120,
    enableSorting: false,

    ...options,
  };
}

import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { TABLE_CELL_PLACEHOLDER } from "@workspace/constants";
import { isEmpty } from "es-toolkit/compat";
export function cellLinkColumn<T>({
  url,
  ...options
}: ColumnDef<T> & {
  url: (row: Row<T>) => LinkProps;
}): ColumnDef<T> {
  return {
    cell: ({ row, getValue }) => {
      const value = getValue<string | number | null | undefined>();
      if (isEmpty(value?.toString())) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }

      return (
        <Link
          className="font-medium text-link underline-offset-2 transition-colors duration-200 hover:text-link-subtle hover:underline"
          {...url(row)}
        >
          {value}
        </Link>
      );
    },
    size: 150,
    enableSorting: false,
    ...options,
  };
}

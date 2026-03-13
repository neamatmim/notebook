import type { ColumnDef } from "@tanstack/react-table";
import { TABLE_CELL_PLACEHOLDER } from "@workspace/constants";
import { isEmpty } from "es-toolkit/compat";

export function cellCommaSeparatedListColumn<T>({
  mapKeys = { value: "value", id: "id" },
  ...options
}: ColumnDef<T> & { mapKeys: { value: string; id: string } }): ColumnDef<T> {
  return {
    enableSorting: false,
    cell: ({ getValue }) => {
      const value = getValue<[]>();
      if (isEmpty(value)) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }
      return (
        <ul className="flex w-full flex-wrap items-start gap-x-1">
          {value.map((item) => (
            <li
              className="text-wrap after:content-[','] last:after:content-['']"
              key={item[mapKeys.id]}
            >
              {item[mapKeys.value]}
            </li>
          ))}
        </ul>
      );
    },
    ...options,
  };
}

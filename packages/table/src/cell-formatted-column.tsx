import type { ColumnDef } from "@tanstack/react-table";
import { TABLE_CELL_PLACEHOLDER } from "@workspace/constants";
import { isEmpty } from "es-toolkit/compat";
export function cellFormattedColumn<T>({
  formatter,
  ...options
}: ColumnDef<T> & {
  formatter: (value: string) => string;
}): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const value = getValue<string | string[] | undefined | null>();
      if (isEmpty(value)) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }
      if (Array.isArray(value)) {
        return (
          <div className="block w-full truncate">
            {value.map((v) => (
              <span
                className="after:pr-1 after:content-[','] last:after:content-['']"
                key={v}
              >
                {formatter(v)}
              </span>
            ))}
          </div>
        );
      }
      return (
        <span className="block w-full truncate">
          {formatter(value as string)}
        </span>
      );
    },
    size: 150,
    enableSorting: false,
    ...options,
  };
}
